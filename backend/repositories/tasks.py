# backend/repositories/tasks.py
from pathlib import Path
from config.celery import app
from .models import Repository,AsyncTaskStatus
import subprocess # Import the subprocess module
import os # Import the os module
import shutil # Import the shutil module for removing directories
from allauth.socialaccount.models import SocialToken # Import SocialToken
import json
from django.db.models import Q ,F,Count # <--- ADD THIS IMPORT
import ast # Python's Abstract Syntax Tree module
import astor,hashlib
import requests
from .ai_services import generate_module_readme_stream 
from celery import chain, shared_task
import subprocess # To call ruff CLI
import time
from github import Github, GithubException, UnknownObjectException
from django.contrib.auth import get_user_model
import datetime
from itertools import takewhile
import tempfile
from django.utils import timezone
from django.db import transaction,models  # Import the transaction module
from .models import CodeFile, CodeSymbol, CodeClass,CodeDependency,EmbeddingBatchJob,Insight,KnowledgeChunk,ModuleDocumentation
from .models import Notification, AsyncTaskStatus # Ensure Notification is imported
from allauth.socialaccount.models import SocialAccount
OPENAI_EMBEDDING_BATCH_SIZE = 50
OPENAI_EMBEDDING_BATCH_FILE_MAX_REQUESTS = 49000
# Define the path to our compiled Rust binary INSIDE the container
REPO_CACHE_BASE_PATH = "/var/repos"
from openai import OpenAI # Import the OpenAI library
RUST_ENGINE_PATH = "/app/engine/helix-engine/target/release/helix-engine"
OPENAI_CLIENT = OpenAI()
OPENAI_EMBEDDING_MODEL = "text-embedding-3-small"
from django.core.cache import cache

@app.task
def process_repository(repo_id):


    lock_key = f"process_repo_lock_{repo_id}"
    # Since we don't have `self.request.id`, we can just use a simple value for the lock
    if not cache.add(lock_key, "locked", timeout=900):
        print(f"PROCESS_REPO_TASK: Aborting for repo {repo_id}, another task is already running.")
        return
    try:
        # --- IMPORTANT: Ensure 'added_by' is selected for efficiency ---
        repo = Repository.objects.select_related('organization', 'added_by').get(id=repo_id)
    except Repository.DoesNotExist:
        print(f"Error: Repository with id={repo_id} not found.")
        return
        

    repo_path = os.path.join(REPO_CACHE_BASE_PATH, str(repo.id))

    try:
        print(f"PROCESS_REPO_TASK: Processing repository: {repo.full_name} (ID: {repo.id})")
        repo.status = Repository.Status.INDEXING
        repo.save(update_fields=['status'])

        # --- Git Cache Management ---
        # (Your existing git clone/pull logic - seems okay)
        # ... (ensure SocialToken and token logic is robust) ...
        if not repo.added_by:
            raise Exception(f"Repository {repo.full_name} has no associated user to fetch a token.")

        user_who_added_repo = repo.added_by
        social_account = user_who_added_repo.socialaccount_set.filter(provider='github').first()
        if not social_account:
            raise Exception(f"No GitHub social account found for user {user_who_added_repo.username} to process repo {repo.full_name}")
        
        social_token = SocialToken.objects.filter(account=social_account).first()
        if not social_token:
            raise Exception(f"No GitHub token found for user {user_who_added_repo.username} to process repo {repo.full_name}")
        
        token = social_token.token
        clone_url = f"https://oauth2:{token}@github.com/{repo.full_name}.git"

        previous_commit_hash = None
        if os.path.exists(repo_path):
            try:
                # Get the hash of the current HEAD
                result = subprocess.run(['git', '-C', repo_path, 'rev-parse', 'HEAD'], check=True, capture_output=True, text=True)
                previous_commit_hash = result.stdout.strip()
                
                print(f"PROCESS_REPO_TASK: Previous commit hash for repo {repo.id} is {previous_commit_hash[:7]}")
                subprocess.run(['git', '-C', repo_path, 'pull'], check=True, capture_output=True, timeout=300)
            except subprocess.CalledProcessError as e:
                # Handle git errors
                print(f"Git pull failed: {e.stderr}")
                repo.status = Repository.Status.FAILED; repo.save(); return
        else:
            # Cloning new repo
            subprocess.run(['git', 'clone', clone_url, repo_path], check=True, capture_output=True, timeout=300)

        # Get commit hash AFTER pull
        try:
            result = subprocess.run(['git', '-C', repo_path, 'rev-parse', 'HEAD'], check=True, capture_output=True, text=True)
            latest_commit_hash = result.stdout.strip()
        except subprocess.CalledProcessError as e:
            print(f"Could not get latest commit hash: {e.stderr}")
            repo.status = Repository.Status.FAILED; repo.save(); return

        # If nothing changed, we can stop early
        if previous_commit_hash and previous_commit_hash == latest_commit_hash:
            print(f"PROCESS_REPO_TASK: No new commits for repo {repo.id}. Processing complete.")
            repo.status = Repository.Status.COMPLETED
            repo.last_processed = timezone.now()
            repo.save(update_fields=['status', 'last_processed'])
            print(f"PROCESS_REPO_TASK: Dispatching metric calculation tasks for repo {repo_id}")
            calculate_documentation_coverage_task.delay(repo_id=repo_id)
            detect_orphan_symbols_task.delay(repo_id=repo.id, user_id=user_who_added_repo.id)
            return # Stop here
        
        # --- Call Rust Engine ---
        # (Your existing Rust engine call logic - seems okay)
        # ...
        print(f"PROCESS_REPO_TASK: Calling Rust engine for directory: {repo_path}")
        command = [RUST_ENGINE_PATH, "--dir-path", repo_path]
        result = subprocess.run(command, capture_output=True, text=True, check=True, timeout=600) # Added timeout
        json_output_string = result.stdout
        repo_analysis_data = json.loads(json_output_string)

        
        # --- Database Transaction: Processing ---
        with transaction.atomic():
            print("PROCESS_REPO_TASK: Starting Pass 1: Creating/Updating Files, Classes, and Symbols...")

            # --- MODIFIED APPROACH: Update or Create Symbols to preserve documentation ---
            # Map existing symbols for efficient lookup and deletion tracking
            existing_symbols_map = {
            s.unique_id: s for s in CodeSymbol.objects.filter(
                Q(code_file__repository=repo) | Q(code_class__code_file__repository=repo)
                )
            }
        
            processed_unique_ids_from_rust = set()
            added_symbols_data = []
            modified_symbols_data = []

            # Delete old files not present in new analysis
            current_file_paths_from_rust = {file_data.get('path') for file_data in repo_analysis_data.get('files', [])}
            CodeFile.objects.filter(repository=repo).exclude(file_path__in=current_file_paths_from_rust).delete()

            symbol_map_for_deps = {} # For dependency linking, using newly created/updated symbol objects
            call_map_for_deps = {}

            for file_data in repo_analysis_data.get('files', []):
                file_defaults = {
                    'structure_hash': file_data['structure_hash'],
                    'imports': file_data.get('imports', None) # Get the new 'imports' array
                }
                print(f"DEBUG_TASK: Preparing to save file '{file_data['path']}'. Imports found in JSON: {file_data.get('imports')}")
                code_file_obj, _ = CodeFile.objects.update_or_create(
                    repository=repo,
                    file_path=file_data.get('path'),
                    defaults=file_defaults
                )
                
                # Process top-level functions
                for func_data in file_data.get('functions', []):
                    uid = func_data.get('unique_id')
                    if not uid: continue
                    processed_unique_ids_from_rust.add(uid)
                    
                    # Initial defaults, not including documentation_status yet
                    func_defaults = {
                        'code_class': None,
                        'name': func_data.get('name'), 'start_line': func_data.get('start_line'),
                        'end_line': func_data.get('end_line'), 'content_hash': func_data.get('content_hash'),
                        'is_orphan': False,'loc': func_data.get('loc'),
                            'cyclomatic_complexity': func_data.get('cyclomatic_complexity'),'existing_docstring': func_data.get('docstring'), # from the JSON
        'signature_end_location': func_data.get('signature_end_location'), # from the JSON
                    }
                    
                    symbol_obj, created = CodeSymbol.objects.update_or_create(
                        unique_id=uid,
                        code_file=code_file_obj,
                        defaults=func_defaults
                    )
                    if created and symbol_obj.existing_docstring:
                        # If we're seeing this symbol for the first time and it already has a docstring
                        symbol_obj.documentation_status = CodeSymbol.DocStatus.FRESH
                        symbol_obj.save(update_fields=['documentation_status'])
                    elif created and not symbol_obj.existing_docstring:
                        # New symbol with no docstring
                        symbol_obj.documentation_status = CodeSymbol.DocStatus.NONE
                        symbol_obj.save(update_fields=['documentation_status'])

                    if created:
                        added_symbols_data.append({'id': symbol_obj.id, 'name': symbol_obj.name, 'file_path': file_data.get('path')})
                    elif uid in existing_symbols_map and existing_symbols_map[uid].content_hash != symbol_obj.content_hash:
                        modified_symbols_data.append({'id': symbol_obj.id, 'name': symbol_obj.name, 'file_path': file_data.get('path')})
                    else:
                        print(f"Updated Symbol: {uid} - doc_status preserved")
                        # For updates, documentation_status is preserved (not in defaults).
                        # The staleness check later will handle setting FRESH/STALE.

                    symbol_map_for_deps[uid] = symbol_obj
                    call_map_for_deps[uid] = func_data.get('calls', [])

                # Process classes and their methods
                for class_data in file_data.get('classes', []):
                    class_obj, _ = CodeClass.objects.update_or_create(
                        code_file=code_file_obj, 
                        name=class_data.get('name'), # Assuming (file, class_name) is unique
                        defaults={
                            'start_line': class_data.get('start_line'), 'end_line': class_data.get('end_line'),
                            'structure_hash': class_data.get('structure_hash')
                        }
                    )
                    for method_data in class_data.get('methods', []):
                        uid = method_data.get('unique_id')
                        if not uid: continue
                        processed_unique_ids_from_rust.add(uid)

                        method_defaults = {
                            'code_file': None,
                            'name': method_data.get('name'), 
                            'start_line': method_data.get('start_line'),
                            'end_line': method_data.get('end_line'), 
                            'content_hash': method_data.get('content_hash'),
                            'is_orphan': False,
                            'loc': method_data.get('loc'),
                            'cyclomatic_complexity': method_data.get('cyclomatic_complexity'),
                            'existing_docstring': method_data.get('docstring'), 
                            'signature_end_location': method_data.get('signature_end_location'),
                        }

                        symbol_obj, created = CodeSymbol.objects.update_or_create(
                            unique_id=uid,
                            code_class=class_obj,
                            defaults=method_defaults
                        )
                        if created and symbol_obj.existing_docstring:
        # If we're seeing this symbol for the first time and it already has a docstring
                            symbol_obj.documentation_status = CodeSymbol.DocStatus.FRESH
                            symbol_obj.save(update_fields=['documentation_status'])
                        elif created and not symbol_obj.existing_docstring:
                            # New symbol with no docstring
                            symbol_obj.documentation_status = CodeSymbol.DocStatus.NONE
                            symbol_obj.save(update_fields=['documentation_status'])

                        if created:
                            added_symbols_data.append({'id': symbol_obj.id, 'name': symbol_obj.name, 'file_path': file_data.get('path'), 'class_name': class_data.get('name')})
                        elif uid in existing_symbols_map and existing_symbols_map[uid].content_hash != symbol_obj.content_hash:
                            modified_symbols_data.append({'id': symbol_obj.id, 'name': symbol_obj.name, 'file_path': file_data.get('path'), 'class_name': class_data.get('name')})
                        else:
                            print(f"Updated Method Symbol: {uid} - doc_status preserved")
                            # For updates, documentation_status is preserved.

                        symbol_map_for_deps[uid] = symbol_obj
                        call_map_for_deps[uid] = method_data.get('calls', [])
            
            # Delete symbols that were in the DB (for this repo) but not in the new Rust output
            removed_uids = set(existing_symbols_map.keys()) - processed_unique_ids_from_rust
            removed_symbols_data = []
            if removed_uids:
                # We need to get their details before deleting them
                for uid in removed_uids:
                    symbol_to_delete = existing_symbols_map[uid]
                    removed_symbols_data.append({'name': symbol_to_delete.name, 'file_path': symbol_to_delete.code_file.file_path if symbol_to_delete.code_file else "N/A"})
                
                CodeSymbol.objects.filter(
                Q(unique_id__in=list(removed_uids)) &
                (Q(code_file__repository=repo) | Q(code_class__code_file__repository=repo))
            ).delete()


            print(f"PROCESS_REPO_TASK: Finished Pass 1. Processed {len(processed_unique_ids_from_rust)} symbols from Rust output.")

            # PASS 1.5: Generate Embeddings
            if OPENAI_CLIENT: # Only submit if client is available
                print(f"PROCESS_REPO_TASK: Dispatching asynchronous batch embedding job for repo {repo.id}...")
                submit_embedding_batch_job_task.delay(repo_id=repo.id)

            else:
                print("PROCESS_REPO_TASK: Skipping embedding job submission as OpenAI client is not available.")
            # --- END NEW ---


            # PASS 2: Link Dependencies
            print("PROCESS_REPO_TASK: Starting Pass 2: Linking Dependencies...")
            # Clear old dependencies for this repo before creating new ones
            # This relies on symbols having a clear path back to the repo
            CodeDependency.objects.filter(
                Q(caller__code_file__repository=repo) | Q(caller__code_class__code_file__repository=repo) |
                Q(callee__code_file__repository=repo) | Q(callee__code_class__code_file__repository=repo)
            ).distinct().delete()

            name_to_symbol_map_for_deps = {s.name: s for s in symbol_map_for_deps.values()}

            for caller_uid, callee_names in call_map_for_deps.items():
                caller_symbol = symbol_map_for_deps.get(caller_uid)
                if not caller_symbol: continue
                for callee_name in callee_names:
                    callee_symbol = name_to_symbol_map_for_deps.get(callee_name) # Naive name lookup
                    if callee_symbol and callee_symbol.id != caller_symbol.id:
                        CodeDependency.objects.get_or_create(caller=caller_symbol, callee=callee_symbol)
            print("PROCESS_REPO_TASK: Finished Pass 2.")

            # --- Staleness Detection and Notification Logic ---
            print(f"PROCESS_REPO_TASK: Starting staleness check for repository {repo.id} ({repo.full_name})")
            stale_symbols_count = 0
            newly_stale_symbol_details = []

            # Fetch all symbols in this repo that have documentation and a content_hash
            symbols_with_docs_in_repo = CodeSymbol.objects.filter(
                (Q(code_file__repository=repo) | Q(code_class__code_file__repository=repo)),
                documentation__isnull=False,
                documentation__iregex=r'\S',
                content_hash__isnull=False
            ).select_related('code_file', 'code_class__code_file') # For file path in notification

            symbols_to_bulk_update_status = []

            for symbol in symbols_with_docs_in_repo:
                is_freshly_documented = (
                    symbol.documentation_hash is not None and
                    symbol.documentation_hash == symbol.content_hash
                )
                current_db_status = symbol.documentation_status
                new_status = current_db_status

                if is_freshly_documented:
                    if current_db_status != CodeSymbol.DocStatus.FRESH:
                        new_status = CodeSymbol.DocStatus.FRESH
                else: # Documentation exists, but it's now stale
                    if current_db_status != CodeSymbol.DocStatus.STALE:
                        new_status = CodeSymbol.DocStatus.STALE
                        stale_symbols_count += 1
                        file_rel_path = symbol.code_file.file_path if symbol.code_file else \
                                        (symbol.code_class.code_file.file_path if symbol.code_class and symbol.code_class.code_file else "N/A")
                        newly_stale_symbol_details.append(f"- `{symbol.name}` in `{file_rel_path}`")
                
                if new_status != current_db_status:
                    symbol.documentation_status = new_status
                    symbols_to_bulk_update_status.append(symbol)
            
            if symbols_to_bulk_update_status:
                CodeSymbol.objects.bulk_update(symbols_to_bulk_update_status, ['documentation_status'], batch_size=100)
                print(f"PROCESS_REPO_TASK: Updated documentation_status for {len(symbols_to_bulk_update_status)} symbols.")

            print(f"PROCESS_REPO_TASK: Staleness check complete. Found {stale_symbols_count} newly stale symbols.")

            if stale_symbols_count > 0:
                details_for_message = "\n".join(newly_stale_symbol_details[:5])
                if len(newly_stale_symbol_details) > 5:
                    details_for_message += f"\n... and {len(newly_stale_symbol_details) - 5} more."
                notification_message = (
                    f"{stale_symbols_count} docstring(s) became stale in repository '{repo.full_name}' "
                    f"after recent updates. Consider regenerating or reviewing them.\n\nExamples:\n{details_for_message}"
                )
                Notification.objects.create(
                    user=user_who_added_repo, repository=repo, message=notification_message,
                    notification_type=Notification.NotificationType.STALENESS_ALERT
                )
            # --- END Staleness Detection ---

            repo.root_merkle_hash = repo_analysis_data.get('root_merkle_hash')
            repo.status = Repository.Status.COMPLETED
            repo.last_processed = timezone.now() # Added timezone
            repo.save(update_fields=['root_merkle_hash', 'status', 'last_processed'])
        diff_report = {
        'added_symbols': added_symbols_data,
        'modified_symbols': modified_symbols_data,
        'removed_symbols': removed_symbols_data,
    }
        print(f"PROCESS_REPO_TASK: Dispatching metric calculation tasks for repo {repo_id}")
        calculate_documentation_coverage_task.delay(repo_id=repo_id)
        
        print(f"PROCESS_REPO_TASK: Dispatching insights generation for repo {repo.id} at commit {latest_commit_hash[:7]}")
        generate_insights_on_change_task.delay(
            repo_id=repo.id,
            commit_hash=latest_commit_hash,
            diff_report=diff_report
        )
        print(f"PROCESS_REPO_TASK: Dispatching knowledge indexing for repo {repo.id}")
        index_repository_knowledge_task.delay(repo_id=repo.id)
        print(f"PROCESS_REPO_TASK: Successfully processed and saved analysis for repository: {repo.full_name}")
        print(f"PROCESS_REPO_TASK: Dispatching orphan detection for repo {repo.id}")
        detect_orphan_symbols_task.delay(repo_id=repo.id, user_id=user_who_added_repo.id) # Pass user_id of repo owner
        sync_knowledge_index_task.delay(repo_id=repo.id)
        print(f"PROCESS_REPO_TASK: Dispatching module dependency resolution for repo {repo.id}")
        resolve_module_dependencies_task.delay(repo_id=repo.id)
    except subprocess.CalledProcessError as e:
        error_message = f"Error calling Rust engine for repo_id={repo_id}. Return code: {e.returncode}. Stderr: {e.stderr[:500]}..."
        print(error_message)
        repo.status = Repository.Status.FAILED
        # repo.error_message = error_message # If you have an error message field
        repo.save()
    except json.JSONDecodeError as e:
        error_message = f"Error decoding JSON from Rust engine for repo_id={repo_id}. Error: {e}. Output: {result.stdout[:500]}..."
        print(error_message)
        repo.status = Repository.Status.FAILED
        # repo.error_message = error_message
        repo.save()
    except Exception as e:
        error_message = f"An unexpected error occurred while processing repo_id={repo_id}: {str(e)}"
        print(error_message)
        import traceback
        traceback.print_exc() # Print full traceback for unexpected errors
        repo.status = Repository.Status.FAILED
        # repo.error_message = error_message
        repo.save()
    finally:
        cache.delete(lock_key)

