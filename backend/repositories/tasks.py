# backend/repositories/tasks.py
from config.celery import app
from .models import Repository,AsyncTaskStatus
import subprocess # Import the subprocess module
import os # Import the os module
import shutil # Import the shutil module for removing directories
from allauth.socialaccount.models import SocialToken # Import SocialToken
import json
from django.db.models import Q ,F,Count # <--- ADD THIS IMPORT
import ast # Python's Abstract Syntax Tree module
import astor
import subprocess # To call ruff CLI
import time
from github import Github, GithubException, UnknownObjectException
from django.contrib.auth import get_user_model
import datetime
from itertools import takewhile
from django.db import transaction,models  # Import the transaction module
from .models import CodeFile, CodeSymbol, CodeClass,CodeDependency 
# Define the path to our compiled Rust binary INSIDE the container
REPO_CACHE_BASE_PATH = "/var/repos"
from openai import OpenAI # Import the OpenAI library
RUST_ENGINE_PATH = "/app/engine/helix-engine/target/release/helix-engine"
OPENAI_CLIENT = OpenAI()
OPENAI_EMBEDDING_MODEL = "text-embedding-3-small"
@app.task
def process_repository(repo_id):
    try:
        repo = Repository.objects.get(id=repo_id)
    except Repository.DoesNotExist:
        print(f"Error: Repository with id={repo_id} not found.")
        return

    repo_path = os.path.join(REPO_CACHE_BASE_PATH, str(repo.id))

    try:
        print(f"Processing repository: {repo.full_name}")
        repo.status = Repository.Status.INDEXING
        repo.save()

        # --- Git Cache Management ---
        social_token = SocialToken.objects.get(account__user=repo.user, account__provider='github')
        token = social_token.token
        clone_url = f"https://oauth2:{token}@github.com/{repo.full_name}.git"

        if os.path.exists(repo_path):
            print(f"Pulling latest changes for {repo.full_name}")
            subprocess.run(["git", "-C", repo_path, "pull"], check=True, capture_output=True)
        else:
            print(f"Cloning new repository: {repo.full_name} to {repo_path}")
            subprocess.run(["git", "clone", "--depth", "1", clone_url, repo_path], check=True, capture_output=True)
        print(f"DEBUG: Celery Task - Processing for Repository ID: {repo.id}, Name: {repo.full_name}")
        print(f"DEBUG: Target repo_path for Rust engine: {repo_path}") # repo_path is /var/repos/<repo.id>
        
        # Ensure repo_path actually contains the correct repo's files before calling Rust
        print(f"DEBUG: Listing contents of {repo_path} before Rust call:")
        try:
            for item in os.listdir(repo_path):
                print(f"DEBUG:   - {item}")
        except FileNotFoundError:
            print(f"DEBUG: ERROR - repo_path {repo_path} does not exist before Rust call!")
            # This would be a major issue with the git clone/pull logic
        except Exception as e:
            print(f"DEBUG: Error listing {repo_path}: {e}")
        # --- Call Rust Engine ---
        print(f"Calling Rust engine for directory: {repo_path}")
        command = [RUST_ENGINE_PATH, "--dir-path", repo_path]
        result = subprocess.run(command, capture_output=True, text=True, check=True)
        json_output_string = result.stdout

        # (Optional) Write debug output file
        with open(f"/app/rust_output_{repo_id}.json", "w") as f:
            f.write(json_output_string)

        repo_analysis_data = json.loads(json_output_string)

        # --- Database Transaction: Two-Pass Processing ---
        with transaction.atomic():
        # PASS 1: Create all Files, Classes, and Symbols
            print("Starting Pass 1: Creating Files, Classes, and Symbols...")
            
            repo.files.all().delete()
            
            symbol_map = {}
            call_map = {}

            for file_data in repo_analysis_data.get('files', []):
                new_file = CodeFile.objects.create(
                    repository=repo,
                    file_path=file_data.get('path'),
                    structure_hash=file_data.get('structure_hash')
                )
                
                # Process top-level functions
                for func_data in file_data.get('functions', []):
                    uid_from_json = func_data.get('unique_id') # Get it
                    if not uid_from_json:
                        print(f"WARNING: Missing unique_id in JSON for top-level function: {func_data.get('name')} in file {new_file.file_path}")
                    
                    new_symbol = CodeSymbol.objects.create(
                        code_file=new_file,
                        unique_id=uid_from_json,  # <<<<<<<<<<< ADDED THIS
                        name=func_data.get('name'),
                        start_line=func_data.get('start_line'),
                        end_line=func_data.get('end_line'),
                        content_hash=func_data.get('content_hash')
                    )
                    if uid_from_json:
                        symbol_map[uid_from_json] = new_symbol
                        call_map[uid_from_json] = func_data.get('calls', [])
                    else:
                        print(f"ERROR: Cannot map symbol {func_data.get('name')} for dependency linking due to missing unique_id.")


                # Process classes and their methods
                for class_data in file_data.get('classes', []):
                    new_class = CodeClass.objects.create(
                        code_file=new_file,
                        name=class_data.get('name'),
                        start_line=class_data.get('start_line'),
                        end_line=class_data.get('end_line'),
                        structure_hash=class_data.get('structure_hash')
                    )
                    for method_data in class_data.get('methods', []):
                        uid_from_json = method_data.get('unique_id') # Get it
                        if not uid_from_json:
                            print(f"WARNING: Missing unique_id in JSON for method: {method_data.get('name')} in class {new_class.name}")

                        new_symbol = CodeSymbol.objects.create(
                            code_class=new_class,
                            unique_id=uid_from_json,  # <<<<<<<<<<< ADDED THIS
                            name=method_data.get('name'),
                            start_line=method_data.get('start_line'),
                            end_line=method_data.get('end_line'),
                            content_hash=method_data.get('content_hash')
                        )
                        if uid_from_json:
                            symbol_map[uid_from_json] = new_symbol
                            call_map[uid_from_json] = method_data.get('calls', [])
                        else:
                            print(f"ERROR: Cannot map method {method_data.get('name')} for dependency linking due to missing unique_id.")
        
            print(f"Finished Pass 1. Created {len(symbol_map)} symbols. symbol_map keys: {list(symbol_map.keys())[:20]}")
            print(f"Starting Pass 1.5: Generating OpenAI Embeddings using model {OPENAI_EMBEDDING_MODEL}...")
            
            # OpenAI API can handle batch requests, but for simplicity and to avoid
            # very large single requests, we'll process symbol by symbol or in small batches.
            # For now, symbol by symbol:
            symbols_to_update = []
            for unique_id, symbol_obj in symbol_map.items():
                text_to_embed = symbol_obj.name
                if symbol_obj.documentation:
                    # OpenAI recommends replacing newlines with spaces for their embedding models
                    doc_cleaned = symbol_obj.documentation.replace("\\n", " ")
                    text_to_embed += f"\\n\\n{doc_cleaned}"
                
                try:
                    response = OPENAI_CLIENT.embeddings.create(
                        input=text_to_embed,
                        model=OPENAI_EMBEDDING_MODEL
                    )
                    embedding_vector = response.data[0].embedding
                    
                    symbol_obj.embedding = embedding_vector # pgvector expects a list, OpenAI returns it
                    symbols_to_update.append(symbol_obj)

                except Exception as e:
                    print(f"Error generating OpenAI embedding for symbol {symbol_obj.unique_id}: {e}")
                    # Decide if you want to skip this symbol or fail the task
                    continue 
            
            # Bulk update the embeddings if possible, or save one by one
            # For simplicity, saving one by one after collecting:
            if symbols_to_update:
                print(f"Saving embeddings for {len(symbols_to_update)} symbols...")
                for sym_obj in symbols_to_update:
                    sym_obj.save(update_fields=['embedding'])
            
            print(f"Finished Pass 1.5. Processed embeddings for {len(symbol_map)} symbols.")
            # PASS 2: Create all Dependency Links
            print("Starting Pass 2: Linking Dependencies...")
            
            # This map is needed to resolve callees by their simple name.
            # This is naive and won't handle multiple functions with the same name perfectly.
            name_to_symbol_map = {s.name: s for s in symbol_map.values()}

            for caller_uid, callee_names in call_map.items():
                caller_symbol = symbol_map.get(caller_uid)
                if not caller_symbol:
                    continue
                
                for callee_name in callee_names:
                    # Naive lookup by name. A more advanced system would resolve imports.
                    callee_symbol = name_to_symbol_map.get(callee_name)
                    if callee_symbol and callee_symbol.id != caller_symbol.id:
                        CodeDependency.objects.get_or_create(
                            caller=caller_symbol,
                            callee=callee_symbol
                        )
            
            print("Finished Pass 2.")

            # --- Finalize Repository Status ---
            repo.root_merkle_hash = repo_analysis_data.get('root_merkle_hash')
            repo.status = Repository.Status.COMPLETED
            repo.save()

        print(f"Successfully processed and saved analysis for repository: {repo.full_name}")

    except subprocess.CalledProcessError as e:
        print(f"Error calling Rust engine for repo_id={repo_id}. Stderr: {e.stderr}")
        repo.status = Repository.Status.FAILED
        repo.save()
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON for repo_id={repo_id}. Error: {e}")
        repo.status = Repository.Status.FAILED
        repo.save()
    except Exception as e:
        print(f"An unexpected error occurred while processing repo_id={repo_id}: {e}")
        repo.status = Repository.Status.FAILED
        repo.save()

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
    # except User.DoesNotExist: # If user object was fetched
    #     print(f"Error: User {user_id} not found.")
    #     return {"status": "error", "message": "User not found."}


    # Identify symbols in this file that need documentation
    # (undocumented OR (has documentation AND documentation_hash != content_hash AND content_hash is not NULL))
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
            symbol.documentation_hash = symbol.content_hash # Mark as fresh
            try:
                symbol.save(update_fields=['documentation', 'documentation_hash'])
                print(f"Generated and saved doc for: {symbol.unique_id or symbol.name}")
                successful_generations += 1
            except Exception as e:
                print(f"Error saving doc for symbol {symbol.unique_id or symbol.name}: {e}")
                failed_generations += 1
        else:
            print(f"Failed to generate doc for: {symbol.unique_id or symbol.name}")
            failed_generations += 1
        
        time.sleep(0.5) # Basic rate limiting: 0.5 seconds between OpenAI calls

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
                symbol.documentation_hash = symbol.content_hash
                try:
                    symbol.save(update_fields=['documentation', 'documentation_hash'])
                    print(f"BATCH_DOC_GEN_TASK: Generated and saved doc for: {symbol.unique_id or symbol.name}")
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