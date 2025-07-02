# backend/repositories/views.py
import os,shutil
import subprocess
from django.db.models import Q,F  # <--- ADD THIS IMPORT
from rest_framework import generics, permissions
from .tasks import create_documentation_pr_task,batch_generate_docstrings_task # We will create this task soon
from django.utils.decorators import method_decorator
from rest_framework import viewsets
from .models import CodeFile, CodeSymbol as CodeFunction, Repository, CodeSymbol,CodeDependency,AsyncTaskStatus, Notification,CodeClass,Insight
from .ai_services import generate_class_summary_stream, generate_module_readme_stream,generate_refactor_stream # 03c03c03c NEW IMPORT
from .tasks import process_repository # Import the Celery task
import json
from .serializers import CodeSymbolSerializer, RepositorySerializer,RepositoryDetailSerializer,NotificationSerializer
from rest_framework.views import APIView
from django.views.decorators.csrf import csrf_exempt
from rest_framework.response import Response
from allauth.socialaccount.models import SocialToken
from .diagram_utils import generate_mermaid_for_symbol_dependencies
import requests,re
from django.http import HttpResponse
from django.http import StreamingHttpResponse # Import Django's native streaming class
from openai import OpenAI
import tempfile,hashlib
from rest_framework import status  # if using Django REST Framework
from .tasks import create_docs_pr_for_file_task
from .tasks import batch_generate_docstrings_for_files_task, create_pr_for_multiple_files_task # We'll define these tasks next
from .diagram_utils import generate_react_flow_data
from openai import OpenAI as OpenAIClient # Renaming to avoid conflict if you have an 'OpenAI' model
from pgvector.django import L2Distance # Or CosineDistance, MaxInnerProduct
from .serializers import CodeSymbolSerializer,AsyncTaskStatusSerializer,InsightSerializer # We can reuse this for results
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
    def delete(self, request, repo_id, *args, **kwargs):
        """
        Deletes a repository, its database records, and its cached files.
        """
        print(f"VIEW_DELETE_REPO: Request to delete repo_id: {repo_id} by user: {request.user.name}")

        try:
            # Ensure the user owns the repository they are trying to delete
            repo = Repository.objects.get(id=repo_id, user=request.user)
        except Repository.DoesNotExist:
            return Response(
                {"error": "Repository not found or permission denied."},
                status=status.HTTP_404_NOT_FOUND
            )

        repo_full_name = repo.full_name
        repo_path = os.path.join(REPO_CACHE_BASE_PATH, str(repo.id))

        # --- Perform Deletion ---
        try:
            # 1. Delete the database record.
            #    Django's on_delete=models.CASCADE will automatically delete all related
            #    CodeFile, CodeClass, CodeSymbol, Insight, Notification, KnowledgeChunk, etc.
            repo.delete()
            print(f"VIEW_DELETE_REPO: Successfully deleted repository record for '{repo_full_name}' from database.")

            # 2. Delete the cached repository from the filesystem.
            if os.path.exists(repo_path):
                shutil.rmtree(repo_path)
                print(f"VIEW_DELETE_REPO: Successfully deleted cached files at '{repo_path}'.")

            return Response(
                {"message": f"Repository '{repo_full_name}' and all its data have been successfully deleted."},
                status=status.HTTP_204_NO_CONTENT # 204 is the standard for successful deletion
            )

        except Exception as e:
            # This is a critical error state, as the DB record might be gone
            # but the files might remain.
            error_message = f"An error occurred during deletion of '{repo_full_name}': {str(e)}"
            print(f"VIEW_DELETE_REPO: CRITICAL ERROR - {error_message}")
            return Response({"error": error_message}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
            
def openai_stream_generator(prompt: str, openai_client_instance: OpenAIClient | None):
    if not openai_client_instance:
        print("STREAM_GEN: OpenAI client not available in generator.")
        yield "// Error: OpenAI service not configured for streaming.\n"
        return
    
    # print(f"DEBUG_AI_PROMPT (Contextual Stream - in generator):\n{prompt}\n--------------------") # Moved from view

    try:
        stream = openai_client_instance.chat.completions.create(
            model="gpt-4.1-mini", # Or your preferred model
            messages=[
                {"role": "system", "content": "You are a helpful AI programming assistant specialized in writing Python docstrings."},
                {"role": "user", "content": prompt} # The full prompt is now constructed in the view
            ],
            stream=True,
        )
        for chunk in stream:
            content = chunk.choices[0].delta.content
            if content:
                yield content
    except Exception as e:
        error_message = f"// Error during OpenAI stream: {str(e)}\n"
        print(f"STREAM_GEN: {error_message}")
        yield error_message
def get_source_for_symbol_from_view(symbol_obj: CodeSymbol) -> str | None:
    actual_code_file = None
    if symbol_obj.code_file:
        actual_code_file = symbol_obj.code_file
    elif symbol_obj.code_class and symbol_obj.code_class.code_file:
        actual_code_file = symbol_obj.code_class.code_file
    else:
        print(f"ERROR_HELPER_VIEW: Symbol {symbol_obj.id} ({symbol_obj.name}) has no associated CodeFile.")
        return None

    if not REPO_CACHE_BASE_PATH:
        print("ERROR_HELPER_VIEW: REPO_CACHE_BASE_PATH is not defined.")
        return None

    repo_path_for_file = os.path.join(REPO_CACHE_BASE_PATH, str(actual_code_file.repository.id))
    full_file_path_for_file = os.path.join(repo_path_for_file, actual_code_file.file_path)

    if os.path.exists(full_file_path_for_file):
        try:
            with open(full_file_path_for_file, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            if symbol_obj.start_line > 0 and \
               symbol_obj.end_line >= symbol_obj.start_line and \
               symbol_obj.end_line <= len(lines):
                symbol_code_lines = lines[symbol_obj.start_line - 1 : symbol_obj.end_line]
                return "".join(symbol_code_lines)
            else:
                print(f"WARNING_HELPER_VIEW: Invalid line numbers for {symbol_obj.unique_id or symbol_obj.name}")
                return f"# Error: Invalid line numbers ({symbol_obj.start_line}-{symbol_obj.end_line})."
        except Exception as e:
            print(f"ERROR_HELPER_VIEW: Error reading file for {symbol_obj.unique_id or symbol_obj.name}: {e}")
            return f"# Error reading file: {e}"
    else:
        print(f"WARNING_HELPER_VIEW: File not found in cache for {symbol_obj.unique_id or symbol_obj.name}: {full_file_path_for_file}")
        return "# Error: Source file not found in cache."
    return None

@method_decorator(csrf_exempt, name='dispatch')
class GenerateDocstringView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        function_id = kwargs.get('function_id') # Assuming URL uses 'function_id'
        print(f"VIEW_GEN_DOC: Request for symbol_id={function_id}, user={request.user.username}")

        # --- Initialize OpenAI Client ---
        openai_client = OPENAI_CLIENT_INSTANCE
        
        # If client init fails critically, it's better to stop and inform.
        if not openai_client:
             # Return a non-streaming error response
            return Response({"error": "OpenAI service not available or not configured."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        try:
            # Your existing Q filter for ownership check
            q_filter = Q(id=function_id) & (
                Q(code_file__repository__user=request.user) | 
                Q(code_class__code_file__repository__user=request.user)
            )
            code_symbol_obj = CodeSymbol.objects.select_related(
                'code_file__repository', 
                'code_class__code_file__repository'
            ).get(q_filter)
            print(f"VIEW_GEN_DOC: Successfully fetched symbol '{code_symbol_obj.name}' (ID: {code_symbol_obj.id}).")

        except CodeSymbol.DoesNotExist:
            print(f"VIEW_GEN_DOC: Symbol with ID {function_id} not found or permission denied for user {request.user.username}.")
            return Response({"error": "Symbol not found or permission denied."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"VIEW_GEN_DOC: Error fetching symbol {function_id}: {e}")
            return Response({"error": "Internal server error fetching symbol."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # --- Fetch symbol's source code ---
        # (Using the corrected variable name `code_symbol_obj` from your provided code)
        function_code = get_source_for_symbol_from_view(code_symbol_obj) # Use your helper
        
        if not function_code or function_code.startswith("# Error:"):
            error_msg = function_code or "Could not retrieve source code for the symbol."
            print(f"VIEW_GEN_DOC: {error_msg} for symbol {code_symbol_obj.name}")
            # Return non-streaming error
            return Response({"error": error_msg}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # --- NEW: Fetch Callers and Callees for Context ---
        callers_qs = CodeDependency.objects.filter(callee=code_symbol_obj).select_related('caller')[:3] # Limit for prompt
        callees_qs = CodeDependency.objects.filter(caller=code_symbol_obj).select_related('callee')[:3] # Limit for prompt
        
        callers_names = [dep.caller.name for dep in callers_qs]
        callees_names = [dep.callee.name for dep in callees_qs]
        
        symbol_file_path_for_prompt = "N/A"
        actual_code_file = code_symbol_obj.code_file or (code_symbol_obj.code_class and code_symbol_obj.code_class.code_file)
        if actual_code_file:
            symbol_file_path_for_prompt = actual_code_file.file_path
        
        print(f"VIEW_GEN_DOC: Context for '{code_symbol_obj.name}': Callers: {callers_names}, Callees: {callees_names}, File: {symbol_file_path_for_prompt}")

        # --- Construct the full prompt with context ---
        context_parts = []
        if callers_names:
            context_parts.append(f"it is called by: {', '.join(callers_names)}{'...' if len(callers_names) > 3 else ''}") # Though already sliced
        if callees_names:
            context_parts.append(f"it calls: {', '.join(callees_names)}{'...' if len(callees_names) > 3 else ''}")
        
        context_str_for_prompt = ""
        if context_parts:
            context_str_for_prompt = f"\n\nFor context, this symbol " + " and ".join(context_parts) + "."

        # Your original prompt structure, now with added context
        prompt = (
            f"You are an expert Python programmer. Your task is to write a concise, professional, "
            f"Google-style docstring for the Python symbol named '{code_symbol_obj.name}' located in file '{symbol_file_path_for_prompt}'. "
            f"Do not include the function/method signature itself, only the docstring content inside triple quotes. "
            f"Start with a one-line summary. Then, if applicable, describe arguments and what it returns."
            f"{context_str_for_prompt}\n\n"
            f"Here is the source code for '{code_symbol_obj.name}':\n"
            f"```python\n{function_code}\n```\n"
            f"Generate only the docstring content:"
        )
        
        # --- Stream the Response using the generator ---
        # Pass the initialized openai_client to the generator
        response_stream = openai_stream_generator(prompt, openai_client) 
        return StreamingHttpResponse(response_stream, content_type='text/plain; charset=utf-8')
class SaveDocstringView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        symbol_id = kwargs.get('function_id') # Or 'symbol_id' if your URL uses that
        
        print(f"VIEW_SAVE_DOC: SaveDocstringView called for symbol_id: {symbol_id}, user: {request.user.username}")

        try:
            q_filter = Q(id=symbol_id) & (
                Q(code_file__repository__user=request.user) | 
                Q(code_class__code_file__repository__user=request.user)
            )
            symbol = CodeSymbol.objects.select_related( # Select related for serializer efficiency
                'code_file__repository', 
                'code_class__code_file__repository'
            ).get(q_filter)
        except CodeSymbol.DoesNotExist:
            return Response({"error": "Symbol not found or permission denied."}, status=status.HTTP_404_NOT_FOUND)

        new_doc_text_from_request = request.data.get('documentation_text')
        if new_doc_text_from_request is None: # Check for key presence
            return Response({"error": "'documentation_text' field not provided in request body."}, status=status.HTTP_400_BAD_REQUEST)

        new_doc_text = new_doc_text_from_request.strip() # Clean it

        symbol.documentation = new_doc_text
        
        # Determine documentation_hash and documentation_status
        if new_doc_text: # If there is some documentation text
            if symbol.content_hash:
                # This is the ideal case: documentation exists and code content exists
                symbol.documentation_hash = symbol.content_hash 
                symbol.documentation_status = CodeSymbol.DocStatus.FRESH
                print(f"VIEW_SAVE_DOC: Symbol {symbol.id} marked as FRESH. DocHash matches ContentHash.")
            else:
                # Documentation exists, but the symbol's code content_hash is missing.
                # This is unusual after `process_repository` but handle defensively.
                # We can't mark it FRESH, so hash the doc itself and mark for review.
                hasher = hashlib.sha256()
                hasher.update(new_doc_text.encode('utf-8'))
                symbol.documentation_hash = hasher.hexdigest()
                symbol.documentation_status = CodeSymbol.DocStatus.PENDING_REVIEW # Or a custom status
                print(f"VIEW_SAVE_DOC: Warning - Symbol {symbol.id} has no content_hash. Hashing doc text itself. Status: PENDING_REVIEW.")
        else: # Documentation text is empty (user cleared it)
            symbol.documentation_hash = None
            symbol.documentation_status = CodeSymbol.DocStatus.NONE
            print(f"VIEW_SAVE_DOC: Symbol {symbol.id} documentation cleared. Status: NONE.")
        
        update_fields_list = ['documentation', 'documentation_hash', 'documentation_status']
        # No need for hasattr check if documentation_status is now a permanent field on CodeSymbol

        try:
            symbol.save(update_fields=update_fields_list)
            # Serialize the updated symbol to send back to the frontend
            # This ensures the frontend gets the latest hashes and status
            serializer = CodeSymbolSerializer(symbol) 
            print(f"VIEW_SAVE_DOC: Successfully saved documentation and status for symbol {symbol.id}")
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            print(f"VIEW_SAVE_DOC: Error saving documentation for symbol {symbol.id}: {e}")
            return Response({"error": "Failed to save documentation."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
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
    
@method_decorator(csrf_exempt, name='dispatch')
class GenerateArchitectureDiagramView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        symbol_id = kwargs.get('symbol_id')
        print(f"VIEW_GEN_DIAGRAM: Request for symbol_id: {symbol_id}, user: {request.user.username}")

        try:
            q_filter = Q(id=symbol_id) & (Q(code_file__repository__user=request.user) | Q(code_class__code_file__repository__user=request.user))
            central_symbol = CodeSymbol.objects.select_related('code_file__repository', 'code_class__code_file__repository').get(q_filter)
        except CodeSymbol.DoesNotExist:
            return Response({"error": "Symbol not found or permission denied."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"VIEW_GEN_DIAGRAM: Error fetching symbol {symbol_id}: {e}")
            return Response({"error": "Server error fetching symbol."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


        # Fetch direct incoming calls (callers)
        # Ensure we select related 'caller' to get the full CodeSymbol object for the caller
        incoming_deps = CodeDependency.objects.filter(callee=central_symbol).select_related('caller')
        callers = [dep.caller for dep in incoming_deps]
        outgoing_deps = CodeDependency.objects.filter(caller=central_symbol).select_related('callee')
        callees = [dep.callee for dep in outgoing_deps]

        try:
            react_flow_data = generate_react_flow_data(central_symbol, callers, callees)
            return Response(react_flow_data, status=status.HTTP_200_OK)
        except Exception as e:
            print(f"VIEW_GEN_DIAGRAM_REACTFLOW: Error generating React Flow data: {e}")
            import traceback
            traceback.print_exc()
            return Response({"error": "Failed to generate diagram data for React Flow."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)  
@method_decorator(csrf_exempt, name='dispatch')
class BatchGenerateDocsForFileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs): # Use POST for actions
        code_file_id = kwargs.get('code_file_id')
        user_id = request.user.id # Get user ID from the authenticated request

        print(f"BatchGenerateDocsForFileView: Received request for file_id: {code_file_id} from user_id: {user_id}")

        try:
            # Verify user has access to this code_file by checking ownership of the repository
            code_file_exists = CodeFile.objects.filter(id=code_file_id, repository__user=request.user).exists()
            if not code_file_exists:
                print(f"Permission denied or file not found for file_id: {code_file_id}, user_id: {user_id}")
                return Response(
                    {"error": "File not found or permission denied."},
                    status=status.HTTP_404_NOT_FOUND
                )
        except Exception as e: # Catch any other potential errors during DB query
            print(f"Error checking CodeFile existence for file_id {code_file_id}: {e}")
            return Response({"error": "Server error checking file permissions."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Trigger the Celery task
        try:
            task_result = batch_generate_docstrings_task.delay(code_file_id, user_id)
            print(f"Dispatched batch_generate_docstrings_task for file_id: {code_file_id}, task_id: {task_result.id}")
            
            return Response(
                {"message": "Batch documentation generation initiated for file.", "task_id": task_result.id},
                status=status.HTTP_202_ACCEPTED
            )
        except Exception as e: # Catch errors during task dispatch
            print(f"Error dispatching Celery task for file_id {code_file_id}: {e}")
            return Response({"error": "Failed to initiate batch generation task."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
@method_decorator(csrf_exempt, name='dispatch')
class CreateBatchDocsPRView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        code_file_id = kwargs.get('code_file_id')
        user_id = request.user.id

        try:
            code_file = CodeFile.objects.get(id=code_file_id, repository__user=request.user)
        except CodeFile.DoesNotExist:
            return Response(
                {"error": "File not found or permission denied."},
                status=status.HTTP_404_NOT_FOUND
            )

        task_result = create_docs_pr_for_file_task.delay(code_file_id, user_id)
        print(f"Dispatched create_docs_pr_for_file_task for file_id: {code_file_id}, task_id: {task_result.id}")
        
        return Response(
            {"message": "Pull Request creation for file documentation initiated.", "task_id": task_result.id},
            status=status.HTTP_202_ACCEPTED
        )
        
@method_decorator(csrf_exempt, name='dispatch')
class BatchGenerateDocsForSelectedFilesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        repo_id = kwargs.get('repo_id')
        user_id = request.user.id
        file_ids_from_request = request.data.get('file_ids')

        print(f"VIEW_BATCH_DOCS: Request for repo_id={repo_id}, user_id={user_id}, file_ids={file_ids_from_request}")

        if not isinstance(file_ids_from_request, list) or not file_ids_from_request:
            return Response({"error": "A non-empty list of 'file_ids' is required in the request body."}, 
                            status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Ensure all file_ids are integers
            file_ids = [int(fid) for fid in file_ids_from_request]
        except ValueError:
            return Response({"error": "'file_ids' must be a list of integers."}, 
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            # Verify user owns the repository
            repo = Repository.objects.get(id=repo_id, user_id=user_id)
            
            # Verify all file_ids belong to this repository and actually exist
            # This ensures data integrity before dispatching the task
            valid_files_query = CodeFile.objects.filter(id__in=file_ids, repository=repo)
            if valid_files_query.count() != len(set(file_ids)): # Use set to handle potential duplicates in input
                 # Find which IDs are problematic for a more specific error (optional enhancement)
                print(f"VIEW_BATCH_DOCS: Validation failed. Expected {len(set(file_ids))} valid files, found {valid_files_query.count()}.")
                return Response({"error": "One or more file IDs are invalid, do not belong to the specified repository, or were not found."}, 
                                 status=status.HTTP_400_BAD_REQUEST)
        except Repository.DoesNotExist:
            print(f"VIEW_BATCH_DOCS: Repository {repo_id} not found or permission denied for user {user_id}.")
            return Response({"error": "Repository not found or permission denied."}, 
                            status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"VIEW_BATCH_DOCS: Error during pre-task checks for repo {repo_id}: {e}")
            return Response({"error": "Server error during pre-task validation."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Dispatch the Celery task
        try:
            # Pass the validated list of unique file IDs
            task_result = batch_generate_docstrings_for_files_task.delay(repo_id, user_id, list(set(file_ids)))
            print(f"VIEW_BATCH_DOCS: Dispatched batch_generate_docstrings_for_files_task for repo_id: {repo_id}, file_ids: {list(set(file_ids))}, task_id: {task_result.id}")
            return Response(
                {"message": "Batch documentation generation for selected files initiated.", "task_id": task_result.id},
                status=status.HTTP_202_ACCEPTED
            )
        except Exception as e:
            print(f"VIEW_BATCH_DOCS: Error dispatching Celery task for repo {repo_id}: {e}")
            return Response({"error": "Failed to initiate batch documentation generation task."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@method_decorator(csrf_exempt, name='dispatch')
class CreateBatchPRForSelectedFilesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        repo_id = kwargs.get('repo_id')
        user_id = request.user.id
        file_ids_from_request = request.data.get('file_ids')

        print(f"VIEW_BATCH_PR: Request for repo_id={repo_id}, user_id={user_id}, file_ids={file_ids_from_request}")

        if not isinstance(file_ids_from_request, list) or not file_ids_from_request:
            return Response({"error": "A non-empty list of 'file_ids' is required for PR creation."}, 
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            file_ids = [int(fid) for fid in file_ids_from_request]
        except ValueError:
            return Response({"error": "'file_ids' must be a list of integers for PR."}, 
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            repo = Repository.objects.get(id=repo_id, user_id=user_id)
            valid_files_query = CodeFile.objects.filter(id__in=file_ids, repository=repo)
            if valid_files_query.count() != len(set(file_ids)):
                 print(f"VIEW_BATCH_PR: Validation failed for PR. Expected {len(set(file_ids))} valid files, found {valid_files_query.count()}.")
                 return Response({"error": "One or more file IDs are invalid or do not belong to the specified repository for PR."}, 
                                 status=status.HTTP_400_BAD_REQUEST)
        except Repository.DoesNotExist:
            print(f"VIEW_BATCH_PR: Repository {repo_id} not found or permission denied for user {user_id} for PR.")
            return Response({"error": "Repository not found or permission denied for PR."}, 
                            status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"VIEW_BATCH_PR: Error during pre-task checks for repo {repo_id} for PR: {e}")
            return Response({"error": "Server error during pre-PR validation."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            task_result = create_pr_for_multiple_files_task.delay(repo_id, user_id, list(set(file_ids)))
            print(f"VIEW_BATCH_PR: Dispatched create_pr_for_multiple_files_task for repo_id: {repo_id}, file_ids: {list(set(file_ids))}, task_id: {task_result.id}")
            return Response(
                {"message": "Batch PR creation for selected files initiated.", "task_id": task_result.id},
                status=status.HTTP_202_ACCEPTED
            )
        except Exception as e:
            print(f"VIEW_BATCH_PR: Error dispatching Celery task for PR (repo {repo_id}): {e}")
            return Response({"error": "Failed to initiate batch PR creation task."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
@method_decorator(csrf_exempt, name='dispatch')
class TaskStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, task_id, *args, **kwargs):
        print(f"VIEW_TASK_STATUS: Request for task_id={task_id}, user={request.user.username}")
        try:
            # Fetch the task status, ensuring it belongs to the requesting user
            task_status = AsyncTaskStatus.objects.get(task_id=task_id, user=request.user)
            serializer = AsyncTaskStatusSerializer(task_status)
            return Response(serializer.data)
        except AsyncTaskStatus.DoesNotExist:
            print(f"VIEW_TASK_STATUS: AsyncTaskStatus with task_id={task_id} not found for user {request.user.username}.")
            return Response({"error": "Task not found or permission denied."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"VIEW_TASK_STATUS: Error fetching task status for task_id={task_id}: {e}")
            return Response({"error": "An error occurred while fetching task status."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)   
        

@method_decorator(csrf_exempt, name='dispatch')
class ApproveDocstringView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, symbol_id, *args, **kwargs): # Use POST as it modifies data
        print(f"VIEW_APPROVE_DOC: Request for symbol_id={symbol_id}, user={request.user.username}")
        try:
            # Ensure user owns the symbol
            q_filter = Q(id=symbol_id) & (
                Q(code_file__repository__user=request.user) | 
                Q(code_class__code_file__repository__user=request.user)
            )
            symbol = CodeSymbol.objects.get(q_filter)
        except CodeSymbol.DoesNotExist:
            return Response({"error": "Symbol not found or permission denied."}, status=status.HTTP_404_NOT_FOUND)

        new_doc_text = request.data.get('documentation_text')
        if new_doc_text is None: # Allow empty string to clear doc, but require the key
            return Response({"error": "'documentation_text' not provided."}, status=status.HTTP_400_BAD_REQUEST)

        new_doc_text = new_doc_text.strip() # Clean it

        symbol.documentation = new_doc_text
        
        # "Blessing" means this documentation is now considered correct for the current code content.
        # So, documentation_hash should match content_hash.
        if new_doc_text and symbol.content_hash: # Only if there's content and a hash to match
            symbol.documentation_hash = symbol.content_hash 
            symbol.documentation_status = CodeSymbol.DocStatus.HUMAN_EDITED_PENDING_PR # Or a more generic 'APPROVED'
        elif not new_doc_text: # If doc was cleared
            symbol.documentation_hash = None
            symbol.documentation_status = CodeSymbol.DocStatus.NONE
        else: # Has new doc text, but no content_hash for the symbol (should not happen ideally)
            # Fallback: hash the new doc text itself if no content_hash to match
            hasher = hashlib.sha256()
            hasher.update(new_doc_text.encode('utf-8'))
            symbol.documentation_hash = hasher.hexdigest()
            symbol.documentation_status = CodeSymbol.DocStatus.HUMAN_EDITED_PENDING_PR
            print(f"VIEW_APPROVE_DOC: Warning - Symbol {symbol.id} has no content_hash. Hashing doc text itself.")


        try:
            symbol.save(update_fields=['documentation', 'documentation_hash', 'documentation_status'])
            serializer = CodeSymbolSerializer(symbol) # Assuming you have this serializer
            print(f"VIEW_APPROVE_DOC: Approved/updated doc for symbol {symbol.id}")
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            print(f"VIEW_APPROVE_DOC: Error saving approved doc for symbol {symbol.id}: {e}")
            return Response({"error": "Failed to save approved documentation."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
@method_decorator(csrf_exempt, name='dispatch')
class UserNotificationsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        # Get unread notifications, newest first, limit to e.g., 20
        notifications = Notification.objects.filter(user=request.user, is_read=False).order_by('-created_at')[:20]
        serializer = NotificationSerializer(notifications, many=True)
        unread_count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({"notifications": serializer.data, "unread_count": unread_count})

@method_decorator(csrf_exempt, name='dispatch')
class MarkNotificationReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, notification_id, *args, **kwargs): # POST to change state
        try:
            notification = Notification.objects.get(id=notification_id, user=request.user)
            notification.is_read = True
            notification.save(update_fields=['is_read'])
            return Response({"message": "Notification marked as read."}, status=status.HTTP_200_OK)
        except Notification.DoesNotExist:
            return Response({"error": "Notification not found or permission denied."}, status=status.HTTP_404_NOT_FOUND)

def generate_explanation_stream(
    symbol_obj: CodeSymbol, 
    source_code: str, 
    openai_client: OpenAIClient
):
    """
    Generates a stream of text chunks for the code explanation.
    """
    callers_qs = CodeDependency.objects.filter(callee=symbol_obj).select_related('caller')[:3] # Limit for prompt
    callees_qs = CodeDependency.objects.filter(caller=symbol_obj).select_related('callee')[:3] # Limit for prompt

    callers_names = [dep.caller.name for dep in callers_qs]
    callees_names = [dep.callee.name for dep in callees_qs]

    symbol_file_path = symbol_obj.code_file.file_path if symbol_obj.code_file else \
                       (symbol_obj.code_class.code_file.file_path if symbol_obj.code_class and symbol_obj.code_class.code_file else "N/A")
    
    symbol_kind = "method" if symbol_obj.code_class else "function"

    context_parts = []
    if callers_names:
        context_parts.append(f"- Is typically called by: {', '.join(callers_names)}")
    if callees_names:
        context_parts.append(f"- It calls the following: {', '.join(callees_names)}")
    if symbol_obj.documentation and symbol_obj.documentation.strip():
        # Limit doc length for prompt
        doc_preview = (symbol_obj.documentation[:200] + '...') if len(symbol_obj.documentation) > 200 else symbol_obj.documentation
        context_parts.append(f"- Its existing documentation says: \"{doc_preview}\"")

    context_str = ""
    if context_parts:
        context_str = f"\n\nFor context, this {symbol_kind}:\n" + "\n".join(context_parts)

    prompt = (
        f"You are Helix, an expert programming assistant. Your task is to explain a Python {symbol_kind} named `{symbol_obj.name}` "
        f"from the file `{symbol_file_path}`.\n\n"
        f"Explain it in simple, clear terms, as if to a developer who is new to this part of the codebase. "
        f"Focus on its primary purpose and what it achieves. Start with a one or two-sentence summary. "
        f"Then, briefly describe its key steps or logic. Avoid overly technical jargon unless essential. "
        f"Do not repeat the code itself in your explanation. Aim for about 2-4 paragraphs."
        f"{context_str}\n\n"
        f"Here is the source code:\n```python\n{source_code}\n```\n\n"
        f"Helix's Explanation:"
    )
    
    print(f"DEBUG_EXPLAIN_PROMPT: For symbol {symbol_obj.id}\n{prompt}\n--------------------")

    try:
        stream = openai_client.chat.completions.create(
            model="gpt-4.1-nano", # e.g., "gpt-3.5-turbo" or "gpt-4"
            messages=[
                {"role": "system", "content": "You are Helix, a helpful AI programming assistant that explains code clearly and concisely."},
                {"role": "user", "content": prompt}
            ],
            stream=True,
            temperature=0.3, # Lower temperature for more factual explanations
            max_tokens=1000  # Adjust as needed for desired explanation length
        )
        for chunk in stream:
            content = chunk.choices[0].delta.content
            if content:
                yield content
    except Exception as e:
        error_message = f"// Helix encountered an error while generating the explanation: {str(e)}"
        print(f"EXPLAIN_CODE_STREAM_ERROR: {error_message}")
        # Stream error message in a way the frontend can parse if it expects text
        # Or handle more gracefully if frontend expects structured errors
        yield error_message


@method_decorator(csrf_exempt, name='dispatch') # If using SessionAuth and POST
class ExplainCodeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, symbol_id, *args, **kwargs): # Changed to POST as it's an action
        print(f"VIEW_EXPLAIN_CODE: Request for symbol_id: {symbol_id} by user: {request.user.username}")

        openai_client = OPENAI_CLIENT_INSTANCE

        
        if not openai_client:
            # Return a non-streaming error if client setup fails
            return Response(
                {"error": "Helix's explanation service is currently unavailable."}, 
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        try:
            q_filter = Q(id=symbol_id) & (
                Q(code_file__repository__user=request.user) |
                Q(code_class__code_file__repository__user=request.user)
            )
            symbol_obj = CodeSymbol.objects.select_related(
                'code_file__repository', 
                'code_class__code_file__repository'
            ).get(q_filter)
        except CodeSymbol.DoesNotExist:
            return Response(
                {"error": "Symbol not found or permission denied."}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        source_code = symbol_obj.source_code # Use your existing helper
        if not source_code or source_code.startswith("# Error:"):
            error_msg = source_code if source_code else "Could not retrieve source code for the symbol."
            print(f"VIEW_EXPLAIN_CODE: {error_msg} for symbol {symbol_obj.name}")
            return Response({"error": error_msg}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Check if source_code is just an error message from the helper
        if source_code.strip().startswith("# Error:"):
             print(f"VIEW_EXPLAIN_CODE: Source code retrieval failed: {source_code} for symbol {symbol_obj.name}")
             return Response({"error": f"Helix could not retrieve valid source code: {source_code}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


        response_stream = generate_explanation_stream(symbol_obj, source_code, openai_client)
        
        # It's good practice to set appropriate headers for streaming
        response = StreamingHttpResponse(response_stream, content_type='text/plain; charset=utf-8')
        response['X-Accel-Buffering'] = 'no'  # Useful for Nginx to disable buffering
        response['Cache-Control'] = 'no-cache'
        return response
    


def generate_tests_stream(
    symbol_obj: CodeSymbol,
    source_code: str,
    openai_client: OpenAIClient
):
    """
    Generates a stream of pytest code for the given symbol.
    """
    symbol_file_path = symbol_obj.code_file.file_path if symbol_obj.code_file else \
                       (symbol_obj.code_class.code_file.file_path if symbol_obj.code_class and symbol_obj.code_class.code_file else "N/A")
    
    symbol_kind = "method" if symbol_obj.code_class else "function"
    
    context_parts = []
    if symbol_obj.code_class:
        context_parts.append(f"It is a method of the class `{symbol_obj.code_class.name}`.")
    if symbol_obj.documentation and symbol_obj.documentation.strip():
        doc_preview = (symbol_obj.documentation[:250] + '...') if len(symbol_obj.documentation) > 250 else symbol_obj.documentation
        context_parts.append(f"Its documentation says: \"{doc_preview}\"")

    context_str = " ".join(context_parts)

    prompt = (
        f"You are Helix, an expert Python developer and QA engineer specialized in writing comprehensive unit tests using the `pytest` framework.\n\n"
        f"Your task is to analyze the provided Python {symbol_kind} and suggest 3 to 5 critical unit test cases. For each case, provide complete, runnable `pytest` code.\n\n"
        f"The {symbol_kind} is named `{symbol_obj.name}` and is located in `{symbol_file_path}`. {context_str}\n\n"
        f"Here is its source code:\n```python\n{source_code}\n```\n\n"
        f"Instructions:\n"
        f"1. Focus on testing the 'happy path,' common edge cases (e.g., empty lists, zero, None values), and potential error conditions.\n"
        f"2. The generated code should be a single, complete Python code block. Do not add any explanation outside of the code block.\n"
        f"3. Assume necessary imports like `pytest` are available. For the code under test, assume it can be imported (e.g., `from {symbol_file_path.replace('.py', '').replace('/', '.')} import {symbol_obj.code_class.name if symbol_obj.code_class else symbol_obj.name}`).\n"
        f"4. If the function is a method of a class, show how to instantiate the class in the test.\n"
        f"5. Use clear and descriptive test function names, like `test_{symbol_obj.name}_[condition_being_tested]`.\n"
        f"6. Use `assert` statements to check for expected outcomes. For expected errors, use `pytest.raises`.\n\n"
        f"Generate the complete `pytest` code now:"
    )

    print(f"DEBUG_SUGGEST_TESTS_PROMPT: For symbol {symbol_obj.id}\n{prompt}\n--------------------")

    try:
        stream = openai_client.chat.completions.create(
            model="gpt-4.1-mini", # "gpt-4-turbo-preview" is great for code
            messages=[
                {"role": "system", "content": "You are a helpful AI programming assistant that writes Python unit tests using pytest."},
                {"role": "user", "content": prompt}
            ],
            stream=True,
            temperature=0.4, # A bit of creativity for edge cases, but still factual
            max_tokens=1500  # Allow for longer code blocks
        )
        for chunk in stream:
            content = chunk.choices[0].delta.content
            if content:
                yield content
    except Exception as e:
        error_message = f"// Helix encountered an error while generating test suggestions: {str(e)}"
        print(f"SUGGEST_TESTS_STREAM_ERROR: {error_message}")
        yield error_message


# --- NEW VIEW CLASS ---
@method_decorator(csrf_exempt, name='dispatch')
class SuggestTestsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, symbol_id, *args, **kwargs):
        print(f"VIEW_SUGGEST_TESTS: Request for symbol_id: {symbol_id} by user: {request.user.username}")

        openai_client = OPENAI_CLIENT_INSTANCE
        
        if not openai_client:
            return Response(
                {"error": "Helix's AI service is currently unavailable."}, 
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        try:
            q_filter = Q(id=symbol_id) & (
                Q(code_file__repository__user=request.user) |
                Q(code_class__code_file__repository__user=request.user)
            )
            symbol_obj = CodeSymbol.objects.select_related(
                'code_file', 
                'code_class'
            ).get(q_filter)
        except CodeSymbol.DoesNotExist:
            return Response(
                {"error": "Symbol not found or permission denied."}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        source_code = get_source_for_symbol_from_view(symbol_obj)
        if not source_code or source_code.strip().startswith("# Error:"):
            error_msg = source_code if source_code else "Could not retrieve source code for the symbol."
            print(f"VIEW_SUGGEST_TESTS: {error_msg} for symbol {symbol_obj.name}")
            return Response({"error": f"Helix could not retrieve valid source code: {source_code}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        response_stream = generate_tests_stream(symbol_obj, source_code, openai_client)
        
        response = StreamingHttpResponse(response_stream, content_type='text/plain; charset=utf-8')
        response['X-Accel-Buffering'] = 'no'
        response['Cache-Control'] = 'no-cache'
        return response
    
@method_decorator(csrf_exempt, name='dispatch')
class ClassSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, class_id, *args, **kwargs):
        print(f"VIEW_CLASS_SUMMARY: Request for class_id: {class_id} by user: {request.user.username}")

        openai_client = OPENAI_CLIENT_INSTANCE

        
        if not openai_client:
            return Response({"error": "Helix's AI service is currently unavailable."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        try:
            # Check ownership via the file the class belongs to
            code_class_obj = CodeClass.objects.select_related(
                'code_file__repository__user'
            ).get(
                id=class_id,
                code_file__repository__user=request.user
            )
        except CodeClass.DoesNotExist:
            return Response({"error": "Class not found or permission denied."}, status=status.HTTP_404_NOT_FOUND)
        
        response_stream = generate_class_summary_stream(code_class_obj, openai_client)
        
        response = StreamingHttpResponse(response_stream, content_type='text/plain; charset=utf-8')
        response['X-Accel-Buffering'] = 'no'
        response['Cache-Control'] = 'no-cache'
        return response
    
@method_decorator(csrf_exempt, name='dispatch')
class ReprocessRepositoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, repo_id, *args, **kwargs):
        """
        Triggers a Celery task to re-process a repository.
        """
        print(f"VIEW_REPROCESS_REPO: Request for repo_id: {repo_id} by user: {request.user.username}")
        
        try:
            # Ensure the user owns the repository they are trying to reprocess
            repo = Repository.objects.get(id=repo_id, user=request.user)
        except Repository.DoesNotExist:
            return Response(
                {"error": "Repository not found or permission denied."}, 
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if the repository is already being processed to avoid duplicate tasks
        if repo.status == Repository.Status.INDEXING:
            return Response(
                {"message": f"Repository '{repo.full_name}' is already being processed."},
                status=status.HTTP_409_CONFLICT # 409 Conflict is a good status for this
            )
        
        # Update status immediately to provide instant feedback in the UI
        repo.status = Repository.Status.PENDING
        repo.save(update_fields=['status'])

        # Dispatch the Celery task
        task = process_repository.delay(repo_id=repo.id)
        
        print(f"VIEW_REPROCESS_REPO: Dispatched process_repository task {task.id} for repo {repo.id}")

        # Return the task ID so the frontend can potentially monitor it
        return Response(
            {"message": f"Re-processing for '{repo.full_name}' has been initiated.", "task_id": task.id},
            status=status.HTTP_202_ACCEPTED # 202 Accepted is perfect for async task initiation
        )
class RepositoryInsightsView(generics.ListAPIView):
    """
    Returns a paginated list of insights for a given repository.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = InsightSerializer
    # Optional: Add pagination
    # from rest_framework.pagination import PageNumberPagination
    # pagination_class = PageNumberPagination

    def get_queryset(self):
        repo_id = self.kwargs.get('repo_id')
        # Ensure user owns the repo they are requesting insights for
        if not Repository.objects.filter(id=repo_id, user=self.request.user).exists():
            return Insight.objects.none() # Return empty queryset if no permission
        
        return Insight.objects.filter(repository_id=repo_id).order_by('-created_at')

class CommitHistoryView(APIView):
    """
    Returns the commit history for a given repository by running git log,
    formatted to match the frontend's expected CommitNode structure.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, repo_id, *args, **kwargs):
        print(f"VIEW_COMMIT_HISTORY: Request for repo_id: {repo_id} by user: {request.user.username}")

        try:
            repo = Repository.objects.get(id=repo_id, user=request.user)
        except Repository.DoesNotExist:
            return Response(
                {"error": "Repository not found or permission denied."},
                status=status.HTTP_404_NOT_FOUND
            )

        repo_path = os.path.join(REPO_CACHE_BASE_PATH, str(repo.id))

        if not os.path.isdir(os.path.join(repo_path, '.git')):
            return Response(
                {"error": "Repository cache not found on server. Please re-process the repository."},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            # This format string is designed to be parsed into the desired JSON structure.
            # We use a unique, unlikely separator to split commits reliably.
            # We capture parent hashes in a single string, which we will split later.
            # %H: commit hash, %an: author name, %aI: author date (ISO 8601), %s: subject, %P: parent hashes
            log_format = '{"commit": "%H", "author": "%an", "date": "%aI", "message": "%s", "parents_str": "%P"}'
            
            # Limit to a reasonable number of commits for performance.
            # --all ensures we get the history from all branches, which is important for a complete graph.
            command = [
                'git', '-C', repo_path, 'log',
                '--all',
                '--max-count=150',
                f'--pretty=format:{log_format}'
            ]

            result = subprocess.run(command, check=True, capture_output=True, text=True, encoding='utf-8')
            
            # The output is a string of concatenated JSON objects, each on a new line.
            commit_lines = result.stdout.strip().split('\n')
            
            commit_history = []
            for line in commit_lines:
                if not line:
                    continue
                try:
                    # Parse the JSON string for a single commit
                    commit_data = json.loads(line)
                    
                    # --- THIS IS THE KEY CHANGE ---
                    # The "%P" format gives a space-separated string of parent hashes.
                    # We split this string to create a proper list, which matches the mock data's format.
                    # If there are no parents, `parents_str` will be an empty string, and split() will correctly return [].
                    parent_hashes_str = commit_data.get('parents_str', '')
                    commit_data['parents'] = parent_hashes_str.split()
                    
                    # Remove the temporary 'parents_str' key to keep the final JSON clean.
                    del commit_data['parents_str']
                    # --- END KEY CHANGE ---
                    
                    commit_history.append(commit_data)
                except json.JSONDecodeError:
                    print(f"VIEW_COMMIT_HISTORY: Warning - Could not decode JSON for line: {line}")
                    continue # Skip any potentially malformed lines from git log
            print(commit_history)        
            return Response(commit_history, status=status.HTTP_200_OK)

        except subprocess.CalledProcessError as e:
            error_message = f"Failed to execute git log: {e.stderr}"
            print(f"VIEW_COMMIT_HISTORY: ERROR - {error_message}")
            return Response({"error": error_message}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            error_message = f"An unexpected error occurred while fetching commit history: {str(e)}"
            print(f"VIEW_COMMIT_HISTORY: ERROR - {error_message}")
            return Response({"error": error_message}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
@method_decorator(csrf_exempt, name='dispatch')
class SuggestRefactorsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, symbol_id, *args, **kwargs):
        print(f"VIEW_SUGGEST_REFACTORS: Request for symbol_id: {symbol_id} by user: {request.user.username}")

        openai_client = OPENAI_CLIENT_INSTANCE

        
        if not openai_client:
            return Response(
                {"error": "Helix's AI service is currently unavailable."}, 
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        try:
            # Check ownership and fetch the symbol object
            q_filter = Q(id=symbol_id) & (
                Q(code_file__repository__user=request.user) |
                Q(code_class__code_file__repository__user=request.user)
            )
            symbol_obj = CodeSymbol.objects.get(q_filter)
        except CodeSymbol.DoesNotExist:
            return Response(
                {"error": "Symbol not found or permission denied."}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Call the new service function to get the streaming generator
        response_stream = generate_refactor_stream(symbol_obj, openai_client)
        
        response = StreamingHttpResponse(response_stream, content_type='text/plain; charset=utf-8')
        response['X-Accel-Buffering'] = 'no'
        response['Cache-Control'] = 'no-cache'
        return response
    
from .ai_services import handle_chat_query_stream


@method_decorator(csrf_exempt, name='dispatch')
class ChatView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, repo_id, *args, **kwargs):
        query = request.data.get('query')
        # --- NEW: Get optional file_path context from the request ---
        current_file_path = request.data.get('current_file_path')

        if not query or not isinstance(query, str) or len(query.strip()) < 3:
            return Response(
                {"error": "A meaningful query string is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        print(f"CHAT_VIEW: Received query for repo {repo_id}: '{query}'. File context: '{current_file_path}'")

        # The OPENAI_CLIENT check is no longer needed here as the service handles it
        
        try:
            Repository.objects.get(id=repo_id, user=request.user)
        except Repository.DoesNotExist:
            return Response(
                {"error": "Repository not found or permission denied."}, 
                status=status.HTTP_404_NOT_FOUND
            )

        # Call the service function, now passing the file_path
        response_stream = handle_chat_query_stream(
            user_id=request.user.id,
            repo_id=repo_id,
            query=query.strip(),
            file_path=current_file_path # Pass the context
        )
        
        response = StreamingHttpResponse(response_stream, content_type='text/plain; charset=utf-8')
        response['X-Accel-Buffering'] = 'no'
        response['Cache-Control'] = 'no-cache'
        return response
    

from .tasks import create_pr_with_changes_task # 03c03c03c NEW IMPORT
import time
@method_decorator(csrf_exempt, name='dispatch')
class ProposeChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, repo_id, *args, **kwargs):
        # 1. Validate the incoming data
        file_path = request.data.get('file_path')
        new_content = request.data.get('new_content')
        commit_message = request.data.get('commit_message')
        
        if not all([file_path, new_content, commit_message]):
            return Response(
                {"error": "Missing required fields: file_path, new_content, and commit_message are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Check repository ownership
        try:
            repo = Repository.objects.get(id=repo_id, user=request.user)
        except Repository.DoesNotExist:
            return Response({"error": "Repository not found or permission denied."}, status=status.HTTP_404_NOT_FOUND)

        # 3. Generate a unique branch name
        # e.g., helix-refactor-1687554321
        sanitized_commit_msg = "".join(filter(str.isalnum, commit_message.lower().replace(" ", "-")))[:30]
        branch_name = f"helix/{sanitized_commit_msg}-{int(time.time())}"

        # 4. Dispatch the Celery task
        task = create_pr_with_changes_task.delay(
            user_id=request.user.id,
            repo_id=repo.id,
            file_path=file_path,
            new_content=new_content,
            commit_message=commit_message,
            branch_name=branch_name,
            base_branch=repo.default_branch # Assuming you store the default branch on the repo model
        )

        print(f"PROPOSE_CHANGE_VIEW: Dispatched create_pr_with_changes_task {task.id} for repo {repo.id}")

        # 5. Return the task ID to the frontend for polling
        return Response(
            {"message": "Pull Request creation process initiated.", "task_id": task.id},
            status=status.HTTP_202_ACCEPTED
        )
        
@method_decorator(csrf_exempt, name='dispatch')
class SummarizeModuleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, repo_id, *args, **kwargs):
        module_path = request.data.get('path')

        if module_path is None or not isinstance(module_path, str):
            return Response(
                {"error": "A 'path' string for the module/directory is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        print(f"SUMMARIZE_MODULE_VIEW: Request for repo {repo_id}, path '{module_path}'")

        if not OPENAI_CLIENT_INSTANCE:
            return Response({"error": "Helix's AI service is currently unavailable."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        if not Repository.objects.filter(id=repo_id, user=request.user).exists():
            return Response({"error": "Repository not found or permission denied."}, status=status.HTTP_404_NOT_FOUND)

        response_stream = generate_module_readme_stream(
            repo_id=repo_id,
            module_path=module_path.strip(),
            openai_client=OPENAI_CLIENT_INSTANCE
        )
        
        response = StreamingHttpResponse(response_stream, content_type='text/plain; charset=utf-8')
        response['X-Accel-Buffering'] = 'no'
        response['Cache-Control'] = 'no-cache'
        return response
    
@method_decorator(csrf_exempt, name='dispatch')
class BatchDocumentModuleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, repo_id, *args, **kwargs):
        """
        Triggers a batch documentation task for all files within a specific
        module path in a repository.
        """
        # The path can be an empty string for the root directory
        module_path = request.data.get('path', '')

        print(f"BATCH_DOC_MODULE_VIEW: Request for repo {repo_id}, path '{module_path}'")

        # 1. Check repository ownership
        if not Repository.objects.filter(id=repo_id, user=request.user).exists():
            return Response({"error": "Repository not found or permission denied."}, status=status.HTTP_404_NOT_FOUND)

        # 2. Find all file IDs within the given module path
        # This query efficiently gets the primary keys of all files in the directory.
        file_ids_in_module = list(CodeFile.objects.filter(
            repository_id=repo_id,
            file_path__startswith=module_path.strip()
        ).values_list('id', flat=True))

        if not file_ids_in_module:
            # This is not an error; it just means there's nothing to do.
            return Response({"message": "No files found in the specified module path."}, status=status.HTTP_200_OK)
        
        print(f"BATCH_DOC_MODULE_VIEW: Found {len(file_ids_in_module)} files. Dispatching task.")

        # 3. Dispatch your existing Celery task with the filtered list of file IDs
        task = batch_generate_docstrings_for_files_task.delay(
            repo_id=repo_id,
            user_id=request.user.id,
            file_ids=file_ids_in_module
        )

        # 4. Return the task ID for frontend polling
        return Response(
            {"message": "Module documentation batch job initiated.", "task_id": task.id},
            status=status.HTTP_202_ACCEPTED
        )
        
class ModuleCoverageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, repo_id, *args, **kwargs):
        module_path = request.query_params.get('path', '').strip()
        print("Hello")
        base_query = CodeSymbol.objects.filter(
            Q(code_file__repository_id=repo_id) | Q(code_class__code_file__repository_id=repo_id)
        )


        if module_path:
            base_query = base_query.filter(
                Q(code_file__file_path__startswith=module_path) |
                Q(code_class__code_file__file_path__startswith=module_path)
            )

        # 3. Now, apply the documentation status conditions to the filtered set.
        condition_no_docs = Q(documentation_status=CodeSymbol.DocStatus.NONE)
        condition_stale = Q(documentation_status=CodeSymbol.DocStatus.STALE)
        
        # For robustness, we can still include the fallback, but the main issue is likely the query structure.
        condition_logic_fallback = (
            Q(documentation__isnull=True) | Q(documentation__exact='') |
            (Q(documentation_hash__isnull=False) & ~Q(documentation_hash=F('content_hash')))
        )

        final_query = base_query.filter(
            content_hash__isnull=False
        ).filter(
            condition_no_docs | condition_stale | condition_logic_fallback
        ).distinct()
        
        undocumented_count = final_query.count()
        # --- END CORRECTION ---

        print(f"MODULE_COVERAGE_VIEW: [Corrected Query] Found {undocumented_count} undocumented/stale symbols in repo {repo_id}, path '{module_path}'")
        # For debugging, you can print the raw SQL query Django generates:
        #print(f"DEBUG SQL: {final_query.query}")

        return Response({"undocumented_count": undocumented_count})
    
from .models import ModuleDocumentation
from .serializers import ModuleDocumentationSerializer # We'll create this next

class ModuleDocumentationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, repo_id, *args, **kwargs):
        module_path = request.query_params.get('path', '')
        
        try:
            # Check ownership via the repository relationship
            repo = Repository.objects.get(id=repo_id, user=request.user)
            module_doc = ModuleDocumentation.objects.get(repository=repo, module_path=module_path)
            serializer = ModuleDocumentationSerializer(module_doc)
            return Response(serializer.data)
        except Repository.DoesNotExist:
            return Response({"error": "Repository not found or permission denied."}, status=status.HTTP_404_NOT_FOUND)
        except ModuleDocumentation.DoesNotExist:
            return Response({"error": "No saved README found for this module path."}, status=status.HTTP_404_NOT_FOUND)
        
from .tasks import generate_module_documentation_workflow_task

@method_decorator(csrf_exempt, name='dispatch')
class GenerateModuleWorkflowView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, repo_id, *args, **kwargs):
        module_path = request.data.get('path', '')

        if not Repository.objects.filter(id=repo_id, user=request.user).exists():
            return Response({"error": "Repository not found or permission denied."}, status=status.HTTP_404_NOT_FOUND)

        # Dispatch the single "master" workflow task
        task = generate_module_documentation_workflow_task.delay(
            user_id=request.user.id,
            repo_id=repo_id,
            module_path=module_path.strip()
        )

        return Response(
            {"message": "Module documentation workflow initiated.", "task_id": task.id},
            status=status.HTTP_202_ACCEPTED
        )