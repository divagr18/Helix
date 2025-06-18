# backend/repositories/views.py
import os
import subprocess
from django.db.models import Q  # <--- ADD THIS IMPORT
from rest_framework import generics, permissions
from .tasks import create_documentation_pr_task # We will create this task soon
from django.utils.decorators import method_decorator
from rest_framework import viewsets, permissions
from .models import CodeFile, CodeSymbol as CodeFunction, Repository, CodeSymbol
from .serializers import CodeSymbolSerializer, RepositorySerializer,RepositoryDetailSerializer
from rest_framework.views import APIView
from django.views.decorators.csrf import csrf_exempt
from rest_framework.response import Response
from allauth.socialaccount.models import SocialToken
import requests
from django.http import HttpResponse
from django.http import StreamingHttpResponse # Import Django's native streaming class
from openai import OpenAI
import tempfile,hashlib
from rest_framework import status  # if using Django REST Framework

from openai import OpenAI as OpenAIClient # Renaming to avoid conflict if you have an 'OpenAI' model
from pgvector.django import L2Distance # Or CosineDistance, MaxInnerProduct
from .serializers import CodeSymbolSerializer # We can reuse this for results
import os
REPO_CACHE_BASE_PATH = "/var/repos" # Use the same constant
OPENAI_CLIENT_INSTANCE = OpenAIClient()
OPENAI_EMBEDDING_MODEL_FOR_SEARCH = "text-embedding-3-small"
@method_decorator(csrf_exempt, name="dispatch")
class RepositoryViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # This logic is now correct from our last fix.
        if self.action == 'list':
            return Repository.objects.filter(user=self.request.user)
        return Repository.objects.all()

    def get_serializer_class(self):
        # If we are just listing repos, use the simple summary serializer.
        if self.action == 'list':
            return RepositorySerializer
        # For ALL other actions (retrieve, create, update), use the detailed one.
        return RepositoryDetailSerializer

    def perform_create(self, serializer):
        # This is fine, it just associates the user.
        serializer.save(user=self.request.user)

@method_decorator(csrf_exempt, name="dispatch")
class GithubReposView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        # This is the magic: find the user's GitHub token stored by allauth
        try:
            token = SocialToken.objects.get(
                account__user=request.user, 
                account__provider='github'
            )
        except SocialToken.DoesNotExist:
            return Response({"error": "GitHub token not found."}, status=400)

        # Use the token to make an authenticated request to the GitHub API
        headers = {
            "Authorization": f"token {token.token}",
            "Accept": "application/vnd.github.v3+json",
        }
        
        # Fetch repos from GitHub API
        url = "https://api.github.com/user/repos?type=owner&sort=updated"
        response = requests.get(url, headers=headers)

        if response.status_code != 200:
            return Response(
                {"error": "Failed to fetch from GitHub."}, 
                status=response.status_code
            )
        
        # We only need a few fields for the frontend
        repos_data = response.json()
        simplified_repos = [
            {
                "id": repo["id"],
                "name": repo["name"],
                "full_name": repo["full_name"],
                "private": repo["private"],
            }
            for repo in repos_data
        ]

        return Response(simplified_repos)

@method_decorator(csrf_exempt, name='dispatch')
class FileContentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        # Get file_id from the URL
        file_id = kwargs.get('file_id')
        try:
            code_file = CodeFile.objects.get(id=file_id, repository__user=request.user)
        except CodeFile.DoesNotExist:
            return Response({"error": "File not found or permission denied."}, status=404)
        repo_path = os.path.join(REPO_CACHE_BASE_PATH, str(code_file.repository.id))
        full_file_path = os.path.join(repo_path, code_file.file_path)

        if os.path.exists(full_file_path):
            with open(full_file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            return HttpResponse(content, content_type='text/plain; charset=utf-8')
        else:
            # This might happen if the cache is out of sync.
            # We could trigger a re-index here in a real product.
            return Response({"error": "File not found in cache."}, status=404)
            
def openai_stream_generator(prompt):
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    
    stream = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "system", "content": "You are an expert Python programmer. Your task is to write a concise, professional, Google-style docstring for the given function. Do not include the function signature itself, only the docstring content inside triple quotes. Start with a one-line summary. Then, describe the arguments, and what the function returns."},
            {"role": "user", "content": prompt}
        ],
        stream=True,
    )
    for chunk in stream:
        content = chunk.choices[0].delta.content
        if content:
            yield content

