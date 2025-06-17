# backend/repositories/tasks.py
from config.celery import app
from .models import Repository
import subprocess # Import the subprocess module
import os # Import the os module
import shutil # Import the shutil module for removing directories
from allauth.socialaccount.models import SocialToken # Import SocialToken
import json
from django.db.models import Q  # <--- ADD THIS IMPORT

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