User = get_user_model()
def update_docstring_in_ast(source_code: str, target_symbol_name: str, new_docstring: str, target_class_name: str = None):
    tree = ast.parse(source_code)
    
    new_docstring = new_docstring.strip()
    if new_docstring.startswith('"""') and new_docstring.endswith('"""'):
        new_docstring = new_docstring[3:-3].strip()
    elif new_docstring.startswith("'''") and new_docstring.endswith("'''"):
        new_docstring = new_docstring[3:-3].strip()

    class DocstringUpdater(ast.NodeTransformer):
        def __init__(self, current_target_symbol_name, current_target_docstring, current_target_class_name=None):
            self.current_target_symbol_name = current_target_symbol_name
            self.current_target_docstring = current_target_docstring
            self.current_target_class_name = current_target_class_name
            self.is_in_target_class_scope = (current_target_class_name is None) # True if looking for top-level

        def visit_ClassDef(self, node):
            if self.current_target_class_name and node.name == self.current_target_class_name:
                self.is_in_target_class_scope = True
                self.generic_visit(node) # Process children (methods) of this class
                self.is_in_target_class_scope = False # Reset after leaving the class
                return node
            elif self.current_target_class_name is None:
                # If looking for a top-level function, don't descend into classes' bodies
                # for the purpose of setting is_in_target_class_scope for methods.
                # However, we still need to visit children in case of nested classes (though less common).
                # Let's refine: only visit children if not specifically targeting a class.
                # If we are targeting a class, we only care about *that* class.
                pass # Do not visit children if we are looking for a specific class and this is not it.
            
            # If not targeting a class, or if this class is not the target,
            # still visit its children in case of nested structures or other elements.
            # However, the actual docstring update logic is guarded by is_in_target_class_scope.
            return self.generic_visit(node)


        def visit_FunctionDef(self, node):
            if self.is_in_target_class_scope and node.name == self.current_target_symbol_name:
                docstring_node = ast.Expr(value=ast.Constant(value=self.current_target_docstring))
                
                if node.body and isinstance(node.body[0], ast.Expr) and \
                   isinstance(node.body[0].value, (ast.Constant, ast.Str)): # ast.Str for Py < 3.8
                    node.body[0] = docstring_node
                else:
                    node.body.insert(0, docstring_node)
            
            # It's important to call generic_visit to process the rest of the function body,
            # especially if there are nested functions (though we don't target them for docstrings here).
            return self.generic_visit(node)

    updater = DocstringUpdater(target_symbol_name, new_docstring, target_class_name)
    new_tree = updater.visit(tree)
    ast.fix_missing_locations(new_tree)
    
    return astor.to_source(new_tree)

@app.task(bind=True, max_retries=3, default_retry_delay=60)
def create_documentation_pr_task(self, symbol_id, user_id):
    try:
        user = User.objects.get(id=user_id)
        symbol = CodeSymbol.objects.select_related(
            'code_file__repository', 
            'code_class__code_file__repository'
        ).get(id=symbol_id)
        
        if not symbol.documentation:
            return {"status": "error", "message": "No documentation found for symbol."}

        if symbol.code_file:
            repo_model = symbol.code_file.repository
            file_path_in_repo = symbol.code_file.file_path
        elif symbol.code_class and symbol.code_class.code_file:
            repo_model = symbol.code_class.code_file.repository
            file_path_in_repo = symbol.code_class.code_file.file_path
        else:
            raise Exception(f"Symbol {symbol_id} is not properly linked to a file or repository.")

        social_account = user.socialaccount_set.filter(provider='github').first()
        if not social_account:
            raise Exception("GitHub account not linked or token not found.")
        
        github_token = social_account.socialtoken_set.first().token
        g = Github(github_token)
        gh_repo = g.get_repo(repo_model.full_name)
        
        timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        # Use unique_id for branch name to make it more specific
        sanitized_symbol_name_for_branch = symbol.name.replace('_', '-').lower()
        new_branch_name = f"helix-docs/{sanitized_symbol_name_for_branch}-{timestamp}"
        
        default_branch_name = gh_repo.default_branch
        default_branch = gh_repo.get_branch(default_branch_name)
        base_sha = default_branch.commit.sha
        
        gh_repo.create_git_ref(ref=f"refs/heads/{new_branch_name}", sha=base_sha)
        print(f"Created branch: {new_branch_name}")
        
        file_contents_obj = gh_repo.get_contents(file_path_in_repo, ref=new_branch_name)
        original_content = file_contents_obj.decoded_content.decode('utf-8')
        file_sha = file_contents_obj.sha

        # --- Use AST to update docstring ---
        print(f"Attempting to update docstring for: {symbol.name} in class {symbol.code_class.name if symbol.code_class else 'None'}")
        target_symbol_name = symbol.name
        target_class_name = None # Assume top-level function initially

        # Check if the symbol is a method by inspecting its unique_id or relationships
        actual_symbol_name_for_ast = symbol.name # The actual name of the function/method
        target_class_name_for_ast = None
        if symbol.code_class: # If it's a method, its code_class field will be set
            target_class_name_for_ast = symbol.code_class.name

        print(f"Attempting to update docstring for symbol: {actual_symbol_name_for_ast} in class: {target_class_name_for_ast or 'N/A (top-level)'}")
        
        # --- 1. Update docstring using AST ---
        content_after_ast_update = update_docstring_in_ast(
            original_content, 
            actual_symbol_name_for_ast, 
            symbol.documentation, 
            target_class_name_for_ast
        )
        
        if content_after_ast_update.strip() == original_content.strip():
            print("Warning: Docstring injection via AST did not change file content.")
            # Decide how to handle: proceed with original content or raise an error/warning
            # For now, we'll proceed, meaning the commit might have no changes if Ruff also sees no diff.
        
        # --- 2. Format the updated content using Ruff ---
        formatted_content = content_after_ast_update # Default if Ruff fails
        try:
            # Ruff can take input from stdin and output to stdout
            # We use `ruff format -` to read from stdin
            # Ensure ruff is in the PATH or provide full path if necessary
            # The worker's Dockerfile should ensure Python and its packages (including ruff) are in PATH
            process = subprocess.run(
                ['ruff', 'format', '-'], 
                input=content_after_ast_update, 
                capture_output=True, 
                text=True, 
                check=True # Will raise CalledProcessError if ruff exits with non-zero
            )
            formatted_content = process.stdout
            print(f"Successfully formatted content with Ruff for {file_path_in_repo}")
        except subprocess.CalledProcessError as e:
            print(f"Error formatting with Ruff for {file_path_in_repo}: {e.stderr}")
            print("Proceeding with unformatted (but AST-updated) content.")
            # formatted_content remains content_after_ast_update
        except FileNotFoundError:
            print("Error: Ruff command not found. Ensure it's installed and in PATH in the worker container.")
            print("Proceeding with unformatted (but AST-updated) content.")
            # formatted_content remains content_after_ast_update

        # --- 3. Commit the (potentially AST-updated and Ruff-formatted) content ---
        commit_message = f"Docs: Add/Update docstring for {symbol.unique_id or symbol.name} via Helix CME"
        
        # Only update if content actually changed after formatting
        if formatted_content.strip() != original_content.strip():
            gh_repo.update_file(
                path=file_path_in_repo, message=commit_message,
                content=formatted_content, # Use the Ruff-formatted content
                sha=file_sha, branch=new_branch_name
            )
            print(f"Committed changes (AST + Ruff) to {new_branch_name}")
        else:
            print(f"No effective changes to commit for {file_path_in_repo} after AST update and Ruff formatting.")
            # If no changes, you might choose not to create a PR, or create one noting no effective change.
            # For now, we'll proceed to create the PR even if the file content is identical,
            # as the intent was to update docs. GitHub will show "0 changed files" if so.

        # --- 4. Create Pull Request (logic remains the same) ---
        pr_title = f"Helix CME: Documentation for {symbol.unique_id or symbol.name}"
        # Use the original symbol.documentation for the PR body, as it's the source of truth for the doc.
        doc_for_pr_body = symbol.documentation.strip()
        if doc_for_pr_body.startswith('"""') and doc_for_pr_body.endswith('"""'):
            doc_for_pr_body = doc_for_pr_body[3:-3].strip()
        elif doc_for_pr_body.startswith("'''") and doc_for_pr_body.endswith("'''"):
            doc_for_pr_body = doc_for_pr_body[3:-3].strip()

        pr_body_lines = [
            f"This Pull Request was automatically generated by Helix CME to add or update documentation for the symbol `{symbol.unique_id or symbol.name}` "
            f"in file `{file_path_in_repo}`.",
            "", 
            "**Generated Documentation:**",
            "```python",
            doc_for_pr_body,
            "```"
        ]
        pr_body = "\n".join(pr_body_lines)
        
        pull_request = gh_repo.create_pull(
            title=pr_title, body=pr_body,
            head=new_branch_name, base=default_branch_name
        )
        print(f"Created Pull Request: {pull_request.html_url}")
        
        return {"status": "success", "pr_url": pull_request.html_url}

    except GithubException as e:
        print(f"GitHub API error for symbol {symbol_id}: {e.status} - {e.data}")
        self.retry(exc=e, countdown=60) # Retry on GitHub errors
        raise # Re-raise to mark task as failed if retries exhausted
    except Exception as e:
        print(f"Error in create_documentation_pr_task for symbol {symbol_id}: {e}")
        # Optionally retry for other types of errors too
        # self.retry(exc=e)
        raise
    
