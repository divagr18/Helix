# backend/repositories/tasks.py
from config.celery import app
from .models import Repository
import subprocess # Import the subprocess module
import os # Import the os module
import shutil # Import the shutil module for removing directories
from allauth.socialaccount.models import SocialToken # Import SocialToken
import json
from django.db.models import Q  # <--- ADD THIS IMPORT
import ast # Python's Abstract Syntax Tree module
import astor

from github import Github, GithubException, UnknownObjectException
from django.contrib.auth import get_user_model
import datetime
from itertools import takewhile
from django.db import transaction # Import the transaction module
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
            
            # Clear old analysis data for this repository
            repo.files.all().delete()
            
            # This map will store the unique_id from Rust and the created symbol object
            symbol_map = {}
            # This map will store the calls for each unique_id
            call_map = {}

            for file_data in repo_analysis_data.get('files', []):
                new_file = CodeFile.objects.create(
                    repository=repo,
                    file_path=file_data.get('path'),
                    structure_hash=file_data.get('structure_hash')
                )
                
                # Process top-level functions
                for func_data in file_data.get('functions', []):
                    unique_id = func_data.get('unique_id')
                    new_symbol = CodeSymbol.objects.create(
                        code_file=new_file,
                        name=func_data.get('name'),
                        start_line=func_data.get('start_line'),
                        end_line=func_data.get('end_line'),
                        content_hash=func_data.get('content_hash')
                    )
                    symbol_map[unique_id] = new_symbol
                    call_map[unique_id] = func_data.get('calls', [])

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
                        unique_id = method_data.get('unique_id')
                        new_symbol = CodeSymbol.objects.create(
                            code_class=new_class,
                            name=method_data.get('name'),
                            start_line=method_data.get('start_line'),
                            end_line=method_data.get('end_line'),
                            content_hash=method_data.get('content_hash')
                        )
                        symbol_map[unique_id] = new_symbol
                        call_map[unique_id] = method_data.get('calls', [])
            
            print(f"Finished Pass 1. Created {len(symbol_map)} symbols.")
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

        print(f"Attempting to update docstring for: {target_symbol_name} in class {target_class_name or 'None'}")
        updated_content = update_docstring_in_ast(
            original_content, 
            actual_symbol_name_for_ast, 
            symbol.documentation, 
            target_class_name_for_ast
        )
        
        if updated_content == original_content:
            print("Warning: Docstring injection via AST did not change file content. Check logic.")
            # This might happen if the symbol wasn't found by the AST visitor.
            # You might want to fall back to a simpler method or log an error.
            # For now, we'll proceed, but the PR won't have changes.

        commit_message = f"Docs: Add/Update docstring for {symbol.unique_id or symbol.name} via Helix CME"
        gh_repo.update_file(
            path=file_path_in_repo, message=commit_message,
            content=updated_content, sha=file_sha, branch=new_branch_name
        )
        print(f"Committed changes to {new_branch_name}")

        pr_title = f"Helix CME: Documentation for {symbol.unique_id or symbol.name}"
        pr_body = (
            f"This Pull Request was automatically generated by Helix CME to add or update documentation for the symbol `{symbol.unique_id or symbol.name}` "
            f"in file `{file_path_in_repo}`.\\n\\n"
            f"**Generated Documentation:**\\n```python\\n{symbol.documentation}\\n```"
        )
        
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