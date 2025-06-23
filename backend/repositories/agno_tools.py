# backend/repositories/agno_tools.py
from agno.tools import tool
from openai import OpenAI # Import the OpenAI library
# We need access to our models and the OpenAI client
from .models import KnowledgeChunk, CodeSymbol, Repository
OPENAI_CLIENT = OpenAI()
from typing import Optional
from django.db.models import Q ,F,Count # <--- ADD THIS IMPORT


class HelixStructuralQueryTool():
    """
    A custom Agno tool to answer structural questions about the codebase
    by directly querying the Django database models.
    """
    name: str = "structural_query"
    description: str = (
        "Use this tool for questions that ask for lists of items, relationships, "
        "or metadata about the code structure. Examples: 'What functions are in this file?', "
        "'List all classes in the repository', 'How many orphan symbols are there?'"
    )

    # We can pass parameters during initialization
    def __init__(self, repo_id: int, file_path: Optional[str] = None, **kwargs):
        super().__init__(**kwargs)
        self.repo_id = repo_id
        self.file_path = file_path

    def execute(self, query: str) -> str:
        """
        Executes the structural query against the database.
        """
        print(f"AGNO_TOOL: Executing StructuralQueryTool for repo {self.repo_id} with query: '{query}'")
        
        # This is a simplified "mini-router" within the tool.
        # A more advanced version could use an LLM to parse the natural language query
        # into more complex ORM calls.
        query_lower = query.lower()

        if "functions" in query_lower and "file" in query_lower:
            if not self.file_path:
                return "To list functions in a file, the user must have a file open. Please ask the user to open a file."
            
            try:
                symbols = CodeSymbol.objects.filter(
                    code_file__repository_id=self.repo_id,
                    code_file__file_path=self.file_path,
                    code_class__isnull=True # Filter for top-level functions
                ).values_list('name', flat=True)

                if not symbols:
                    return f"No top-level functions were found in the file '{self.file_path}'."
                
                function_list = "\n".join([f"- `{name}`" for name in symbols])
                return f"The functions in '{self.file_path}' are:\n{function_list}"

            except Exception as e:
                print(f"AGNO_TOOL: ERROR in StructuralQueryTool (functions in file): {e}")
                return f"An error occurred while querying for functions: {e}"

        # Add another rule for a different type of structural query
        elif "orphan" in query_lower and "how many" in query_lower:
            try:
                orphan_count = CodeSymbol.objects.filter(
                    Q(code_file__repository_id=self.repo_id) | Q(code_class__code_file__repository_id=self.repo_id),
                    is_orphan=True
                ).count()
                
                return f"There are currently {orphan_count} orphan symbols detected in the repository."
            except Exception as e:
                print(f"AGNO_TOOL: ERROR in StructuralQueryTool (orphan count): {e}")
                return f"An error occurred while counting orphan symbols: {e}"

        # Default fallback if no rule matches
        return "This structural query is not yet supported. I can list functions in a specific file or count orphan symbols."