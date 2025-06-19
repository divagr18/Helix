# backend/repositories/views.py
import os
import subprocess
from django.db.models import Q  # <--- ADD THIS IMPORT
from rest_framework import generics, permissions
from .tasks import create_documentation_pr_task,batch_generate_docstrings_task # We will create this task soon
from django.utils.decorators import method_decorator
from rest_framework import viewsets
from .models import CodeFile, CodeSymbol as CodeFunction, Repository, CodeSymbol,CodeDependency,AsyncTaskStatus
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
from .tasks import create_docs_pr_for_file_task
from .tasks import batch_generate_docstrings_for_files_task, create_pr_for_multiple_files_task # We'll define these tasks next

from openai import OpenAI as OpenAIClient # Renaming to avoid conflict if you have an 'OpenAI' model
from pgvector.django import L2Distance # Or CosineDistance, MaxInnerProduct
from .serializers import CodeSymbolSerializer,AsyncTaskStatusSerializer # We can reuse this for results
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
        symbol_id = kwargs.get('function_id') # Assuming URL calls it 'function_id'
                                                  # Consider renaming URL param to 'symbol_id' for clarity
        
        print(f"DEBUG: SaveDocstringView called for symbol_id: {symbol_id}, user: {request.user.username}")

        try:
            q_filter = Q(id=symbol_id) & (
                Q(code_file__repository__user=request.user) | 
                Q(code_class__code_file__repository__user=request.user)
            )
            symbol = CodeSymbol.objects.get(q_filter)
        except CodeSymbol.DoesNotExist:
            return Response({"error": "Symbol not found or permission denied."}, status=status.HTTP_404_NOT_FOUND)

        new_doc_text = request.data.get('documentation_text')
        if new_doc_text is None:
            return Response({"error": "'documentation_text' not provided."}, status=status.HTTP_400_BAD_REQUEST)

        new_doc_text = new_doc_text.strip() # Clean it

        symbol.documentation = new_doc_text
        
        if new_doc_text and symbol.content_hash: # If there's new doc and symbol has a content hash
            symbol.documentation_hash = symbol.content_hash # Mark as fresh for current code
            # If you added documentation_status:
            # symbol.documentation_status = CodeSymbol.DocStatus.HUMAN_EDITED_PENDING_PR # Or 'APPROVED'
        elif not new_doc_text: # Doc was cleared
            symbol.documentation_hash = None
            # if hasattr(symbol, 'documentation_status'):
            #     symbol.documentation_status = CodeSymbol.DocStatus.NONE
        else: # Has new doc text, but no content_hash for the symbol (should be rare)
            hasher = hashlib.sha256()
            hasher.update(new_doc_text.encode('utf-8'))
            symbol.documentation_hash = hasher.hexdigest()
            # if hasattr(symbol, 'documentation_status'):
            #     symbol.documentation_status = CodeSymbol.DocStatus.HUMAN_EDITED_PENDING_PR
            print(f"VIEW_SAVE_DOC: Warning - Symbol {symbol.id} has no content_hash. Hashing doc text itself for documentation_hash.")
        
        update_fields_list = ['documentation', 'documentation_hash']
        if hasattr(symbol, 'documentation_status'):
            update_fields_list.append('documentation_status')

        try:
            symbol.save(update_fields=update_fields_list)
            serializer = CodeSymbolSerializer(symbol) # Make sure you have this serializer
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            print(f"VIEW_SAVE_DOC: Error saving doc for symbol {symbol.id}: {e}")
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