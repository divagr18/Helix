# backend/repositories/views.py
import os
import subprocess
from django.db.models import Q  # <--- ADD THIS IMPORT
from rest_framework import generics, permissions
from .tasks import create_documentation_pr_task # We will create this task soon
from django.utils.decorators import method_decorator
from rest_framework import viewsets
from .models import CodeFile, CodeSymbol as CodeFunction, Repository, CodeSymbol,CodeDependency
from .serializers import CodeSymbolSerializer, RepositorySerializer,RepositoryDetailSerializer
from rest_framework.views import APIView
from django.views.decorators.csrf import csrf_exempt
from rest_framework.response import Response
from allauth.socialaccount.models import SocialToken
import requests,re
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

    def get(self, request, *args, **kwargs):
        function_id = kwargs.get('function_id')
        print(f"DEBUG: GenerateDocstringView called for function_id: {function_id}, user: {request.user.username}")

        # Try to get the object without the user filter first, just to see if it exists at all
        try:
            q_filter = Q(id=function_id) & (
                Q(code_file__repository__user=request.user) | 
                Q(code_class__code_file__repository__user=request.user)
            )
            code_symbol_obj = CodeSymbol.objects.get(q_filter) # Fetched into code_symbol_obj
            print(f"DEBUG: Successfully fetched symbol {code_symbol_obj.name} with ownership check.")

        except CodeSymbol.DoesNotExist:
            print(f"DEBUG: Symbol with ID {function_id} found, but FAILED ownership check for user {request.user.username}.")
            return Response({"error": "Function not found or permission denied."}, status=status.HTTP_404_NOT_FOUND)

        # --- CORRECTED VARIABLE USAGE BELOW ---
        # Determine the correct CodeFile instance
        if code_symbol_obj.code_file: # It's a top-level function
            actual_code_file = code_symbol_obj.code_file
        elif code_symbol_obj.code_class and code_symbol_obj.code_class.code_file: # It's a method
            actual_code_file = code_symbol_obj.code_class.code_file
        else:
            print(f"ERROR: Symbol {code_symbol_obj.id} has no associated CodeFile.")
            return Response({"error": "Internal server error: Symbol has no CodeFile."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        repo_path = os.path.join(REPO_CACHE_BASE_PATH, str(actual_code_file.repository.id))
        full_file_path = os.path.join(repo_path, actual_code_file.file_path)

        if os.path.exists(full_file_path):
            with open(full_file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            # Use code_symbol_obj here
            function_code = "".join(lines[code_symbol_obj.start_line - 1 : code_symbol_obj.end_line])
            
            prompt = f"Generate a docstring for the following Python function:\\n\\n```python\\n{function_code}\\n```"
                
            response_stream = openai_stream_generator(prompt)
            return StreamingHttpResponse(response_stream, content_type='text/plain; charset=utf-8')
        else:
            print(f"DEBUG: File content not found at {full_file_path} for symbol {code_symbol_obj.name}")
            return Response({"error": "File content not found on disk."}, status=status.HTTP_404_NOT_FOUND)
class SaveDocstringView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, *args, **kwargs):
        symbol_id_from_url = kwargs.get('function_id') # Assuming URL calls it 'function_id'
                                                  # Consider renaming URL param to 'symbol_id' for clarity
        
        print(f"DEBUG: SaveDocstringView called for symbol_id: {symbol_id_from_url}, user: {request.user.username}")

        try:
            # Robust query to get the symbol and ensure ownership
            q_filter = Q(id=symbol_id_from_url) & (
                Q(code_file__repository__user=request.user) | 
                Q(code_class__code_file__repository__user=request.user)
            )
            symbol_to_update = CodeSymbol.objects.get(q_filter)
            print(f"DEBUG: Successfully fetched symbol '{symbol_to_update.name}' for saving.")

        except CodeSymbol.DoesNotExist:
            print(f"DEBUG: Symbol with ID {symbol_id_from_url} not found or permission denied for user {request.user.username}.")
            return Response({"error": "Symbol not found or permission denied."}, status=status.HTTP_404_NOT_FOUND)

        doc_text = request.data.get('documentation')
        if doc_text is None: # Check for None explicitly
            return Response({"error": "Documentation text not provided in request body."}, status=status.HTTP_400_BAD_REQUEST)

        # Update the model instance
        symbol_to_update.documentation = doc_text
        # To make the status icon green, documentation_hash should match content_hash
        # This assumes the AI generated docstring is for the current content.
        symbol_to_update.documentation_hash = symbol_to_update.content_hash 
        
        try:
            symbol_to_update.save(update_fields=['documentation', 'documentation_hash'])
            print(f"DEBUG: Successfully saved documentation for symbol ID {symbol_to_update.id}.")
        except Exception as e:
            print(f"DEBUG: Error saving symbol ID {symbol_to_update.id} to database: {e}")
            return Response({"error": "Failed to save documentation to database."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        serializer = CodeSymbolSerializer(symbol_to_update)
        return Response(serializer.data, status=status.HTTP_200_OK)
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
    

def sanitize_for_mermaid_id(text: str, prefix: str = "node_") -> str:
    """
    Sanitizes a string to be a valid Mermaid node ID.
    Mermaid IDs should be alphanumeric and can contain underscores.
    They cannot typically start with a number if unquoted, so we add a prefix.
    """
    # Replace common problematic characters (like '::', '/', '.') with underscores
    sanitized = re.sub(r'[^a-zA-Z0-9_]', '_', text)
    # Ensure it doesn't start with a number by adding a prefix
    if not sanitized: # Handle empty string case
        return f"{prefix}empty"
    return f"{prefix}{sanitized}"


@method_decorator(csrf_exempt, name='dispatch')
class GenerateArchitectureDiagramView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        symbol_id = kwargs.get('symbol_id')
        print(f"DEBUG: GenerateArchitectureDiagramView called for symbol_id: {symbol_id}")

        try:
            # Fetch the central symbol and ensure user ownership
            q_filter = Q(id=symbol_id) & (
                Q(code_file__repository__user=request.user) | 
                Q(code_class__code_file__repository__user=request.user)
            )
            central_symbol = CodeSymbol.objects.select_related(
                'code_file__repository', 
                'code_class__code_file__repository' # Ensure related fields are fetched
            ).get(q_filter)
            print(f"DEBUG: Fetched central symbol: {central_symbol.name} (ID: {central_symbol.id})")

        except CodeSymbol.DoesNotExist:
            print(f"DEBUG: Symbol with ID {symbol_id} not found or permission denied for user {request.user.username}.")
            return Response(
                {"error": "Symbol not found or permission denied."}, 
                status=status.HTTP_404_NOT_FOUND
            )

        # Fetch direct incoming calls (callers)
        incoming_deps = CodeDependency.objects.filter(callee=central_symbol).select_related('caller')
        callers = [dep.caller for dep in incoming_deps]
        print(f"DEBUG: Found {len(callers)} callers for {central_symbol.name}")

        # Fetch direct outgoing calls (callees)
        outgoing_deps = CodeDependency.objects.filter(caller=central_symbol).select_related('callee')
        callees = [dep.callee for dep in outgoing_deps]
        print(f"DEBUG: Found {len(callees)} callees for {central_symbol.name}")

        # --- Construct Mermaid.js Syntax ---
        mermaid_lines = ["graph TD;"] # Or LR
        mermaid_lines.append("    %% Default link style for brighter lines")
        mermaid_lines.append("    linkStyle default stroke:#cccccc,stroke-width:2px;")

        central_node_mermaid_id = sanitize_for_mermaid_id(central_symbol.unique_id or f"symbol_{central_symbol.id}")
        central_node_label = central_symbol.name.replace('"',"'")

        # --- Node Definitions ---
        mermaid_lines.append("    %% Node Definitions")
        # Define central node first
        mermaid_lines.append(f'    {central_node_mermaid_id}["{central_node_label}"];')
        
        # Define caller nodes (if not the central node itself, though unlikely in this simple graph)
        for caller in callers:
            caller_mermaid_id = sanitize_for_mermaid_id(caller.unique_id or f"symbol_{caller.id}")
            if caller_mermaid_id != central_node_mermaid_id: # Avoid re-defining if a symbol calls itself (edge case)
                caller_label = caller.name.replace('"',"'")
                mermaid_lines.append(f'    {caller_mermaid_id}["{caller_label}"];')

        # Define callee nodes
        for callee in callees:
            callee_mermaid_id = sanitize_for_mermaid_id(callee.unique_id or f"symbol_{callee.id}")
            if callee_mermaid_id != central_node_mermaid_id:
                callee_label = callee.name.replace('"',"'")
                mermaid_lines.append(f'    {callee_mermaid_id}["{callee_label}"];')
        mermaid_lines.append("")


        # --- Style Definitions ---
        mermaid_lines.append("    %% Style Definitions")
        # Style central node
        mermaid_lines.append(f'    style {central_node_mermaid_id} fill:#87CEEB,stroke:#00008B,stroke-width:2px,color:#000000;')
        
        # Style caller nodes
        for caller in callers:
            caller_mermaid_id = sanitize_for_mermaid_id(caller.unique_id or f"symbol_{caller.id}")
            # Only apply style if it's not the central node being styled as a caller
            if caller_mermaid_id != central_node_mermaid_id:
                 mermaid_lines.append(f'    style {caller_mermaid_id} fill:#90EE90,stroke:#006400,stroke-width:1px,color:#000000;')

        # Style callee nodes
        for callee in callees:
            callee_mermaid_id = sanitize_for_mermaid_id(callee.unique_id or f"symbol_{callee.id}")
            if callee_mermaid_id != central_node_mermaid_id:
                mermaid_lines.append(f'    style {callee_mermaid_id} fill:#FFB6C1,stroke:#8B0000,stroke-width:1px,color:#000000;')
        mermaid_lines.append("")


        # --- Edge Definitions ---
        mermaid_lines.append("    %% Edge Definitions")
        for caller in callers:
            caller_mermaid_id = sanitize_for_mermaid_id(caller.unique_id or f"symbol_{caller.id}")
            mermaid_lines.append(f'    {caller_mermaid_id} --> {central_node_mermaid_id};')
        
        for callee in callees:
            callee_mermaid_id = sanitize_for_mermaid_id(callee.unique_id or f"symbol_{callee.id}")
            mermaid_lines.append(f'    {central_node_mermaid_id} --> {callee_mermaid_id};')
        mermaid_lines.append("")


        # --- Legend ---
        mermaid_lines.append("    %% Legend")
        mermaid_lines.append("    subgraph Legend")
        mermaid_lines.append('        direction LR')
        mermaid_lines.append('        caller_legend["Caller"];') # Define node
        mermaid_lines.append('        style caller_legend fill:#90EE90,stroke:#006400,color:#000000;') # Style node
        mermaid_lines.append('        central_legend["Central Symbol"];')
        mermaid_lines.append('        style central_legend fill:#87CEEB,stroke:#00008B,color:#000000;')
        mermaid_lines.append('        callee_legend["Callee"];')
        mermaid_lines.append('        style callee_legend fill:#FFB6C1,stroke:#8B0000,color:#000000;')
        mermaid_lines.append("    end")

        mermaid_string = "\n".join(mermaid_lines)

        return Response({"mermaid_code": mermaid_string}, status=status.HTTP_200_OK)