def get_source_for_symbol_in_task(symbol_obj: CodeSymbol) -> str | None:
    actual_code_file = None
    if symbol_obj.code_file:
        actual_code_file = symbol_obj.code_file
    elif symbol_obj.code_class and symbol_obj.code_class.code_file:
        actual_code_file = symbol_obj.code_class.code_file
    
    if not actual_code_file:
        print(f"ERROR_HELPER: Symbol {symbol_obj.id} ({symbol_obj.name}) has no associated CodeFile.")
        return None

    # Ensure REPO_CACHE_BASE_PATH is correctly defined and accessible
    # It might be settings.REPO_CACHE_BASE_PATH or imported from models.py
    if not REPO_CACHE_BASE_PATH:
        print("ERROR_HELPER: REPO_CACHE_BASE_PATH is not defined.")
        return None

    repo_path_for_file = os.path.join(REPO_CACHE_BASE_PATH, str(actual_code_file.repository.id))
    full_file_path_for_file = os.path.join(repo_path_for_file, actual_code_file.file_path)

    if os.path.exists(full_file_path_for_file):
        try:
            with open(full_file_path_for_file, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            # Ensure start_line and end_line are valid 1-based indices
            if symbol_obj.start_line > 0 and \
               symbol_obj.end_line >= symbol_obj.start_line and \
               symbol_obj.end_line <= len(lines):
                symbol_code_lines = lines[symbol_obj.start_line - 1 : symbol_obj.end_line]
                return "".join(symbol_code_lines)
            else:
                print(f"WARNING_HELPER: Invalid start/end lines for symbol {symbol_obj.unique_id} in file {full_file_path_for_file}. Start: {symbol_obj.start_line}, End: {symbol_obj.end_line}, Total lines: {len(lines)}")
                return f"# Error: Could not extract source due to invalid line numbers ({symbol_obj.start_line}-{symbol_obj.end_line})."
        except Exception as e:
            print(f"ERROR_HELPER: Error reading file content for symbol {symbol_obj.unique_id}: {e}")
            return f"# Error reading file: {e}"
    else:
        print(f"WARNING_HELPER: Source file not found in cache for symbol {symbol_obj.unique_id}: {full_file_path_for_file}")
        return "# Error: Source file not found in cache."
    return None # Should not be reached if logic is correct

# --- Helper to call OpenAI for docstring (non-streaming) ---
def call_openai_for_docstring(prompt: str, openai_client: OpenAI | None) -> str | None:
    if not openai_client:
        print("WARNING_HELPER: OpenAI client not provided to call_openai_for_docstring.")
        return None
    try:
        # Ensure you are using the correct API structure for your OpenAI library version
        # For openai >= 1.0.0
        completion = openai_client.chat.completions.create(
            model="gpt-4.1-mini", # Cheaper/faster for batch, consider gpt-4-turbo-preview for quality
            messages=[
                {"role": "system", "content": "You are an expert Python programmer. Your task is to write a concise, professional, Google-style docstring for the given function. Do not include the function signature itself, only the docstring content inside triple quotes. Start with a one-line summary. Then, describe the arguments, and what the function returns. If context is provided about callers/callees, use it to make the docstring more informative."},
                {"role": "user", "content": prompt}
            ]
        )
        generated_content = completion.choices[0].message.content
        
        # Clean the docstring (remove surrounding quotes if AI adds them, strip whitespace)
        if generated_content:
            generated_content = generated_content.strip()
            if generated_content.startswith('"""') and generated_content.endswith('"""'):
                generated_content = generated_content[3:-3].strip()
            elif generated_content.startswith("'''") and generated_content.endswith("'''"):
                generated_content = generated_content[3:-3].strip()
            return generated_content
        return None
    except Exception as e:
        print(f"ERROR_HELPER: Error calling OpenAI for docstring: {e}")
        return None
    
    
@app.task(bind=True, max_retries=2, default_retry_delay=180) # Fewer retries, longer delay for batch
def batch_generate_docstrings_task(self, code_file_id: int, user_id: int):
    try:
        # user = User.objects.get(id=user_id) # Not strictly needed if PR is separate
        code_file = CodeFile.objects.select_related('repository__user').get(id=code_file_id)
        # Basic permission check (can be enhanced if needed)
        if code_file.repository.user.id != user_id:
            print(f"Permission denied: User {user_id} does not own repository for CodeFile {code_file_id}")
            return {"status": "error", "message": "Permission denied."}
            
    except CodeFile.DoesNotExist:
        print(f"Error: CodeFile {code_file_id} not found for batch generation.")
        return {"status": "error", "message": "File not found."}

    symbols_to_document_query = CodeSymbol.objects.filter(
        Q(code_file=code_file) | Q(code_class__code_file=code_file) # Symbols in this file
    ).exclude(
        content_hash__isnull=True # Exclude symbols that somehow don't have a content_hash
    ).filter(
        Q(documentation__isnull=True) | Q(documentation__exact='') | 
        (Q(documentation_hash__isnull=False) & ~Q(documentation_hash=models.F('content_hash'))) |
        (Q(documentation_hash__isnull=True) & ~Q(documentation__isnull=True) & ~Q(documentation__exact='')) # Has docs but no doc_hash (old data)
    ).select_related('code_class', 'code_file') # For context and path

    symbols_to_document = list(symbols_to_document_query) # Execute query

    if not symbols_to_document:
        print(f"No symbols to document in file {code_file.file_path} (ID: {code_file_id}).")
        return {"status": "success", "message": "No symbols needed documentation in this file."}

    print(f"Found {len(symbols_to_document)} symbols to document in {code_file.file_path} (ID: {code_file_id}).")
    
    openai_client = OPENAI_CLIENT
    
    if not openai_client:
        return {"status": "error", "message": "OpenAI client not available. Cannot generate documentation."}

    successful_generations = 0
    failed_generations = 0

    for symbol in symbols_to_document:
        source_code = get_source_for_symbol_in_task(symbol)
        if not source_code or source_code.startswith("# Error:"):
            print(f"Skipping symbol {symbol.unique_id or symbol.name}: Could not get source code ({source_code}).")
            failed_generations += 1
            continue
        
        prompt = f"Generate a Python docstring for the following code snippet (file: {symbol.code_file.file_path if symbol.code_file else symbol.code_class.code_file.file_path}, symbol: {symbol.name}):\n\n```python\n{source_code}\n```"
        # Add contextual prompting here later if desired (callers/callees)
        
        print(f"Generating doc for: {symbol.unique_id or symbol.name} (ID: {symbol.id})")
        docstring_content = call_openai_for_docstring(prompt, openai_client)

        if docstring_content:
            symbol.documentation = docstring_content
            symbol.documentation_hash = symbol.content_hash
            symbol.documentation_status = CodeSymbol.DocStatus.FRESH # Or some other status
 # Mark as fresh
            try:
                symbol.save(update_fields = ['documentation', 'documentation_hash', 'documentation_status'])
                print(f"Generated and saved doc for: {symbol.unique_id or symbol.name}")
                successful_generations += 1
            except Exception as e:
                print(f"Error saving doc for symbol {symbol.unique_id or symbol.name}: {e}")
                failed_generations += 1
        else:
            print(f"Failed to generate doc for: {symbol.unique_id or symbol.name}")
            failed_generations += 1
        
        time.sleep(0.1) # Basic rate limiting: 0.5 seconds between OpenAI calls

    summary_message = f"Batch documentation generation for file '{code_file.file_path}': {successful_generations} successful, {failed_generations} failed."
    print(summary_message)
    
    # The PR creation will be a separate step/task, triggered by the user after reviewing.
    # This task's responsibility is just to update the documentation in the database.
    return {"status": "success", "message": summary_message, "successful_count": successful_generations, "failed_count": failed_generations}

def get_source_for_file_in_task(code_file_obj: CodeFile) -> str | None:
    """Helper to get the full source content of a file from the cache."""
    if not REPO_CACHE_BASE_PATH:
        print("ERROR_HELPER: REPO_CACHE_BASE_PATH is not defined.")
        return None
    repo_path = os.path.join(REPO_CACHE_BASE_PATH, str(code_file_obj.repository.id))
    full_file_path = os.path.join(repo_path, code_file_obj.file_path)
    if os.path.exists(full_file_path):
        try:
            with open(full_file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()
        except Exception as e:
            print(f"ERROR_HELPER: Error reading file {full_file_path}: {e}")
    else:
        print(f"WARNING_HELPER: Source file not found in cache: {full_file_path}")
    return None


# Rename or create a new task for batch PRs for a file
@app.task(bind=True, max_retries=2, default_retry_delay=120)
def create_docs_pr_for_file_task(self, code_file_id: int, user_id: int):
    try:
        user = User.objects.get(id=user_id)
        code_file = CodeFile.objects.select_related('repository').get(id=code_file_id, repository__user=user)
    except (CodeFile.DoesNotExist, User.DoesNotExist):
        print(f"Error: CodeFile {code_file_id} or User {user_id} not found for PR creation.")
        return {"status": "error", "message": "File or user not found."}

    repo_model = code_file.repository
    file_path_in_repo = code_file.file_path # This is the relative path from repo root

    # Get all symbols for this file that have fresh documentation
    # (documentation is present AND documentation_hash == content_hash)
    # These are the symbols whose documentation we want to include in the PR.
    symbols_with_fresh_docs = CodeSymbol.objects.filter(
        Q(code_file=code_file) | Q(code_class__code_file=code_file),
        documentation__isnull=False,
        documentation_hash__isnull=False, # Ensure doc_hash exists
        content_hash__isnull=False,     # Ensure content_hash exists
        documentation_hash=models.F('content_hash')
    ).select_related('code_class').order_by('start_line') # Order for consistent injection

    if not symbols_with_fresh_docs.exists():
        print(f"No freshly documented symbols found in {file_path_in_repo} to include in PR.")
        return {"status": "info", "message": "No new/updated documentation to commit for this file."}

    print(f"Found {symbols_with_fresh_docs.count()} symbols with fresh docs in {file_path_in_repo} for PR.")

    # --- GitHub API Interaction ---
    try:
        social_account = user.socialaccount_set.filter(provider='github').first()
        if not social_account: raise Exception("GitHub account not linked.")
        github_token = social_account.socialtoken_set.first().token
        g = Github(github_token)
        gh_repo = g.get_repo(repo_model.full_name)

        # 1. Get original file content from the default branch
        default_branch_name = gh_repo.default_branch
        print(f"DEBUG_TASK: Attempting to access file on GitHub: repo='{repo_model.full_name}', path='{file_path_in_repo}', branch='{default_branch_name}'")
        try:
            file_contents_obj_default_branch = gh_repo.get_contents(file_path_in_repo, ref=default_branch_name)
            original_content_from_github = file_contents_obj_default_branch.decoded_content.decode('utf-8')
            current_file_sha_on_default_branch = file_contents_obj_default_branch.sha
        except GithubException as e:
            if e.status == 404: # File might be new
                print(f"File {file_path_in_repo} not found on default branch {default_branch_name}. Assuming new file for docs.")
                original_content_from_github = "" # Start with empty if file is new
                current_file_sha_on_default_branch = None # No SHA for new file update
            else:
                raise # Re-raise other GitHub exceptions

        # 2. Create a new branch
        timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        sanitized_file_name_for_branch = os.path.basename(file_path_in_repo).replace('.', '-').lower()
        new_branch_name = f"helix-docs/{sanitized_file_name_for_branch}-{timestamp}"
        
        default_branch_obj = gh_repo.get_branch(default_branch_name)
        base_sha = default_branch_obj.commit.sha
        gh_repo.create_git_ref(ref=f"refs/heads/{new_branch_name}", sha=base_sha)
        print(f"Created branch: {new_branch_name}")

        # 3. Inject ALL docstrings for this file into the original_content_from_github
        content_with_all_docs = original_content_from_github
        processed_symbols_for_ast = []

        for symbol in symbols_with_fresh_docs:
            actual_symbol_name = symbol.name
            target_class_name = symbol.code_class.name if symbol.code_class else None
            
            # Check if this symbol was already processed (e.g. if a method and its class were both "updated")
            # This simple check might not be perfect for complex AST manipulations but is a start.
            symbol_identifier_for_ast = (target_class_name, actual_symbol_name)
            if symbol_identifier_for_ast in processed_symbols_for_ast:
                continue 

            print(f"Injecting doc for: {symbol.unique_id or symbol.name}")
            content_with_all_docs = update_docstring_in_ast(
                content_with_all_docs, # Use the progressively updated content
                actual_symbol_name,
                symbol.documentation,
                target_class_name
            )
            processed_symbols_for_ast.append(symbol_identifier_for_ast)

        # 4. Format the fully updated content with Ruff
        final_formatted_content = content_with_all_docs
        try:
            process = subprocess.run(
                ['ruff', 'format', '-'], input=content_with_all_docs, 
                capture_output=True, text=True, check=True, cwd=REPO_CACHE_BASE_PATH # Run in a generic path
            )
            final_formatted_content = process.stdout
            print(f"Successfully formatted final content with Ruff for {file_path_in_repo}")
        except Exception as e: # Catch CalledProcessError and FileNotFoundError
            print(f"Error formatting with Ruff for {file_path_in_repo} (using AST content): {e}")
            # Proceed with content_with_all_docs if Ruff fails

        # 5. Commit the changes to the new branch
        commit_message = f"Docs: Batch update docstrings for {file_path_in_repo} via Helix CME"
        
        if final_formatted_content.strip() != original_content_from_github.strip():
            if current_file_sha_on_default_branch: # Update existing file
                gh_repo.update_file(
                    path=file_path_in_repo, message=commit_message,
                    content=final_formatted_content, sha=current_file_sha_on_default_branch, # Use SHA from default branch for update
                    branch=new_branch_name
                )
            else: # Create new file (if it didn't exist on default branch)
                 gh_repo.create_file(
                    path=file_path_in_repo, message=commit_message,
                    content=final_formatted_content, branch=new_branch_name
                )
            print(f"Committed changes for {file_path_in_repo} to {new_branch_name}")
        else:
            print(f"No effective changes to commit for {file_path_in_repo}.")
            # If no changes, we might not want to create a PR.
            # For now, let's allow it, GitHub will show "0 files changed".
            # A better approach would be to return early if no content changed.
            # However, the branch is already created. We could delete it.
            # For simplicity now, let it proceed.

        # 6. Create Pull Request
        pr_title = f"Helix CME: Documentation Update for {file_path_in_repo}"
        pr_body = (
            f"This Pull Request was automatically generated by Helix CME to add or update documentation "
            f"for symbols within the file `{file_path_in_repo}`.\n\n"
            f"{symbols_with_fresh_docs.count()} symbol(s) were updated in this PR."
            # Future: list the symbols updated.
        )
        
        pull_request = gh_repo.create_pull(
            title=pr_title, body=pr_body,
            head=new_branch_name, base=default_branch_name
        )
        print(f"Created Pull Request: {pull_request.html_url}")
        
        return {"status": "success", "pr_url": pull_request.html_url}

    except GithubException as e:
        print(f"GitHub API error during PR creation for file {code_file_id}: {e.status} {e.data}")
        # Attempt to delete the branch if PR creation failed mid-way
        if 'new_branch_name' in locals() and 'gh_repo' in locals():
            try:
                ref = gh_repo.get_git_ref(f"heads/{new_branch_name}")
                ref.delete()
                print(f"Cleaned up branch {new_branch_name} due to PR creation error.")
            except Exception as branch_delete_e:
                print(f"Failed to cleanup branch {new_branch_name}: {branch_delete_e}")
        raise self.retry(exc=e, countdown=120) # Retry on GitHub errors
    except Exception as e:
        print(f"Unexpected error in create_docs_pr_for_file_task for file {code_file_id}: {e}")
        # Also attempt to delete branch here
        if 'new_branch_name' in locals() and 'gh_repo' in locals():
            try:
                ref = gh_repo.get_git_ref(f"heads/{new_branch_name}")
                ref.delete()
                print(f"Cleaned up branch {new_branch_name} due to unexpected error.")
            except Exception as branch_delete_e:
                print(f"Failed to cleanup branch {new_branch_name}: {branch_delete_e}")
        raise # Re-raise for Celery to handle as a task failure
    




@app.task(bind=True, max_retries=1, default_retry_delay=300)
def batch_generate_docstrings_for_files_task(self, repo_id: int, user_id: int, file_ids: list[int]):
    task_id = self.request.id
    print(f"BATCH_DOC_GEN_TASK: Started (ID: {task_id}) for repo_id={repo_id}, user_id={user_id}, file_ids={file_ids}")
    
    task_status_obj = None
    try:
        user_obj = User.objects.get(id=user_id)
        repo_obj = Repository.objects.get(id=repo_id)
        task_status_obj, created = AsyncTaskStatus.objects.update_or_create(
            task_id=task_id,
            defaults={
                'user': user_obj, 'repository': repo_obj,
                'task_name': AsyncTaskStatus.TaskName.BATCH_GENERATE_DOCS,
                'status': AsyncTaskStatus.TaskStatus.IN_PROGRESS,
                'message': f'Initiated batch documentation generation for {len(file_ids)} file(s).', 'progress': 0
            }
        )
        print(f"BATCH_DOC_GEN_TASK: {'Created' if created else 'Updated'} AsyncTaskStatus for {task_id}")
    except (User.DoesNotExist, Repository.DoesNotExist) as e:
        print(f"BATCH_DOC_GEN_TASK: ERROR - User or Repo not found for task {task_id}: {e}")
        return {"status": "error", "message": "User or Repository for task status not found."}
    except Exception as e:
        print(f"BATCH_DOC_GEN_TASK: ERROR - Creating/updating AsyncTaskStatus for {task_id}: {e}")
        # Allow task to proceed but status won't be fully tracked if task_status_obj is None

    # Use the globally initialized OPENAI_CLIENT if available
    current_openai_client = OPENAI_CLIENT 
    if not current_openai_client:
        message = "OpenAI client not available (OPENAI_API_KEY not set or init failed)."
        print(f"BATCH_DOC_GEN_TASK: {message}")
        if task_status_obj:
            task_status_obj.status = AsyncTaskStatus.TaskStatus.FAILURE
            task_status_obj.message = message
            task_status_obj.progress = 100
            task_status_obj.save()
        return {"status": "error", "message": message}

    overall_successful_symbol_generations = 0
    overall_failed_symbol_generations = 0
    files_processed_count = 0
    files_with_new_docs_paths = set()
    total_files_to_process = len(file_ids)

    for i, code_file_id in enumerate(file_ids):
        try:
            code_file = CodeFile.objects.select_related('repository').get(
                id=code_file_id, repository_id=repo_id
            )
        except CodeFile.DoesNotExist:
            print(f"BATCH_DOC_GEN_TASK: Skipping file ID {code_file_id}: Not found for repo {repo_id}.")
            overall_failed_symbol_generations += 1 
            files_processed_count += 1
            if task_status_obj and total_files_to_process > 0:
                task_status_obj.progress = int(((i + 1) / total_files_to_process) * 100)
                task_status_obj.message = f"Processed {i+1}/{total_files_to_process} files. Current: {code_file.file_path if 'code_file' in locals() else 'ID '+str(code_file_id)} (File not found)"
                task_status_obj.save(update_fields=['progress', 'message', 'updated_at'])
            continue
        
        files_processed_count += 1
        current_progress_message = f"Processing file {files_processed_count}/{total_files_to_process}: {code_file.file_path}"
        print(f"BATCH_DOC_GEN_TASK: {current_progress_message}")
        if task_status_obj:
            task_status_obj.message = current_progress_message
            # Calculate progress more granularly if possible, or update per file
            task_status_obj.progress = int(((i + 0.5) / total_files_to_process) * 100) # Mid-file processing
            task_status_obj.save(update_fields=['progress', 'message', 'updated_at'])

        symbols_to_document = CodeSymbol.objects.filter(
            Q(code_file=code_file) | Q(code_class__code_file=code_file),
            content_hash__isnull=False
        ).filter(
            Q(documentation__isnull=True) | Q(documentation__exact='') |
            (Q(documentation_hash__isnull=False) & ~Q(documentation_hash=F('content_hash'))) |
            (Q(documentation_hash__isnull=True) & ~Q(documentation__isnull=True) & ~Q(documentation__exact=''))
        ).select_related('code_class', 'code_file__repository')

        if not symbols_to_document.exists():
            print(f"BATCH_DOC_GEN_TASK: No symbols to document in file {code_file.file_path}.")
            # Update progress for this file completion
            if task_status_obj and total_files_to_process > 0:
                task_status_obj.progress = int(((i + 1) / total_files_to_process) * 100)
                task_status_obj.save(update_fields=['progress', 'updated_at'])
            continue

        print(f"BATCH_DOC_GEN_TASK: Found {symbols_to_document.count()} symbols to document in {code_file.file_path}.")
        
        file_had_successful_generation_this_run = False
        for symbol_idx, symbol in enumerate(symbols_to_document):
            source_code = get_source_for_symbol_in_task(symbol)
            if not source_code or source_code.startswith("# Error:"):
                print(f"BATCH_DOC_GEN_TASK: Skipping symbol {symbol.unique_id or symbol.name}: Could not get source code ({source_code}).")
                overall_failed_symbol_generations += 1
                continue
            
            symbol_file_path_for_prompt = symbol.code_file.file_path if symbol.code_file else \
                                     (symbol.code_class.code_file.file_path if symbol.code_class and symbol.code_class.code_file else "N/A")

            prompt = f"Generate a Python docstring for the following code snippet (file: {symbol_file_path_for_prompt}, symbol: {symbol.name}):\n\n```python\n{source_code}\n```"
            
            print(f"BATCH_DOC_GEN_TASK: Generating doc for: {symbol.unique_id or symbol.name} (ID: {symbol.id})")
            docstring_content = call_openai_for_docstring(prompt, current_openai_client)

            if docstring_content:
                symbol.documentation = docstring_content
                if symbol.content_hash: # Ensure content_hash exists
                    symbol.documentation_hash = symbol.content_hash 
                    symbol.documentation_status = CodeSymbol.DocStatus.FRESH
                    print(f"BATCH_DOC_GEN_TASK: PRE-SAVE for Symbol {symbol.id}: status='{symbol.documentation_status}', doc_hash='{symbol.documentation_hash}', content_hash='{symbol.content_hash}'")
                else:
                    # Fallback if content_hash is missing (should be rare after process_repo)
                    hasher = hashlib.sha256()
                    hasher.update(docstring_content.encode('utf-8'))
                    symbol.documentation_hash = hasher.hexdigest()
                    symbol.documentation_status = CodeSymbol.DocStatus.PENDING_REVIEW # Or some other status
                    print(f"BATCH_DOC_GEN_TASK: PRE-SAVE (no content_hash) for Symbol {symbol.id}: status='{symbol.documentation_status}', doc_hash='{symbol.documentation_hash}'")
                
                update_fields_to_save = ['documentation', 'documentation_hash', 'documentation_status']
                try:
                    symbol.save(update_fields=update_fields_to_save)
                    saved_symbol_check = CodeSymbol.objects.get(pk=symbol.pk)
                    print(f"BATCH_DOC_GEN_TASK: POST-SAVE for Symbol {symbol.id}: DB status='{saved_symbol_check.documentation_status}', "
                        f"DB doc_hash='{saved_symbol_check.documentation_hash}', DB content_hash='{saved_symbol_check.content_hash}', "
                        f"DB doc empty: {not bool(saved_symbol_check.documentation.strip() if saved_symbol_check.documentation else False)}")
                    overall_successful_symbol_generations += 1
                    file_had_successful_generation_this_run = True
                except Exception as e:
                    print(f"BATCH_DOC_GEN_TASK: Error saving doc for symbol {symbol.unique_id or symbol.name}: {e}")
                    overall_failed_symbol_generations += 1
            else:
                print(f"BATCH_DOC_GEN_TASK: Failed to generate doc for: {symbol.unique_id or symbol.name}")
                overall_failed_symbol_generations += 1
            
            time.sleep(0.25) 

        if file_had_successful_generation_this_run:
            files_with_new_docs_paths.add(code_file.file_path)
        # --- End of per-file processing ---
        if task_status_obj and total_files_to_process > 0:
            task_status_obj.progress = int(((i + 1) / total_files_to_process) * 100)
            task_status_obj.save(update_fields=['progress', 'updated_at'])


    final_summary_message = (
        f"Batch documentation generation for repo {repo_id} complete. "
        f"Files targeted: {len(file_ids)}. Files processed: {files_processed_count}. "
        f"Symbols successfully documented: {overall_successful_symbol_generations}. "
        f"Symbols failed/skipped: {overall_failed_symbol_generations}."
    )
    print(f"BATCH_DOC_GEN_TASK: {final_summary_message}")

    final_status = AsyncTaskStatus.TaskStatus.SUCCESS
    if overall_failed_symbol_generations > 0 and overall_successful_symbol_generations == 0:
        final_status = AsyncTaskStatus.TaskStatus.FAILURE
    elif overall_failed_symbol_generations > 0:
        # Could add a "PARTIAL_SUCCESS" status if desired
        final_status = AsyncTaskStatus.TaskStatus.SUCCESS # Treat as success if at least one worked

    if task_status_obj:
        task_status_obj.status = final_status
        task_status_obj.message = final_summary_message
        task_status_obj.progress = 100
        task_status_obj.result_data = {
            "successful_symbol_count": overall_successful_symbol_generations,
            "failed_symbol_count": overall_failed_symbol_generations,
            "files_processed_count": files_processed_count,
            "updated_file_paths": list(files_with_new_docs_paths)
        }
        task_status_obj.save()
    
    return task_status_obj.result_data if task_status_obj else {"status": "error", "message": "Task status object not available."}
    
from github import InputGitTreeElement # Ensure this is imported

@app.task(bind=True, max_retries=1, default_retry_delay=180) # Max 1 retry for PR creation issues
def create_pr_for_multiple_files_task(self, repo_id: int, user_id: int, file_ids_for_pr: list[int]):
    task_id = self.request.id
    print(f"BATCH_PR_TASK: Started (ID: {task_id}) for repo_id={repo_id}, user_id={user_id}, file_ids_for_pr={file_ids_for_pr}")

    task_status_obj = None # Define before try-finally or try-except for broader scope
    user_obj = None
    repo_obj = None

    try:
        user_obj = User.objects.get(id=user_id)
        repo_obj = Repository.objects.get(id=repo_id) # Assuming user check was done in view
        
        task_status_obj, created = AsyncTaskStatus.objects.update_or_create(
            task_id=task_id,
            defaults={
                'user': user_obj, 
                'repository': repo_obj,
                'task_name': AsyncTaskStatus.TaskName.CREATE_BATCH_PR,
                'status': AsyncTaskStatus.TaskStatus.IN_PROGRESS,
                'message': f'Initiated PR creation for {len(file_ids_for_pr)} selected file(s).', 
                'progress': 0
            }
        )
        print(f"BATCH_PR_TASK: {'Created' if created else 'Updated'} AsyncTaskStatus for {task_id}")

    except (User.DoesNotExist, Repository.DoesNotExist) as e:
        # This case means we can't even create a status object linked to user/repo
        print(f"BATCH_PR_TASK: ERROR - User or Repository not found for task {task_id}. Cannot create status record. Error: {e}")
        # We can't update task_status_obj if it wasn't created.
        # The task should fail and Celery will handle it based on ack_late etc.
        # For now, just return an error structure.
        return {"status": "error", "message": f"User or Repository for task status not found: {e}"}
    except Exception as e:
        print(f"BATCH_PR_TASK: ERROR - Could not create/update AsyncTaskStatus for {task_id}. Error: {e}")
        # Task can proceed but status won't be fully tracked if task_status_obj is None.
        # This is problematic. Better to fail if status tracking can't be initialized.
        return {"status": "error", "message": f"Failed to initialize task status tracking: {e}"}

    # Use the fetched user_obj and repo_obj (renamed to repo_model for consistency with your original code)
    user = user_obj
    repo_model = repo_obj

    try:
        # Fetch CodeFile objects that are in file_ids_for_pr AND have at least one symbol with fresh docs
        code_files_to_process = CodeFile.objects.filter(
            id__in=file_ids_for_pr,
            repository=repo_model # Ensure files belong to the target repository
        ).annotate(
            fresh_direct_symbols_count=Count('symbols', filter=Q(
                symbols__documentation_hash=F('symbols__content_hash'),
                symbols__documentation__isnull=False, symbols__documentation__iregex=r'\S'
            )),
            fresh_method_symbols_count=Count('classes__methods', filter=Q(
                classes__methods__documentation_hash=F('classes__methods__content_hash'),
                classes__methods__documentation__isnull=False, classes__methods__documentation__iregex=r'\S'
            ))
        ).filter(
            Q(fresh_direct_symbols_count__gt=0) | Q(fresh_method_symbols_count__gt=0)
        ).distinct()

        if not code_files_to_process.exists():
            message = f"No files found in the selection with freshly documented symbols for repo {repo_id}."
            print(f"BATCH_PR_TASK: {message}")
            task_status_obj.status = AsyncTaskStatus.TaskStatus.SUCCESS # No error, just no action
            task_status_obj.message = message
            task_status_obj.progress = 100
            task_status_obj.save()
            return {"status": "info", "message": message}

        print(f"BATCH_PR_TASK: Found {code_files_to_process.count()} files with fresh docs to include in PR for repo {repo_id}.")
        task_status_obj.message = f"Found {code_files_to_process.count()} files with docs for PR. Preparing content..."
        task_status_obj.progress = 10
        task_status_obj.save(update_fields=['message', 'progress', 'updated_at'])

        actual_files_to_commit_content = {} 
        total_files_for_pr = code_files_to_process.count()
        files_prepared_for_pr = 0

        for code_file in code_files_to_process:
            print(f"BATCH_PR_TASK: Preparing file for PR: {code_file.file_path}")
            original_content_from_cache = get_source_for_file_in_task(code_file)
            if original_content_from_cache is None:
                print(f"BATCH_PR_TASK: Could not get source for {code_file.file_path} from cache. Skipping.")
                # Consider how to update overall progress/status if a file is skipped
                continue

            content_with_all_docs = original_content_from_cache
            symbols_in_file_with_docs = CodeSymbol.objects.filter(
                Q(code_file=code_file) | Q(code_class__code_file=code_file),
                documentation__isnull=False, 
                documentation__iregex=r'\S' 
            ).select_related('code_class').order_by('start_line')

            if not symbols_in_file_with_docs.exists():
                print(f"BATCH_PR_TASK: Re-checked and no symbols with documentation found in {code_file.file_path}. Skipping file from PR.")
                continue
                
            print(f"BATCH_PR_TASK: Injecting {symbols_in_file_with_docs.count()} docstrings into {code_file.file_path}")
            for symbol in symbols_in_file_with_docs:
                if symbol.documentation and symbol.documentation.strip():
                    content_with_all_docs = update_docstring_in_ast(
                        content_with_all_docs, symbol.name,
                        symbol.documentation, symbol.code_class.name if symbol.code_class else None
                    )
            
            final_formatted_content = content_with_all_docs
            try:
                process = subprocess.run(
                    ['ruff', 'format', '-'], input=content_with_all_docs, 
                    capture_output=True, text=True, check=False 
                )
                if process.returncode == 0:
                    final_formatted_content = process.stdout
                    print(f"BATCH_PR_TASK: Ruff formatted {code_file.file_path}")
                else:
                    print(f"BATCH_PR_TASK: Ruff failed for {code_file.file_path}: {process.stderr}. Using unformatted (AST-updated) content.")
            except Exception as e:
                print(f"BATCH_PR_TASK: Ruff exception for {code_file.file_path}: {e}. Using unformatted (AST-updated) content.")
                
            if final_formatted_content != original_content_from_cache:
                actual_files_to_commit_content[code_file.file_path] = final_formatted_content
                print(f"BATCH_PR_TASK: File {code_file.file_path} has effective changes and will be included in PR.")
            else:
                print(f"BATCH_PR_TASK: File {code_file.file_path} has no effective changes. Skipping from PR commit content.")

            files_prepared_for_pr +=1
            if total_files_for_pr > 0:
                task_status_obj.progress = 10 + int((files_prepared_for_pr / total_files_for_pr) * 40) # Progress up to 50%
                task_status_obj.message = f"Prepared file {files_prepared_for_pr}/{total_files_for_pr}: {code_file.file_path}"
                task_status_obj.save(update_fields=['progress', 'message', 'updated_at'])
        
        if not actual_files_to_commit_content:
            message = "No files with effective changes to commit after processing all selected files."
            print(f"BATCH_PR_TASK: {message}")
            task_status_obj.status = AsyncTaskStatus.TaskStatus.SUCCESS # No error, just no action
            task_status_obj.message = message
            task_status_obj.progress = 100
            task_status_obj.save()
            return {"status": "info", "message": message}

        task_status_obj.message = f"Committing {len(actual_files_to_commit_content)} files to new branch..."
        task_status_obj.progress = 50 
        task_status_obj.save(update_fields=['message', 'progress', 'updated_at'])
        
        # --- GitHub API Interaction for Multi-File Commit ---
        social_account = user.socialaccount_set.filter(provider='github').first()
        if not social_account: 
            raise Exception("GitHub account not linked for PR creation.")
        github_token = social_account.socialtoken_set.first().token
        g = Github(github_token)
        gh_repo = g.get_repo(repo_model.full_name)
        
        default_branch_name = gh_repo.default_branch
        default_branch_obj = gh_repo.get_branch(default_branch_name)
        base_commit_sha = default_branch_obj.commit.sha
        base_commit = gh_repo.get_commit(base_commit_sha)
        base_tree_sha = base_commit.commit.tree.sha
        print(f"BATCH_PR_TASK: Base commit SHA: {base_commit_sha}, Base tree SHA: {base_tree_sha} on branch '{default_branch_name}'")

        timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        sanitized_repo_name = repo_model.name.lower().replace(' ','-').replace('/','-')
        new_branch_name = f"helix-batch-docs/{sanitized_repo_name}-{timestamp}"
        
        try:
            gh_repo.create_git_ref(ref=f"refs/heads/{new_branch_name}", sha=base_commit_sha)
            print(f"BATCH_PR_TASK: Created branch {new_branch_name}")
        except GithubException as e:
            if e.status == 422 and e.data and "Reference already exists" in e.data.get("message", ""):
                print(f"BATCH_PR_TASK: Branch {new_branch_name} already exists. Attempting to use it.")
            else:
                raise 
        
        if task_status_obj:
            task_status_obj.message = f"Created branch {new_branch_name}. Preparing commit..."
            task_status_obj.progress = 60
            task_status_obj.save(update_fields=['message', 'progress', 'updated_at'])

        tree_elements = []
        for file_path_in_repo, new_content_string in actual_files_to_commit_content.items():
            blob = gh_repo.create_git_blob(new_content_string, "utf-8")
            tree_elements.append(InputGitTreeElement(path=file_path_in_repo, mode='100644', type='blob', sha=blob.sha))
            print(f"BATCH_PR_TASK: Prepared blob for {file_path_in_repo} (Blob SHA: {blob.sha})")
        
        base_tree_object = gh_repo.get_git_tree(base_tree_sha) # Fetch GitTree object
        new_tree = gh_repo.create_git_tree(tree_elements, base_tree=base_tree_object)
        print(f"BATCH_PR_TASK: Created new git tree (SHA: {new_tree.sha}) based on tree {base_tree_sha}")
        
        commit_message = f"Docs: Batch documentation update for {len(actual_files_to_commit_content)} file(s) via Helix CME"
        git_base_commit = gh_repo.get_git_commit(base_commit_sha)
        # The parent of our new commit is the commit the new branch was based on (base_commit)
        new_commit = gh_repo.create_git_commit(commit_message, new_tree, [git_base_commit] )
        print(f"BATCH_PR_TASK: Created new commit (SHA: {new_commit.sha})")

        if task_status_obj:
            task_status_obj.message = f"Commit created. Updating branch..."
            task_status_obj.progress = 80
            task_status_obj.save(update_fields=['message', 'progress', 'updated_at'])
        
        branch_ref = gh_repo.get_git_ref(f"heads/{new_branch_name}")
        branch_ref.edit(new_commit.sha)
        print(f"BATCH_PR_TASK: Updated branch {new_branch_name} to point to commit {new_commit.sha}")

        pr_title = f"Helix CME: Batch Documentation Update ({len(actual_files_to_commit_content)} files)"
        pr_body_files_list = "\n".join([f"- `{p}`" for p in actual_files_to_commit_content.keys()])
        pr_body = (
            f"This Pull Request was automatically generated by Helix CME to add or update documentation.\n\n"
            f"**Files updated in this batch:**\n{pr_body_files_list}"
        )
        
        if task_status_obj:
            task_status_obj.message = f"Creating Pull Request..."
            task_status_obj.progress = 90
            task_status_obj.save(update_fields=['message', 'progress', 'updated_at'])

        pull_request = gh_repo.create_pull(
            title=pr_title, body=pr_body,
            head=new_branch_name, base=default_branch_name
        )
        print(f"BATCH_PR_TASK: Created Pull Request: {pull_request.html_url}")

        final_message = f"Successfully created Pull Request for {len(actual_files_to_commit_content)} file(s)."
        task_status_obj.status = AsyncTaskStatus.TaskStatus.SUCCESS
        task_status_obj.message = final_message
        task_status_obj.progress = 100
        task_status_obj.result_data = {
            "pr_url": pull_request.html_url,
            "files_updated_count": len(actual_files_to_commit_content),
            "branch_name": new_branch_name
        }
        task_status_obj.save()
        return task_status_obj.result_data

    except GithubException as e:
        error_message = f"GitHub API error: {e.status} {e.data.get('message', str(e.data)) if e.data else str(e)}"
        print(f"BATCH_PR_TASK: {error_message}")
        if task_status_obj:
            task_status_obj.status = AsyncTaskStatus.TaskStatus.FAILURE
            task_status_obj.message = error_message
            task_status_obj.save()
        
        if 'new_branch_name' in locals() and 'gh_repo' in locals(): # Ensure gh_repo is defined
            try:
                ref = gh_repo.get_git_ref(f"heads/{new_branch_name}")
                ref.delete()
                print(f"BATCH_PR_TASK: Cleaned up branch {new_branch_name} due to PR creation error.")
            except Exception as branch_delete_e:
                print(f"BATCH_PR_TASK: Failed to cleanup branch {new_branch_name}: {branch_delete_e}")
        
        if e.status == 422 and e.data and "No commits between" in e.data.get("errors", [{}])[0].get("message", ""):
            # This specific error shouldn't cause a task retry if we handle "no changes" correctly earlier
            return {"status": "error", "message": "No changes to commit, PR not created."} 
        raise self.retry(exc=e, countdown=120) # Retry for other GitHub errors

    except Exception as e:
        error_message = f"Unexpected error in BATCH_PR_TASK: {str(e)}"
        print(f"BATCH_PR_TASK: {error_message}") # Log the full error
        import traceback
        traceback.print_exc() # Print full traceback for unexpected errors

        if task_status_obj:
            task_status_obj.status = AsyncTaskStatus.TaskStatus.FAILURE
            task_status_obj.message = error_message
            task_status_obj.save()

        if 'new_branch_name' in locals() and 'gh_repo' in locals(): # Ensure gh_repo is defined
            try:
                ref = gh_repo.get_git_ref(f"heads/{new_branch_name}")
                ref.delete()
                print(f"BATCH_PR_TASK: Cleaned up branch {new_branch_name} due to unexpected error.")
            except Exception as branch_delete_e:
                print(f"BATCH_PR_TASK: Failed to cleanup branch {new_branch_name}: {branch_delete_e}")
        raise # Re-raise for Celery to handle and mark as failed
@app.task(bind=True)
def detect_orphan_symbols_task(self, repo_id: int, user_id: int | None = None): # user_id for potential notification
    task_id = self.request.id
    print(f"ORPHAN_DETECT_TASK: Started (ID: {task_id}) for repo_id={repo_id}")

    task_status_obj = None
    user_obj = None
    repo_obj = None

    try:
        repo_obj = Repository.objects.get(id=repo_id)
        if user_id: # If user_id is provided (e.g., if triggered by a user action)
            user_obj = User.objects.get(id=user_id)
        else: # If triggered systemically (e.g., after process_repository), use repo owner
            user_obj = repo_obj.user

    except (Repository.DoesNotExist, User.DoesNotExist) as e:
        print(f"ORPHAN_DETECT_TASK: ERROR - Repo or User not found for task {task_id}: {e}")
        return {"status": "error", "message": "Repository or initiating user not found."}
    except Exception as e:
        print(f"ORPHAN_DETECT_TASK: ERROR - Creating AsyncTaskStatus for {task_id}: {e}")


    print(f"ORPHAN_DETECT_TASK: Analyzing repository: {repo_obj.full_name}")

    # --- Performant Orphan Detection ---
    # 1. Get all symbols belonging to this repository.
    all_symbols_in_repo_ids = CodeSymbol.objects.filter(
        Q(code_file__repository=repo_obj) | Q(code_class__code_file__repository=repo_obj)
    ).values_list('id', flat=True)

    if not all_symbols_in_repo_ids:
        print(f"ORPHAN_DETECT_TASK: No symbols found in repository {repo_obj.full_name}.")
        if task_status_obj:
            task_status_obj.status = AsyncTaskStatus.TaskStatus.SUCCESS
            task_status_obj.message = "No symbols found in repository to analyze."
            task_status_obj.progress = 100
            task_status_obj.save()
        return {"status": "success", "message": "No symbols found."}

    # 2. Get IDs of all symbols that are *callees* (i.e., are being called).
    #    We only care about callees that are within the current repository.
    called_symbol_ids_in_repo = CodeDependency.objects.filter(
        Q(callee_id__in=all_symbols_in_repo_ids) & # Callee is in this repo
        (Q(caller__code_file__repository=repo_obj) | Q(caller__code_class__code_file__repository=repo_obj)) # Caller is also in this repo
    ).values_list('callee_id', flat=True).distinct()
    
    called_symbol_ids_set = set(called_symbol_ids_in_repo)
    all_symbols_in_repo_ids_set = set(all_symbols_in_repo_ids)

    orphan_symbol_ids = list(all_symbols_in_repo_ids_set - called_symbol_ids_set)
    
    symbols_to_update_as_orphan = []
    symbols_to_update_as_not_orphan = []
    actually_marked_orphan_count = 0

    # Iterate through all symbols to update their status.
    # We could do this in two bulk updates: one for orphans, one for non-orphans.
    for symbol_id in all_symbols_in_repo_ids_set:
        is_potentially_orphan = symbol_id in orphan_symbol_ids
        
        # Apply entry point heuristics (MVP)
        # Example: Don't mark `__init__` methods as orphans for now.
        # A more robust check would see if the CLASS containing the __init__ is instantiated/used.
        is_known_entry_point = False
        if is_potentially_orphan:
            try:
                # Fetch the symbol to check its name, only if potentially orphan to save queries
                symbol_obj_for_check = CodeSymbol.objects.get(id=symbol_id)
                if symbol_obj_for_check.name == "__init__":
                    is_known_entry_point = True
                # Add more heuristics here:
                # e.g., if symbol_obj_for_check.name == "main" and not symbol_obj_for_check.code_class:
                # is_known_entry_point = True
            except CodeSymbol.DoesNotExist:
                continue # Should not happen if ID came from all_symbols_in_repo_ids

        is_truly_orphan = is_potentially_orphan and not is_known_entry_point

        # Update the symbol's is_orphan field
        # We collect IDs to do bulk updates for performance
        if is_truly_orphan:
            symbols_to_update_as_orphan.append(symbol_id)
        else:
            symbols_to_update_as_not_orphan.append(symbol_id)

    # Bulk update symbols
    if symbols_to_update_as_orphan:
        updated_count = CodeSymbol.objects.filter(id__in=symbols_to_update_as_orphan).update(is_orphan=True)
        actually_marked_orphan_count = updated_count
        print(f"ORPHAN_DETECT_TASK: Marked {updated_count} symbols as ORPHAN.")
    
    if symbols_to_update_as_not_orphan:
        updated_count = CodeSymbol.objects.filter(id__in=symbols_to_update_as_not_orphan).update(is_orphan=False)
        print(f"ORPHAN_DETECT_TASK: Marked {updated_count} symbols as NOT ORPHAN.")


    print(f"ORPHAN_DETECT_TASK: Orphan detection complete for repo {repo_obj.full_name}. Found {actually_marked_orphan_count} orphan symbols.")
    repo_obj = Repository.objects.get(id=repo_id) # Refetch or use existing repo_obj
    repo_obj.orphan_symbol_count = actually_marked_orphan_count
    repo_obj.save(update_fields=['orphan_symbol_count'])
    print(f"ORPHAN_DETECT_TASK: Repo {repo_id} orphan count updated to {actually_marked_orphan_count}")
    # --- Notification Logic ---
    if actually_marked_orphan_count > 0 and user_obj: # Check if user_obj was successfully fetched
        # Fetch details for a few orphan symbols for the notification message
        orphan_examples = CodeSymbol.objects.filter(id__in=symbols_to_update_as_orphan[:5]).select_related('code_file', 'code_class__code_file')
        example_details = []
        for orphan_sym in orphan_examples:
            file_p = orphan_sym.code_file.file_path if orphan_sym.code_file else (orphan_sym.code_class.code_file.file_path if orphan_sym.code_class else "N/A")
            example_details.append(f"- `{orphan_sym.name}` in `{file_p}`")
        
        details_msg = "\n".join(example_details)
        if len(symbols_to_update_as_orphan) > 5:
            details_msg += f"\n... and {len(symbols_to_update_as_orphan) - 5} more."

        notification_message = (
            f"{actually_marked_orphan_count} potential orphan (uncalled) symbol(s) "
            f"were detected in repository '{repo_obj.full_name}'.\n\nExamples:\n{details_msg}"
        )
        Notification.objects.create(
            user=user_obj, # Use the determined user object
            repository=repo_obj,
            message=notification_message,
            notification_type=Notification.NotificationType.STALENESS_ALERT # Re-use or add ORPHAN_ALERT type
            # link_url=f"/repositories/{repo_obj.id}/orphans/" # Future link to a page showing orphans
        )
        print(f"ORPHAN_DETECT_TASK: Created notification for {user_obj.username}.")

    if task_status_obj:
        task_status_obj.status = AsyncTaskStatus.TaskStatus.SUCCESS
        task_status_obj.message = f"Orphan detection complete. Found {actually_marked_orphan_count} orphan symbols."
        task_status_obj.progress = 100
        task_status_obj.result_data = {"orphan_count": actually_marked_orphan_count}
        task_status_obj.save()
        
    return {"status": "success", "orphan_count": actually_marked_orphan_count}
@shared_task
def calculate_documentation_coverage_task(repo_id):
    """Calculates and saves the documentation coverage for a repository."""
    try:
        repo = Repository.objects.get(id=repo_id)
        
        # Get all symbols associated with this repository
        all_symbols = CodeSymbol.objects.filter(
            Q(code_file__repository=repo) | Q(code_class__code_file__repository=repo)
        )
        total_symbol_count = all_symbols.count()

        if total_symbol_count == 0:
            coverage = 100.0 # Or 0.0, depending on how you want to treat empty repos
        else:
            # Count symbols that are considered "well-documented"
            # Let's define this as having a status of FRESH.
            documented_symbols_count = all_symbols.filter(
                documentation_status=CodeSymbol.DocStatus.FRESH
            ).count()
            coverage = (documented_symbols_count / total_symbol_count) * 100.0
        
        repo.documentation_coverage = coverage
        repo.save(update_fields=['documentation_coverage'])
        print(f"COVERAGE_TASK: Repo {repo_id} coverage updated to {coverage:.2f}%")
        return coverage
    except Repository.DoesNotExist:
        print(f"COVERAGE_TASK: Repository with id={repo_id} not found.")
        return None
@app.task(bind=True, max_retries=3, default_retry_delay=60) # Added retry for robustness
def submit_embedding_batch_job_task(self, repo_id: int):
    task_id = self.request.id # Celery task ID of this submission task
    print(f"EMBED_BATCH_SUBMIT_TASK: Started (ID: {task_id}) for repo_id {repo_id}")

    if not OPENAI_CLIENT:
        message = "OpenAI client not available (OPENAI_API_KEY not set or init failed). Cannot submit embedding batch."
        print(f"EMBED_BATCH_SUBMIT_TASK: {message}")
        # Potentially create an EmbeddingBatchJob record with a FAILED_SUBMISSION status
        # For now, we just log and exit.
        return {"status": "error", "message": message}

    try:
        repo = Repository.objects.get(id=repo_id)
    except Repository.DoesNotExist:
        print(f"EMBED_BATCH_SUBMIT_TASK: Repository with ID {repo_id} not found.")
        return {"status": "error", "message": f"Repository {repo_id} not found."}

    symbols_to_embed = CodeSymbol.objects.filter(
        (Q(code_file__repository=repo) | Q(code_class__code_file__repository=repo)),
        embedding__isnull=True # Embed only if embedding is currently null
    ).only('id', 'name', 'documentation', 'unique_id') # Fetch only needed fields

    if not symbols_to_embed.exists():
        message = f"No symbols requiring embedding found for repository {repo.full_name}."
        print(f"EMBED_BATCH_SUBMIT_TASK: {message}")
        return {"status": "success", "message": message, "batch_id": None}

    print(f"EMBED_BATCH_SUBMIT_TASK: Preparing batch file for {symbols_to_embed.count()} symbols from repo {repo.full_name}.")

    batch_requests_for_jsonl = []
    # Keep track of symbol pks for which requests are created, to update them later
    # if we decide to mark them as "embedding_job_submitted"
    symbol_pks_in_batch = [] 

    for symbol in symbols_to_embed:
        # custom_id must be unique within the batch file, max 64 chars.
        # Using `symbol-{pk}` is a good pattern.
        custom_id = f"symbol-{symbol.id}" 
        symbol_pks_in_batch.append(symbol.id)

        text_to_embed = symbol.name
        if symbol.documentation:
            # OpenAI recommends replacing newlines with spaces for their embedding models.
            doc_cleaned = symbol.documentation.replace("\n", " ").strip()
            if doc_cleaned: # Only append if there's actual content after cleaning
                text_to_embed += f"\n\n{doc_cleaned}" # Use a clear separator

        batch_requests_for_jsonl.append({
            "custom_id": custom_id,
            "method": "POST",
            "url": "/v1/embeddings", # Correct endpoint for embeddings
            "body": {
                "model": OPENAI_EMBEDDING_MODEL, # Your configured embedding model
                "input": text_to_embed
                # "encoding_format": "float", # Default is float, can also be "base64"
                # "dimensions": 1536 # Optional: if using a model that supports other dimensions
            }
        })
        
        # Adhere to OpenAI's per-batch request limit
        if len(batch_requests_for_jsonl) >= OPENAI_EMBEDDING_BATCH_FILE_MAX_REQUESTS:
            print(f"EMBED_BATCH_SUBMIT_TASK: Reached max requests ({OPENAI_EMBEDDING_BATCH_FILE_MAX_REQUESTS}) "
                  f"for a single batch file. Processing this batch and will skip remaining symbols for now.")
            break
            # A more advanced implementation would create multiple batch jobs.

    if not batch_requests_for_jsonl:
        message = f"No valid embedding requests generated for repository {repo.full_name}."
        print(f"EMBED_BATCH_SUBMIT_TASK: {message}")
        return {"status": "success", "message": message, "batch_id": None}

    # Create an initial EmbeddingBatchJob record to track this attempt
    # We'll update it with OpenAI IDs once the submission is successful
    job_record = EmbeddingBatchJob.objects.create(
        repository=repo,
        status=EmbeddingBatchJob.JobStatus.PENDING_SUBMISSION,
        custom_metadata={"celery_task_id": task_id, "symbol_count": len(batch_requests_for_jsonl)}
    )

    batch_input_file_path = None # Initialize for finally block
    try:
        # 2. Prepare your batch file (.jsonl)
        with tempfile.NamedTemporaryFile(mode='w+', suffix=".jsonl", delete=False, encoding='utf-8') as tmp_file:
            for request_data in batch_requests_for_jsonl:
                tmp_file.write(json.dumps(request_data) + "\n")
            batch_input_file_path = tmp_file.name
        
        print(f"EMBED_BATCH_SUBMIT_TASK: Batch input file created at {batch_input_file_path} for Job ID {job_record.id}")

        # 3. Upload your batch input file to OpenAI
        with open(batch_input_file_path, "rb") as f_for_upload:
            uploaded_file_response = OPENAI_CLIENT.files.create(
                file=f_for_upload,
                purpose="batch" # This purpose is required for Batch API
            )
        job_record.input_file_id = uploaded_file_response.id
        print(f"EMBED_BATCH_SUBMIT_TASK: Batch input file uploaded. OpenAI File ID: {uploaded_file_response.id} for Job ID {job_record.id}")

        # 4. Create the batch job with OpenAI
        openai_batch_response = OPENAI_CLIENT.batches.create(
            input_file_id=uploaded_file_response.id,
            endpoint="/v1/embeddings", # Must match the URL in your .jsonl requests
            completion_window="24h",   # Currently, only "24h" is supported
            metadata={ # Optional metadata for your reference on OpenAI's side
                "helix_cme_job_id": str(job_record.id),
                "repository_id": str(repo.id),
                "repository_name": repo.full_name,
                "description": f"Helix CME: Embedding generation for {repo.full_name}"
            }
        )
        job_record.batch_id = openai_batch_response.id # This is the crucial OpenAI Batch ID
        job_record.status = openai_batch_response.status # e.g., 'validating'
        job_record.submitted_to_openai_at = timezone.now()
        job_record.openai_metadata = openai_batch_response.to_dict() # Store the full response
        job_record.save()
        
        print(f"EMBED_BATCH_SUBMIT_TASK: OpenAI Batch job created. OpenAI Batch ID: {openai_batch_response.id}, "
              f"Status: {openai_batch_response.status} for Job ID {job_record.id}")
        
        return {
            "status": "success", 
            "message": "Embedding batch job successfully submitted to OpenAI.",
            "helix_job_id": job_record.id,
            "openai_batch_id": openai_batch_response.id
        }

    except Exception as e:
        error_message = f"Error during OpenAI file upload or batch creation for Job ID {job_record.id}: {str(e)}"
        print(f"EMBED_BATCH_SUBMIT_TASK: {error_message}")
        job_record.status = EmbeddingBatchJob.JobStatus.FAILED # Or a specific "submission_failed" status
        job_record.error_details = error_message
        job_record.save()
        # Re-raise the exception if you want Celery to retry based on max_retries
        # self.retry(exc=e) 
        return {"status": "error", "message": error_message, "helix_job_id": job_record.id}
    finally:
        # Clean up the temporary file
        if batch_input_file_path and os.path.exists(batch_input_file_path):
            os.remove(batch_input_file_path)
            print(f"EMBED_BATCH_SUBMIT_TASK: Cleaned up temporary file {batch_input_file_path}")
            
@app.task
def generate_insights_on_change_task(repo_id: int, commit_hash: str, diff_report: dict):
    """
    Analyzes a diff report from process_repository and creates Insight records.
    """
    print(f"INSIGHTS_TASK: Started for repo {repo_id}, commit {commit_hash[:7]}")
    
    try:
        repo = Repository.objects.get(id=repo_id)
    except Repository.DoesNotExist:
        print(f"INSIGHTS_TASK: ERROR - Repository {repo_id} not found.")
        return

    insights_to_create = []

    # Process added symbols
    for symbol_data in diff_report.get('added_symbols', []):
        message = f"Symbol '{symbol_data['name']}' was added in file '{symbol_data['file_path']}'."
        insights_to_create.append(
            Insight(
                repository=repo,
                commit_hash=commit_hash,
                insight_type=Insight.InsightType.SYMBOL_ADDED,
                message=message,
                data=symbol_data,
                related_symbol_id=symbol_data.get('id')
            )
        )

    # Process modified symbols
    for symbol_data in diff_report.get('modified_symbols', []):
        message = f"Symbol '{symbol_data['name']}' was modified in file '{symbol_data['file_path']}'."
        insights_to_create.append(
            Insight(
                repository=repo,
                commit_hash=commit_hash,
                insight_type=Insight.InsightType.SYMBOL_MODIFIED,
                message=message,
                data=symbol_data,
                related_symbol_id=symbol_data.get('id')
            )
        )

    # Process removed symbols
    for symbol_data in diff_report.get('removed_symbols', []):
        message = f"Symbol '{symbol_data['name']}' was removed from file '{symbol_data['file_path']}'."
        insights_to_create.append(
            Insight(
                repository=repo,
                commit_hash=commit_hash,
                insight_type=Insight.InsightType.SYMBOL_REMOVED,
                message=message,
                data=symbol_data,
                # related_symbol will be null since it's deleted
            )
        )

    if insights_to_create:
        Insight.objects.bulk_create(insights_to_create)
        print(f"INSIGHTS_TASK: Created {len(insights_to_create)} new insights for repo {repo_id}.")
    else:
        print(f"INSIGHTS_TASK: No structural changes found to generate insights for repo {repo_id}.")

@app.task(bind=True)
def submit_knowledge_chunk_embedding_batch_task(self, repo_id: int):
    """
    Creates and submits a new batch job to OpenAI for embedding KnowledgeChunk records.

    This task queries for KnowledgeChunk objects that do not yet have an embedding,
    formats them into a .jsonl file, uploads the file, and creates the batch job.
    It is designed to be triggered after `index_repository_knowledge_task` has
    created the content chunks.
    """
    task_id = self.request.id
    print(f"KNOWLEDGE_BATCH_SUBMIT_TASK: Started (ID: {task_id}) for repo_id {repo_id}")

    # 1. Pre-flight check for OpenAI Client
    if not OPENAI_CLIENT:
        message = "OpenAI client not available (OPENAI_API_KEY not set or init failed). Cannot submit embedding batch."
        print(f"KNOWLEDGE_BATCH_SUBMIT_TASK: FATAL - {message}")
        # We cannot proceed, so we exit.
        return {"status": "error", "message": message}

    # 2. Fetch Repository
    try:
        repo = Repository.objects.get(id=repo_id)
    except Repository.DoesNotExist:
        message = f"Repository with ID {repo_id} not found."
        print(f"KNOWLEDGE_BATCH_SUBMIT_TASK: FATAL - {message}")
        return {"status": "error", "message": message}

    # 3. Query for KnowledgeChunks that need embedding
    chunks_to_embed = KnowledgeChunk.objects.filter(
        repository=repo,
        embedding__isnull=True  # The primary condition for selecting chunks
    ).only('id', 'content')     # Fetch only the fields necessary for the batch file

    if not chunks_to_embed.exists():
        message = f"No new knowledge chunks requiring embedding found for repository {repo.full_name}."
        print(f"KNOWLEDGE_BATCH_SUBMIT_TASK: {message}")
        return {"status": "success", "message": message, "batch_id": None}

    print(f"KNOWLEDGE_BATCH_SUBMIT_TASK: Preparing batch file for {chunks_to_embed.count()} knowledge chunks from repo '{repo.full_name}'.")

    # 4. Prepare the requests for the JSONL file
    batch_requests_for_jsonl = []
    chunk_pks_in_batch = []

    for chunk in chunks_to_embed:
        # The custom_id must be unique within the batch file and max 64 chars.
        # `chunk-{pk}` is a robust pattern.
        custom_id = f"chunk-{chunk.id}"
        chunk_pks_in_batch.append(chunk.id)

        # The content from the chunk is already formatted with context.
        text_to_embed = chunk.content

        batch_requests_for_jsonl.append({
            "custom_id": custom_id,
            "method": "POST",
            "url": "/v1/embeddings",
            "body": {
                "model": OPENAI_EMBEDDING_MODEL,
                "input": text_to_embed
            }
        })
        
        # Adhere to OpenAI's documented limit per batch file.
        if len(batch_requests_for_jsonl) >= OPENAI_EMBEDDING_BATCH_FILE_MAX_REQUESTS:
            print(f"KNOWLEDGE_BATCH_SUBMIT_TASK: Reached max requests ({OPENAI_EMBEDDING_BATCH_FILE_MAX_REQUESTS}). "
                  f"Submitting a partial batch. Another run will be needed for remaining chunks.")
            break

    if not batch_requests_for_jsonl:
        message = f"No valid embedding requests were generated for repository {repo.full_name}."
        print(f"KNOWLEDGE_BATCH_SUBMIT_TASK: {message}")
        return {"status": "success", "message": message, "batch_id": None}

    # 5. Create our internal job record to track this submission
    job_record = EmbeddingBatchJob.objects.create(
        repository=repo,
        job_type=EmbeddingBatchJob.JobType.KNOWLEDGE_CHUNK_EMBEDDING,
        status=EmbeddingBatchJob.JobStatus.PENDING_SUBMISSION,
        custom_metadata={"celery_task_id": task_id, "chunk_count": len(batch_requests_for_jsonl)}
    )

    batch_input_file_path = None
    try:
        # 6. Create the temporary .jsonl file
        with tempfile.NamedTemporaryFile(mode='w+', suffix=".jsonl", delete=False, encoding='utf-8') as tmp_file:
            for request_data in batch_requests_for_jsonl:
                tmp_file.write(json.dumps(request_data) + "\n")
            batch_input_file_path = tmp_file.name
        
        print(f"KNOWLEDGE_BATCH_SUBMIT_TASK: Batch input file created at {batch_input_file_path} for Job ID {job_record.id}")

        # 7. Upload the file to OpenAI
        with open(batch_input_file_path, "rb") as f_for_upload:
            uploaded_file = OPENAI_CLIENT.files.create(
                file=f_for_upload,
                purpose="batch"
            )
        
        job_record.input_file_id = uploaded_file.id
        print(f"KNOWLEDGE_BATCH_SUBMIT_TASK: Batch input file uploaded. OpenAI File ID: {uploaded_file.id}")

        # 8. Create the batch job using the uploaded file
        openai_batch = OPENAI_CLIENT.batches.create(
            input_file_id=uploaded_file.id,
            endpoint="/v1/embeddings",
            completion_window="24h",
            metadata={
                "helix_cme_job_id": str(job_record.id),
                "repository_id": str(repo.id),
                "description": f"Helix CME: Knowledge Chunk embedding for {repo.full_name}"
            }
        )
        
        # 9. Update our internal record with the crucial IDs and status from OpenAI
        job_record.batch_id = openai_batch.id
        job_record.status = openai_batch.status # This will likely be 'validating'
        job_record.submitted_to_openai_at = timezone.now()
        job_record.openai_metadata = openai_batch.to_dict()
        job_record.save()
        
        print(f"KNOWLEDGE_BATCH_SUBMIT_TASK: OpenAI Batch job created successfully. OpenAI Batch ID: {openai_batch.id}, "
              f"Status: {openai_batch.status} for our Job ID {job_record.id}")
        
        return {
            "status": "success", 
            "message": "Knowledge chunk embedding batch job successfully submitted to OpenAI.",
            "helix_job_id": job_record.id,
            "openai_batch_id": openai_batch.id
        }

    except Exception as e:
        error_message = f"Error during OpenAI batch submission for Job ID {job_record.id}: {str(e)}"
        print(f"KNOWLEDGE_BATCH_SUBMIT_TASK: FATAL - {error_message}")
        
        # Update our job record to reflect the failure
        job_record.status = EmbeddingBatchJob.JobStatus.FAILED_VALIDATION # Or a more generic FAILED
        job_record.error_details = error_message
        job_record.save()
        
        # Optionally re-raise to have Celery retry the task, though for submission errors,
        # it might be better to fix the issue and re-trigger manually.
        # self.retry(exc=e) 
        return {"status": "error", "message": error_message, "helix_job_id": job_record.id}
    
    finally:
        # 10. Clean up the temporary file from the local filesystem
        if batch_input_file_path and os.path.exists(batch_input_file_path):
            os.remove(batch_input_file_path)
            print(f"KNOWLEDGE_BATCH_SUBMIT_TASK: Cleaned up temporary file {batch_input_file_path}")
@app.task
def index_repository_knowledge_task(repo_id: int):
    """
    Creates knowledge chunk records for a repository WITHOUT generating embeddings.
    After creation, it dispatches a separate task to handle the embedding via the Batch API.
    """
    print(f"KNOWLEDGE_INDEX_TASK: Starting content chunking for repo_id: {repo_id}")
    
    try:
        repo = Repository.objects.get(id=repo_id)
    except Repository.DoesNotExist:
        print(f"KNOWLEDGE_INDEX_TASK: ERROR - Repository {repo_id} not found.")
        return

    # Clear old chunks to ensure data is fresh
    deleted_count, _ = KnowledgeChunk.objects.filter(repository=repo).delete()
    print(f"KNOWLEDGE_INDEX_TASK: Cleared {deleted_count} old knowledge chunks for repo {repo.id}.")

    symbols_to_index = CodeSymbol.objects.filter(
        Q(code_file__repository=repo) | Q(code_class__code_file__repository=repo)
    ).select_related('code_file', 'code_class__code_file').iterator(chunk_size=500)

    chunks_to_create = []

    for symbol in symbols_to_index:
        # Chunk for Docstring
        if symbol.documentation and len(symbol.documentation.strip()) > 20:
            doc_content = f"Documentation for function '{symbol.name}':\n{symbol.documentation}"
            chunks_to_create.append(KnowledgeChunk(
                repository=repo,
                chunk_type=KnowledgeChunk.ChunkType.SYMBOL_DOCSTRING,
                content=doc_content,
                embedding=None, # Explicitly null
                related_symbol=symbol,
                related_class=symbol.code_class,
                related_file=symbol.code_file or (symbol.code_class and symbol.code_class.code_file)
            ))

        # Chunk for Source Code
        source_code = symbol.source_code
        if source_code and not source_code.strip().startswith("# Error:"):
            source_content = f"Source code for function '{symbol.name}':\n```python\n{source_code}\n```"
            chunks_to_create.append(KnowledgeChunk(
                repository=repo,
                chunk_type=KnowledgeChunk.ChunkType.SYMBOL_SOURCE,
                content=source_content,
                embedding=None, # Explicitly null
                related_symbol=symbol,
                related_class=symbol.code_class,
                related_file=symbol.code_file or (symbol.code_class and symbol.code_class.code_file)
            ))

    if not chunks_to_create:
        print(f"KNOWLEDGE_INDEX_TASK: No new content found to index for repo {repo.id}. Task complete.")
        return

    try:
        KnowledgeChunk.objects.bulk_create(chunks_to_create, batch_size=500)
        print(f"KNOWLEDGE_INDEX_TASK: Created {len(chunks_to_create)} knowledge chunks (without embeddings).")

        # --- NEW: Dispatch the batch submission task ---
        print(f"KNOWLEDGE_INDEX_TASK: Dispatching batch job submission task for repo {repo.id}.")
        submit_knowledge_chunk_embedding_batch_task.delay(repo_id=repo.id)
        # --- END NEW ---

    except Exception as e:
        print(f"KNOWLEDGE_INDEX_TASK: FATAL - DB error during bulk_create: {e}")


@app.task(bind=True)
def poll_and_process_completed_batches_task(self):
    """
    Periodically polls for EmbeddingBatchJob records that are in progress,
    checks their status with OpenAI, and processes completed jobs by updating
    the corresponding KnowledgeChunk records with their new embeddings.
    """
    task_id = self.request.id
    print(f"BATCH_POLL_TASK: Started (ID: {task_id})")

    if not OPENAI_CLIENT:
        print("BATCH_POLL_TASK: Aborting, OpenAI client not available.")
        return

    # 1. Find our jobs that are currently in-flight with OpenAI.
    # We query for any status that is not a final terminal state.
    in_progress_jobs = EmbeddingBatchJob.objects.filter(
        status__in=['validating', 'in_progress', 'finalizing']
    ).select_related('repository')

    if not in_progress_jobs.exists():
        print("BATCH_POLL_TASK: No in-progress batch jobs found to poll.")
        return

    print(f"BATCH_POLL_TASK: Found {in_progress_jobs.count()} in-progress jobs to check.")

    for job in in_progress_jobs:
        try:
            print(f"BATCH_POLL_TASK: Checking status for Job ID {job.id} (OpenAI Batch ID: {job.batch_id})")
            
            # 2. Retrieve the latest status of the batch job from OpenAI.
            openai_batch = OPENAI_CLIENT.batches.retrieve(job.batch_id)
            
            # Update our local record with the latest status and metadata.
            job.status = openai_batch.status
            job.openai_metadata = openai_batch.to_dict()
            job.save(update_fields=['status', 'openai_metadata'])

            # 3. Check if the job is completed and ready for processing.
            if openai_batch.status == 'completed':
                print(f"BATCH_POLL_TASK: Job {job.id} is COMPLETED. Processing results...")
                
                output_file_id = openai_batch.output_file_id
                error_file_id = openai_batch.error_file_id

                if error_file_id:
                    print(f"BATCH_POLL_TASK: Job {job.id} completed but with an error file ({error_file_id}).")
                    # You could add logic here to download and inspect the error file if needed.

                if not output_file_id:
                    raise Exception("Batch job completed but no output_file_id was provided by OpenAI.")

                # 4. Download the output file content from OpenAI.
                output_file_content_response = OPENAI_CLIENT.files.content(output_file_id)
                output_data = output_file_content_response.read().decode('utf-8')
                
                # 5. Parse the JSONL output file line by line.
                output_lines = output_data.strip().split('\n')
                print(f"BATCH_POLL_TASK: Downloaded output file for job {job.id} with {len(output_lines)} lines.")
                
                updates_to_perform = {} # Using a dict for efficient lookup: {chunk_pk: embedding_vector}

                for i, line in enumerate(output_lines):
                    if not line.strip():
                        continue
                    
                    print(f"BATCH_POLL_TASK: [Job {job.id} Line {i+1}] Parsing line: {line[:150]}...")
                    
                    try:
                        result_item = json.loads(line)
                        custom_id = result_item.get('custom_id')

                        if not custom_id:
                            print(f"BATCH_POLL_TASK: [Job {job.id} Line {i+1}] SKIPPING - No custom_id found.")
                            continue

                        if result_item.get('error'):
                            print(f"BATCH_POLL_TASK: [Job {job.id} Line {i+1}] SKIPPING - Item has an error in output file: {result_item['error']}")
                            continue

                        response_body = result_item.get('response', {}).get('body', {})
                        if not response_body:
                            print(f"BATCH_POLL_TASK: [Job {job.id} Line {i+1}] SKIPPING - 'response' or 'body' key missing for {custom_id}.")
                            continue

                        data_list = response_body.get('data')
                        if not isinstance(data_list, list) or not data_list:
                            print(f"BATCH_POLL_TASK: [Job {job.id} Line {i+1}] SKIPPING - 'data' array is missing or empty for {custom_id}.")
                            continue

                        embedding = data_list[0].get('embedding')
                        if not isinstance(embedding, list):
                            print(f"BATCH_POLL_TASK: [Job {job.id} Line {i+1}] SKIPPING - 'embedding' vector is missing or not a list for {custom_id}.")
                            continue
                        
                        if custom_id.startswith('chunk-'):
                            chunk_pk = int(custom_id.split('-')[1])
                            updates_to_perform[chunk_pk] = embedding
                            print(f"BATCH_POLL_TASK: [Job {job.id} Line {i+1}] SUCCESS - Staged update for KnowledgeChunk ID {chunk_pk}.")
                        else:
                            print(f"BATCH_POLL_TASK: [Job {job.id} Line {i+1}] SKIPPING - custom_id '{custom_id}' has invalid format.")

                    except (json.JSONDecodeError, IndexError, KeyError, ValueError) as e:
                        print(f"BATCH_POLL_TASK: [Job {job.id} Line {i+1}] FATAL PARSE ERROR - {e}\nLine: '{line}'")
                        continue

                # 6. Perform the database update.
                if not updates_to_perform:
                    error_msg = "Job completed but no successful updates could be parsed from the output file. Check parsing logic and file content."
                    print(f"BATCH_POLL_TASK: [Job {job.id}] {error_msg}")
                    job.status = EmbeddingBatchJob.JobStatus.FAILED 
                    job.error_details = error_msg
                    job.completed_at = timezone.now()
                    job.save()
                    continue

                print(f"BATCH_POLL_TASK: [Job {job.id}] Preparing to update {len(updates_to_perform)} KnowledgeChunk records.")
                
                # Use a transaction to ensure all updates succeed or none do.
                with transaction.atomic():
                    chunks_to_update = list(KnowledgeChunk.objects.filter(id__in=updates_to_perform.keys()))
                    
                    if len(chunks_to_update) != len(updates_to_perform):
                         print(f"BATCH_POLL_TASK: [Job {job.id}] WARNING - DB query found {len(chunks_to_update)} chunks, but expected {len(updates_to_perform)}. Some chunks may have been deleted.")

                    for chunk in chunks_to_update:
                        embedding_vector = updates_to_perform.get(chunk.id)
                        if embedding_vector:
                            chunk.embedding = embedding_vector
                    
                    KnowledgeChunk.objects.bulk_update(chunks_to_update, ['embedding'], batch_size=500)
                
                print(f"BATCH_POLL_TASK: [Job {job.id}] Successfully updated {len(chunks_to_update)} KnowledgeChunk records with new embeddings.")

                # 7. Finalize our internal job record.
                job.output_file_id = output_file_id
                job.completed_at = timezone.now()
                job.save(update_fields=['output_file_id', 'completed_at'])

            elif openai_batch.status in ['failed', 'expired', 'cancelled']:
                # Handle terminal failure states.
                print(f"BATCH_POLL_TASK: Job {job.id} has failed or expired. Status: {openai_batch.status}")
                job.error_details = json.dumps(openai_batch.errors) if openai_batch.errors else f"Job terminated with status: {openai_batch.status}"
                job.completed_at = timezone.now()
                job.save(update_fields=['error_details', 'completed_at'])
            
            else:
                # Status is still 'validating', 'in_progress', or 'finalizing'.
                print(f"BATCH_POLL_TASK: Job {job.id} is still in progress. Status: {openai_batch.status}")

        except Exception as e:
            error_message = f"An unexpected error occurred while processing job {job.id}: {str(e)}"
            print(f"BATCH_POLL_TASK: ERROR - {error_message}")
            # Mark the job as failed in our DB to prevent retries on a potentially permanent issue.
            try:
                job.status = EmbeddingBatchJob.JobStatus.FAILED
                job.error_details = error_message
                job.save()
            except Exception as save_err:
                print(f"BATCH_POLL_TASK: CRITICAL - Could not even save failure status for job {job.id}: {save_err}")
            
            # Continue to the next job in the loop
            continue


@app.task(bind=True)
def create_pr_with_changes_task(
    self,
    user_id: int,
    repo_id: int,
    file_path: str,
    new_content: str,
    commit_message: str,
    branch_name: str,
    base_branch: str # The branch to open the PR against (e.g., 'main' or 'master')
):
    """
    An asynchronous task to perform Git operations: create a new branch,
    commit changes, push to GitHub, and open a Pull Request.
    """
    task_id = self.request.id
    print(f"CREATE_PR_TASK: Started (ID: {task_id}) for repo {repo_id}, user {user_id}")
    
    # We use our existing AsyncTaskStatus model to report progress to the frontend
    status_tracker, _ = AsyncTaskStatus.objects.update_or_create(
        task_id=task_id,
        defaults={'user_id': user_id, 'status': 'PENDING', 'name': 'Create Pull Request'}
    )

    def update_status(progress: int, message: str):
        status_tracker.progress = progress
        status_tracker.message = message
        status_tracker.save(update_fields=['progress', 'message'])

    try:
        # 1. Fetch necessary objects from the database
        update_status(10, "Authenticating and fetching repository details...")
        repo = Repository.objects.get(id=repo_id, user_id=user_id)
        user_social_account = SocialAccount.objects.get(user_id=user_id, provider='github')
        social_token = SocialToken.objects.get(account=user_social_account)
        
        github_token = social_token.token
        github_username = user_social_account.extra_data.get('login')
        
        if not all([github_token, github_username]):
            raise Exception("Could not retrieve valid GitHub credentials for the user.")

        repo_path = os.path.join(REPO_CACHE_BASE_PATH, str(repo.id))
        full_file_path = os.path.join(repo_path, file_path)

        # 2. Prepare the local Git repository
        update_status(25, f"Syncing with remote branch '{base_branch}'...")
        # Ensure we are on the base branch and it's up-to-date
        subprocess.run(['git', '-C', repo_path, 'checkout', base_branch], check=True, capture_output=True)
        subprocess.run(['git', '-C', repo_path, 'pull', 'origin', base_branch], check=True, capture_output=True)

        # 3. Create the new branch
        update_status(40, f"Creating new branch '{branch_name}'...")
        subprocess.run(['git', '-C', repo_path, 'checkout', '-b', branch_name], check=True, capture_output=True)

        # 4. Apply the file changes
        update_status(50, f"Applying changes to '{file_path}'...")
        with open(full_file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

        # 5. Commit the changes
        update_status(60, "Committing changes...")
        subprocess.run(['git', '-C', repo_path, 'add', file_path], check=True, capture_output=True)
        subprocess.run(['git', '-C', repo_path, 'commit', '-m', commit_message], check=True, capture_output=True)

        # 6. Push the new branch to GitHub
        update_status(75, f"Pushing branch '{branch_name}' to GitHub...")
        # We inject the token into the URL for authentication
        push_url = f"https://{github_username}:{github_token}@github.com/{repo.full_name}.git"
        subprocess.run(['git', '-C', repo_path, 'push', push_url, branch_name], check=True, capture_output=True)

        # 7. Open the Pull Request using the GitHub API
        update_status(90, "Creating Pull Request...")
        # Use a GitHub API client library like PyGithub or make a direct requests call
        # For simplicity, we'll use `requests` here.
        pr_api_url = f"https://api.github.com/repos/{repo.full_name}/pulls"
        headers = {
            'Authorization': f'token {github_token}',
            'Accept': 'application/vnd.github.v3+json',
        }
        pr_data = {
            'title': commit_message,
            'head': branch_name,
            'base': base_branch,
            'body': 'This Pull Request was generated by Helix CME.',
        }
        response = requests.post(pr_api_url, headers=headers, json=pr_data)
        response.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx)
        
        pr_response_data = response.json()
        pr_url = pr_response_data.get('html_url')

        # 8. Finalize the task status
        status_tracker.status = 'SUCCESS'
        status_tracker.progress = 100
        status_tracker.message = f"Successfully created Pull Request!"
        status_tracker.result = {'pull_request_url': pr_url}
        status_tracker.save()

        print(f"CREATE_PR_TASK: Success! PR created at {pr_url}")
        return status_tracker.result

    except Exception as e:
        print(f"CREATE_PR_TASK: FAILED (ID: {task_id}). Error: {e}")
        # Check if it's a subprocess error to provide more detail
        if isinstance(e, subprocess.CalledProcessError):
            error_details = e.stderr.decode('utf-8') if e.stderr else str(e)
        else:
            error_details = str(e)
        
        status_tracker.status = 'FAILURE'
        status_tracker.message = "An error occurred while creating the Pull Request."
        status_tracker.result = {'error': error_details}
        status_tracker.save()
        raise self.replace(e) # Re-raise to mark the task as failed in Celery monitoring
    

@app.task
def sync_knowledge_index_task(repo_id: int):
    """
    Synchronizes all sources of knowledge (Module READMEs, Class Summaries,
    Symbol Docs/Code) into the KnowledgeChunk table for a repository.
    This is the single task responsible for building the RAG index.
    """
    print(f"KNOWLEDGE_SYNC_TASK: Starting for repo_id: {repo_id}")
    
    try:
        repo = Repository.objects.get(id=repo_id)
    except Repository.DoesNotExist:
        print(f"KNOWLEDGE_SYNC_TASK: ERROR - Repository {repo_id} not found.")
        return

    # For idempotency, we can clear all chunks and rebuild.
    # A more advanced version could use hashes to only update changed items.
    KnowledgeChunk.objects.filter(repository=repo).delete()
    print(f"KNOWLEDGE_SYNC_TASK: Cleared old knowledge chunks for repo {repo.id}.")

    chunks_to_create = []

    # 1. Index ModuleDocumentation
    module_docs = ModuleDocumentation.objects.filter(repository=repo)
    for doc in module_docs:
        chunks_to_create.append(KnowledgeChunk(
            repository=repo,
            chunk_type=KnowledgeChunk.ChunkType.MODULE_README,
            content=f"README for module '{doc.module_path}':\n{doc.content_md}",
            # We can't link to a specific file/symbol, which is fine.
        ))

    # 2. Index CodeClass summaries
    classes_with_summaries = CodeClass.objects.filter(
        code_file__repository=repo,
        generated_summary_md__isnull=False
    ).exclude(generated_summary_md__exact='')
    
    for code_class in classes_with_summaries:
        chunks_to_create.append(KnowledgeChunk(
            repository=repo,
            chunk_type=KnowledgeChunk.ChunkType.CLASS_SUMMARY,
            content=f"Summary for class '{code_class.name}':\n{code_class.generated_summary_md}",
            related_class=code_class,
            related_file=code_class.code_file
        ))

    # 3. Index CodeSymbol docstrings and source
    symbols = CodeSymbol.objects.filter(
        Q(code_file__repository=repo) | Q(code_class__code_file__repository=repo)
    ).select_related('code_file', 'code_class__code_file')

    for symbol in symbols:
        # Docstring
        if symbol.documentation and len(symbol.documentation.strip()) > 20:
            chunks_to_create.append(KnowledgeChunk(
                repository=repo, chunk_type=KnowledgeChunk.ChunkType.SYMBOL_DOCSTRING,
                content=f"Documentation for function '{symbol.name}':\n{symbol.documentation}",
                related_symbol=symbol, related_class=symbol.code_class,
                related_file=symbol.code_file or (symbol.code_class and symbol.code_class.code_file)
            ))
        # Source Code
        source_code = symbol.source_code
        if source_code and not source_code.strip().startswith("# Error:"):
             chunks_to_create.append(KnowledgeChunk(
                repository=repo, chunk_type=KnowledgeChunk.ChunkType.SYMBOL_SOURCE,
                content=f"Source code for function '{symbol.name}':\n```python\n{source_code}\n```",
                related_symbol=symbol, related_class=symbol.code_class,
                related_file=symbol.code_file or (symbol.code_class and symbol.code_class.code_file)
            ))

    if not chunks_to_create:
        print(f"KNOWLEDGE_SYNC_TASK: No content found to index for repo {repo.id}.")
        return

    # Save all chunks without embeddings first
    KnowledgeChunk.objects.bulk_create(chunks_to_create, batch_size=500)
    print(f"KNOWLEDGE_SYNC_TASK: Created {len(chunks_to_create)} knowledge chunk records.")

    # Dispatch the existing batch embedding task to finish the job
    submit_knowledge_chunk_embedding_batch_task.delay(repo_id=repo.id)
    print(f"KNOWLEDGE_SYNC_TASK: Dispatched embedding task for repo {repo.id}.")

@app.task
def generate_and_save_module_readme_task(previous_task_result, repo_id: int, module_path: str):
    """
    A Celery task wrapper for the generate_module_readme_stream service.
    It generates, saves, and then triggers the final knowledge sync.
    """
    print(f"README_GENERATION_TASK: Starting for repo {repo_id}, path '{module_path}'.")
    
    # The previous_task_result from the batch doc generation isn't strictly needed,
    # but Celery chains require the function to accept it.
    
    # We need to re-initialize the client inside the task
    client = OPENAI_CLIENT
    if not client:
        raise Exception("OpenAI client not available in README generation task.")

    # Call the existing stream generator
    readme_stream = generate_module_readme_stream(
        repo_id=repo_id,
        module_path=module_path,
        openai_client=client
    )
    
    # Consume the stream to get the full content
    full_readme_content = "".join([chunk for chunk in readme_stream])

    if full_readme_content and not full_readme_content.strip().startswith("//"):
        # Save the generated README to our ModuleDocumentation model
        module_doc, created = ModuleDocumentation.objects.update_or_create(
            repository_id=repo_id,
            module_path=module_path,
            defaults={'content_md': full_readme_content.strip()}
        )
        print(f"README_GENERATION_TASK: {'Created' if created else 'Updated'} README for '{module_path}'.")

        # Final step: trigger the knowledge index sync
        sync_knowledge_index_task.delay(repo_id=repo_id)
        print(f"README_GENERATION_TASK: Dispatched knowledge sync for repo {repo_id}.")
        
        
        return {"status": "success", "module_doc_id": module_doc.id}
    else:
        raise Exception("Failed to generate valid README content from AI.")


# This is the new "master" task that the view will call
@app.task(bind=True)
def generate_module_documentation_workflow_task(self, user_id: int, repo_id: int, module_path: str):
    """
    Orchestrates the full workflow:
    1. Find and document all undocumented symbols in a module.
    2. Generate a README for that module.
    3. Update the knowledge index.
    """
    task_id = self.request.id
    print(f"MODULE_WORKFLOW_TASK: Started (ID: {task_id}) for repo {repo_id}, path '{module_path}'")
    
    status_tracker, _ = AsyncTaskStatus.objects.update_or_create(
        task_id=task_id,
        defaults = {
            'user_id': user_id,
            'repository_id': repo_id,
            'task_name': AsyncTaskStatus.TaskName.MODULE_WORKFLOW,
            'status': AsyncTaskStatus.TaskStatus.PENDING,
            'message': f"Workflow initiated for module: '{module_path or 'root'}'"
        }
    )

    # Find all file IDs that need processing
    files_in_module = CodeFile.objects.filter(
        repository_id=repo_id,
        file_path__startswith=module_path.strip()
    )
    file_ids = list(files_in_module.values_list('id', flat=True))

    if not file_ids:
        status_tracker.status = 'SUCCESS'
        status_tracker.message = "No files found in module; nothing to do."
        status_tracker.save()
        return

    # Create the Celery chain
    # The first task generates docstrings. Its result will be passed to the next task.
    # The second task generates the README.
    # The final knowledge sync is triggered inside the second task.
    workflow_chain = chain(
        batch_generate_docstrings_for_files_task.s(
            repo_id=repo_id,
            user_id=user_id,
            file_ids=file_ids
        ),
        generate_and_save_module_readme_task.s(
            repo_id=repo_id,
            module_path=module_path
        )
    )

    # Execute the chain
    workflow_chain.apply_async()

    # We can't easily track the sub-tasks' progress on the main task tracker.
    # The frontend will need to poll the sub-tasks if detailed progress is needed.
    # For now, we just mark that the workflow has started.
    status_tracker.status = 'IN_PROGRESS'
    status_tracker.message = "Step 1: Generating documentation for individual files..."
    status_tracker.save()
from .models import ModuleDependency
    
@app.task
def resolve_module_dependencies_task(repo_id: int):
    """
    Analyzes imports for all files in a repository and creates ModuleDependency
    records. This version handles relative imports and identifies external libraries.
    """
    print(f"SMART_DEPENDENCY_TASK: Starting for repo {repo_id}")
    repo = Repository.objects.get(id=repo_id)
    ModuleDependency.objects.filter(repository=repo).delete()

    all_files_in_repo = list(CodeFile.objects.filter(repository=repo))
    
    # Create a lookup map of file system paths for fast checking
    # e.g., {'services/billing/utils.py': <CodeFile object>}
    file_path_map = {file.file_path: file for file in all_files_in_repo}
    
    dependencies_to_create = []
    external_dependencies = set()

    for source_file in all_files_in_repo:
        if not source_file.imports:
            continue

        source_dir = os.path.dirname(source_file.file_path)

        for import_path in source_file.imports:
            # --- NEW: Relative and Absolute Import Resolution Logic ---
            
            target_file = None
            
            # Case 1: Relative import (e.g., 'from . import utils' or 'from ..api import views')
            if import_path.startswith('.'):
                # Simple relative path resolution
                # 'from .models ...' -> path relative to source_dir
                # 'from ..api ...' -> path relative to parent of source_dir
                # A more robust solution might need to handle complex package structures
                normalized_path = os.path.normpath(os.path.join(source_dir, import_path.replace('.', '/')))
                
                # Check for direct file match (e.g., .../utils.py)
                possible_file_path = normalized_path + '.py'
                if possible_file_path in file_path_map:
                    target_file = file_path_map[possible_file_path]
                # Check for package match (e.g., .../utils/__init__.py)
                else:
                    possible_init_path = os.path.join(normalized_path, '__init__.py')
                    if possible_init_path in file_path_map:
                        target_file = file_path_map[possible_init_path]

            # Case 2: Absolute import (e.g., 'from services.billing import api')
            else:
                possible_file_path = import_path.replace('.', '/') + '.py'
                if possible_file_path in file_path_map:
                    target_file = file_path_map[possible_file_path]
                else:
                    possible_init_path = os.path.join(import_path.replace('.', '/'), '__init__.py')
                    if possible_init_path in file_path_map:
                        target_file = file_path_map[possible_init_path]

            # --- END NEW LOGIC ---

            if target_file:
                # This is an internal dependency
                if source_file.id != target_file.id:
                    dependencies_to_create.append(
                        ModuleDependency(
                            repository=repo,
                            source_file=source_file,
                            target_file=target_file
                        )
                    )
            else:
                # This is likely an external library
                # We take the top-level module (e.g., 'django' from 'django.db.models')
                top_level_module = import_path.split('.')[0]
                external_dependencies.add(top_level_module)

    ModuleDependency.objects.bulk_create(dependencies_to_create, ignore_conflicts=True)
    print(f"SMART_DEPENDENCY_TASK: Created {len(dependencies_to_create)} internal module dependencies.")
    print(f"SMART_DEPENDENCY_TASK: Identified {len(external_dependencies)} unique external dependencies: {external_dependencies}")