@method_decorator(csrf_exempt, name='dispatch')
class GenerateDocstringView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    # We DO NOT need a special renderer class anymore.

    def get(self, request, *args, **kwargs):
        function_id = kwargs.get('function_id')
        try:
            code_function = CodeFunction.objects.get(id=function_id, code_file__repository__user=request.user)
        except CodeFunction.DoesNotExist:
            return Response({"error": "Function not found or permission denied."}, status=404)

        repo_path = os.path.join(REPO_CACHE_BASE_PATH, str(code_function.code_file.repository.id))
        full_file_path = os.path.join(repo_path, code_function.code_file.file_path)

        if os.path.exists(full_file_path):
            with open(full_file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            function_code = "".join(lines[code_function.start_line - 1 : code_function.end_line])
            
            prompt = f"Generate a docstring for the following Python function:\n\n```python\n{function_code}\n```"
                
            response_stream = openai_stream_generator(prompt)
            return StreamingHttpResponse(response_stream, content_type='text/plain; charset=utf-8')
        else:
            return Response({"error": "File content not founds."}, status=404)
class SaveDocstringView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, *args, **kwargs):
        function_id = kwargs.get('function_id')
        try:
            # Ensure the user owns the function they are trying to update
            code_function = CodeFunction.objects.get(id=function_id, code_file__repository__user=request.user)
        except CodeFunction.DoesNotExist:
            return Response({"error": "Function not found or permission denied."}, status=404)

        # Get the documentation text from the request body
        doc_text = request.data.get('documentation')
        if doc_text is None:
            return Response({"error": "Documentation text not provided."}, status=400)

        # --- Calculate the hash of the documentation ---
        # NOTE: This hash should ideally be identical to the function's content_hash
        # if the AI has done its job perfectly and we are saving it.
        # For now, we will save the hash of the doc itself.
        # A more advanced system might save the content_hash here to "bless" the doc.
        hasher = hashlib.sha256()
        hasher.update(doc_text.encode('utf-8'))
        doc_hash = hasher.hexdigest()

        # --- Update the model and save ---
        code_function.documentation = doc_text
        # For now, we will store the hash of the documentation text.
        # To make the icon green, we will later change this to store the content_hash.
        code_function.documentation_hash = code_function.content_hash
        code_function.save()

        # Return the updated function data
        serializer = CodeSymbolSerializer(code_function)
        return Response(serializer.data)
class CodeSymbolDetailView(generics.RetrieveAPIView):
    """
    API view to retrieve a single, detailed CodeSymbol, including its call graph.
    """
    serializer_class = CodeSymbolSerializer
    permission_classes = [permissions.IsAuthenticated]
    # The 'pk' in the URL will be used to look up the object.
    lookup_url_kwarg = 'pk'

    def get_queryset(self):
        # This queryset ensures a user can only ever access symbols
        # that belong to repositories they own.
        return CodeSymbol.objects.filter(
            Q(code_file__repository__user=self.request.user) |
            Q(code_class__code_file__repository__user=self.request.user)
        ).distinct()

class SemanticSearchView(generics.ListAPIView):
    serializer_class = CodeSymbolSerializer # We'll return a list of matching symbols
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        query_text = self.request.query_params.get('q', None)

        if not query_text:
            return CodeSymbol.objects.none() # Return empty if no query

        try:
            # 1. Get the embedding for the search query from OpenAI
            response = OPENAI_CLIENT_INSTANCE.embeddings.create(
                input=query_text,
                model=OPENAI_EMBEDDING_MODEL_FOR_SEARCH
            )
            query_embedding = response.data[0].embedding

            # 2. Find symbols in the user's repositories that are semantically similar
            # We need to ensure we only search within repositories the user has access to.
            # This can be complex if a symbol doesn't directly link to a user.
            # For now, let's assume we search all symbols and filter later,
            # or ideally, filter by repositories owned by request.user.

            # Get repositories owned by the user
            user_repos = Repository.objects.filter(user=self.request.user)
            
            # Filter CodeSymbols that belong to these repositories
            # This query ensures we only search within the user's accessible symbols.
            # It uses L2Distance, but CosineDistance is often preferred for semantic similarity.
            # For CosineDistance, lower is better (more similar).
            # For L2Distance, lower is better.
            # For MaxInnerProduct, higher is better.
            
            # Using CosineDistance: 1 - (embedding <=> query_embedding)
            # We want to order by similarity (ascending for distance, descending for similarity score)
            # pgvector's <=> operator gives cosine distance.
            # A common way to order is by this distance.
            
            # Let's use L2Distance for this example, order by distance ascending
            # Ensure the CodeSymbol model has an 'embedding' field
            similar_symbols = CodeSymbol.objects.filter(
                Q(code_file__repository__in=user_repos) | Q(code_class__code_file__repository__in=user_repos)
            ).annotate(
                distance=L2Distance('embedding', query_embedding)
            ).order_by('distance')[:5] # Get top 10 results

            return similar_symbols

        except Exception as e:
            print(f"Error during semantic search: {e}")
            return CodeSymbol.objects.none()


# backend/repositories/views.py
# ... other imports ...
from .tasks import create_documentation_pr_task

class CreateDocPRView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        symbol_id = kwargs.get('symbol_id')
        try:
            # Ensure the user owns the symbol
            symbol = CodeSymbol.objects.get(
                id=symbol_id,
            )
            if not symbol.documentation: # Or check if documentation_hash matches content_hash
                return Response({"error": "Documentation must be saved and up-to-date before creating a PR."}, status=status.HTTP_400_BAD_REQUEST)

        except CodeSymbol.DoesNotExist:
            return Response({"error": "Symbol not found or permission denied."}, status=status.HTTP_404_NOT_FOUND)

        # Trigger the Celery task
        task = create_documentation_pr_task.delay(symbol_id, request.user.id)
        
        return Response({"message": "Pull Request creation initiated.", "task_id": task.id}, status=status.HTTP_202_ACCEPTED)