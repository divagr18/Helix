# backend/repositories/tasks.py
from config.celery import app
from .models import Repository
import subprocess # Import the subprocess module
import os # Import the os module
import shutil # Import the shutil module for removing directories
from allauth.socialaccount.models import SocialToken # Import SocialToken
import json
from django.db import transaction # Import the transaction module
from .models import CodeFile, CodeFunction
# Define the path to our compiled Rust binary INSIDE the container
RUST_ENGINE_PATH = "/app/engine/helix-engine/target/release/helix-engine"
@app.task
def process_repository(repo_id):
    repo = None
    temp_clone_dir = f"/app/temp_repos/{repo_id}"

    try:
        repo = Repository.objects.get(id=repo_id)
        print(f"Starting processing for repository: {repo.full_name}")

        repo.status = Repository.Status.INDEXING
        repo.save()

        # --- 1. Get User's GitHub Token ---
        try:
            social_token = SocialToken.objects.get(account__user=repo.user, account__provider='github')
            token = social_token.token
        except SocialToken.DoesNotExist:
            raise Exception("GitHub token not found for user.")

        # --- 2. Clone the Repository ---
        clone_url = f"https://oauth2:{token}@github.com/{repo.full_name}.git"
        print(f"Cloning repository: {repo.full_name}")
        os.makedirs(os.path.dirname(temp_clone_dir), exist_ok=True)
        subprocess.run(
            ["git", "clone", "--depth", "1", clone_url, temp_clone_dir],
            check=True, capture_output=True
        )
        print(f"Successfully cloned to {temp_clone_dir}")

        # --- 3. Call the Rust Engine on the ENTIRE directory ---
        print(f"Calling Rust engine for directory: {temp_clone_dir}")
        
        command = [RUST_ENGINE_PATH, "--dir-path", temp_clone_dir]
        
        result = subprocess.run(command, capture_output=True, text=True, check=True)
        
        # The raw output from stdout is the JSON string.
        json_output_string = result.stdout
        
        # --- 4. Parse the JSON and Process the Data ---
        try:
            # Convert the JSON string into a Python dictionary.
            repo_analysis_data = json.loads(json_output_string)
            
            # --- 5. Save the analysis to the database IN A TRANSACTION ---
            # A transaction ensures that if any part of this fails,
            # the whole operation is rolled back, leaving the DB clean.
            with transaction.atomic():
                # First, clear any old analysis for this repository to handle re-indexing.
                CodeFile.objects.filter(repository=repo).delete()

                # Loop through the files from our analysis data.
                for file_data in repo_analysis_data.get('files', []):
                    # Create a new CodeFile record.
                    new_file = CodeFile.objects.create(
                        repository=repo,
                        file_path=file_data.get('path')
                    )
                    
                    # Loop through the functions for this file.
                    for func_data in file_data.get('functions', []):
                        # Create a new CodeFunction record linked to the file.
                        CodeFunction.objects.create(
                            code_file=new_file,
                            name=func_data.get('name'),
                            start_line=func_data.get('start_line'),
                            end_line=func_data.get('end_line')
                        )
            
            print(f"Successfully saved analysis for {len(repo_analysis_data.get('files', []))} files to the database.")
            # --- End of database logic ---

        except json.JSONDecodeError as e:
            print(f"Error: Failed to decode JSON from Rust engine output. Error: {e}")
            # We should probably fail the task if the JSON is invalid.
            raise e
        repo.status = Repository.Status.COMPLETED
        repo.save()
        print(f"Successfully processed repository: {repo.full_name}")

    except Exception as e:
        print(f"An error occurred while processing repo_id={repo_id}: {e}")
        if repo:
            repo.status = Repository.Status.FAILED
            repo.save()
    finally:
        # --- 4. Clean Up ---
        if os.path.exists(temp_clone_dir):
            print(f"Cleaning up directory: {temp_clone_dir}")
            shutil.rmtree(temp_clone_dir)