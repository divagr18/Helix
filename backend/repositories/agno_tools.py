# backend/repositories/agno_tools.py
from agno.tools import tool
from openai import OpenAI
import psycopg2 # Import the OpenAI library
# We need access to our models and the OpenAI client
from .models import KnowledgeChunk, CodeSymbol, OrganizationMember, Repository
OPENAI_CLIENT = OpenAI()
from pgvector.django import L2Distance

from typing import Optional
from django.db.models import Q ,F,Count # <--- ADD THIS IMPORT

@tool
def helix_knowledge_search(query: str, repo_id: int, user_id: int) -> str:
    """
    Searches the repository's knowledge base across multiple levels (from high-level
    READMEs down to source code) to answer questions about how code works, its purpose,
    or for implementation examples. This is the primary tool for understanding code.
    The user's permission to access the repository is verified before searching.
    """
    print(f"AGNO_TOOL: Executing Multi-Layered Knowledge Search for repo {repo_id}, user {user_id} with query: '{query}'")
    
    # --- THIS IS THE CRUCIAL FIX ---
    # 1. Validate that the user has access to the requested repository.
    try:
        # This check ensures the repo belongs to an org the user is part of.
        is_member = OrganizationMember.objects.filter(
            organization__repositories__id=repo_id,
            user_id=user_id
        ).exists()

        if not is_member:
            return "Error: You do not have permission to access this repository or it does not exist."
            
    except Exception as e:
        print(f"AGNO_TOOL: ERROR during permission check: {e}")
        return "An error occurred while verifying repository access."
    # --- END FIX ---

    try:
        # 2. Generate an embedding for the user's query
        query_embedding = OPENAI_CLIENT.embeddings.create(
            input=[query], 
            model="text-embedding-3-small"
        ).data[0].embedding
        
        # Now that we've confirmed access, the rest of the queries can proceed.
        # The RLS policies will provide an additional layer of security, but this
        # initial check is good practice and provides a clearer error message.
        
        context_chunks = {}

        # Layer 1: Search for Module READMEs
        readme_chunks = KnowledgeChunk.objects.filter(
            repository_id=repo_id,
            chunk_type=KnowledgeChunk.ChunkType.MODULE_README
        ).order_by(L2Distance('embedding', query_embedding))[:2]
        for chunk in readme_chunks:
            context_chunks[chunk.id] = chunk

        # Layer 2: Search for Class Summaries
        class_summary_chunks = KnowledgeChunk.objects.filter(
            repository_id=repo_id,
            chunk_type=KnowledgeChunk.ChunkType.CLASS_SUMMARY
        ).order_by(L2Distance('embedding', query_embedding))[:3]
        for chunk in class_summary_chunks:
            context_chunks[chunk.id] = chunk

        # Layer 3 & 4: Fill with Docstrings and Source Code
        if len(context_chunks) < 5:
            needed = 5 - len(context_chunks)
            remaining_chunks = KnowledgeChunk.objects.filter(
                repository_id=repo_id,
                chunk_type__in=[
                    KnowledgeChunk.ChunkType.SYMBOL_DOCSTRING,
                    KnowledgeChunk.ChunkType.SYMBOL_SOURCE
                ]
            ).order_by(L2Distance('embedding', query_embedding))[:needed]
            for chunk in remaining_chunks:
                context_chunks[chunk.id] = chunk

        if not context_chunks:
            return "No relevant information was found in the knowledge base for this query."

        # 3. Format the combined results into a structured string
        # ... (The formatting logic remains the same, but we need to handle related fields being null) ...
        
        sorted_chunks = sorted(list(context_chunks.values()), key=lambda c: c.chunk_type)
        context_str = "--- Retrieved Context (Prioritized from High-Level to Low-Level) ---\n\n"
        
        for chunk in sorted_chunks:
            source_description = f"Source: {chunk.get_chunk_type_display()}"
            # Add more specific source info if available
            if chunk.related_class:
                source_description += f" for class '{chunk.related_class.name}'"
            if chunk.related_symbol:
                source_description += f" for function '{chunk.related_symbol.name}'"
            if chunk.related_file:
                 source_description += f" in '{chunk.related_file.file_path}'"
            
            context_str += f"{source_description}\n"
            context_str += f"Content:\n{chunk.content}\n\n"
        
        return context_str

    except Exception as e:
        print(f"AGNO_TOOL: ERROR in HelixKnowledgeSearchTool: {e}")
        import traceback
        traceback.print_exc()
        return f"An error occurred while searching the knowledge base: {e}"


# Your existing HelixStructuralQueryTool can remain as is, but we'll make it a @tool function
@tool(name="SearchTool")
def execute_structural_query(repo_id: int, query: str, file_path: Optional[str] = None) -> str:
    """
    Executes a structural query against the Django database models.

    Parameters:
    - repo_id: int - The ID of the repository.
    - query: str - The natural language query.
    - file_path: Optional[str] - The path to the file (required for some queries).

    Returns:
    - str - The result of the query.
    """
    print(f"AGNO_TOOL: Executing StructuralQueryTool for repo {repo_id} with query: '{query}'")
    query_lower = query.lower()

    if "functions" in query_lower and "file" in query_lower:
        if not file_path:
            return "To list functions in a file, the user must have a file open. Please ask the user to open a file."

        try:
            symbols = CodeSymbol.objects.filter(
                code_file__repository_id=repo_id,
                code_file__file_path=file_path,
                code_class__isnull=True  # Top-level functions
            ).values_list('name', flat=True)

            if not symbols:
                return f"No top-level functions were found in the file '{file_path}'."

            function_list = "\n".join([f"- `{name}`" for name in symbols])
            return f"The functions in '{file_path}' are:\n{function_list}"

        except Exception as e:
            print(f"AGNO_TOOL: ERROR in StructuralQueryTool (functions in file): {e}")
            return f"An error occurred while querying for functions: {e}"

    elif "orphan" in query_lower and "how many" in query_lower:
        try:
            orphan_count = CodeSymbol.objects.filter(
                Q(code_file__repository_id=repo_id) | Q(code_class__code_file__repository_id=repo_id),
                is_orphan=True
            ).count()
            return f"There are currently {orphan_count} orphan symbols detected in the repository."
        except Exception as e:
            print(f"AGNO_TOOL: ERROR in StructuralQueryTool (orphan count): {e}")
            return f"An error occurred while counting orphan symbols: {e}"

    return "This structural query is not yet supported. I can list functions in a specific file or count orphan symbols."
from agno.tools.postgres import PostgresTools
from agno.utils.log import log_info, log_error
from django.conf import settings
from typing import Dict, Optional

class HelixPostgresTools(PostgresTools):
    """
    A custom Toolkit that inherits from PostgresTools to provide a full suite of
    database tools, but overrides the connection and query execution to enforce
    user-scoped Row-Level Security (RLS) and read-only access.
    """
    def __init__(self, user_id: int, **kwargs):
        self.user_id = user_id
        self.db_settings = settings.DATABASES['default']
        # We manage the connection ourselves, so initialize it to None.
        # The parent class also has a `_connection` attribute, which we will now control.
        self._connection = None
        
        # Call the parent's __init__ to register all its tools (`show_tables`, etc.).
        # We pass the connection details from our Django settings.
        # The parent class will handle adding the tools to the toolkit.
        super().__init__(
            db_name=self.db_settings.get('NAME'),
            user=settings.READONLY_DB_USER,
            password=settings.READONLY_DB_PASSWORD,
            host=self.db_settings.get('HOST', 'localhost'),
            port=self.db_settings.get('PORT', 5432),
            # You can configure which of the parent's tools to enable here
            run_queries=True,
            inspect_queries=False,
            summarize_tables=True,
            export_tables=False, # Disable potentially risky tools if desired
            **kwargs
        )

    @property
    def connection(self) -> psycopg2.extensions.connection:
        """
        Overrides the parent's connection property to establish a secure,
        user-scoped, read-only database connection.
        """
        if self._connection is None or self._connection.closed:
            log_info(f"AGNO_TOOL_CONNECT: Establishing new RLS-scoped connection for user {self.user_id}")
            conn_params = {
                "host": self.host,
                "port": self.port,
                "dbname": self.db_name,
                "user": self.user,
                "password": self.password, # This now correctly uses the value set in __init__
            }
            self._connection = psycopg2.connect(**conn_params)
            self._connection.set_session(readonly=True)
            
            # This is the crucial part: set the RLS session variable
            try:
                with self._connection.cursor() as cursor:
                    cursor.execute("SET app.current_user_id = %s", (str(self.user_id),))
                print(f"AGNO_TOOL_INIT: Set app.current_user_id = {self.user_id} for this session.")
            except Exception as e:
                log_error(f"AGNO_TOOL_INIT: FATAL - Failed to set session variable for RLS: {e}")
                self._connection.close()
                self._connection = None
                raise
        
        return self._connection

    def run_query(self, query: str) -> str:
        """
        Overrides the parent's run_query method to enforce a strict SELECT-only policy.
        All other tools from the parent class (like show_tables) will now use this safe version.
        """
        print(f"AGNO_TOOL: Executing OVERRIDDEN run_query with query: '{query}'")
        # Security check: only allow SELECT statements
        if not query.strip().lower().startswith('select'):
            return "Error: This tool only supports read-only SELECT queries."

        try:
            # Use the secure connection from our overridden property
            with self.connection.cursor() as cursor:
                cursor.execute(query)
                if cursor.description:
                    columns = [desc[0] for desc in cursor.description]
                    rows = cursor.fetchall()
                    # Use a more robust formatting like the parent class
                    result_rows = [",".join(map(str, row)) for row in rows]
                    result_data = "\n".join(result_rows)
                    return ",".join(columns) + "\n" + result_data
                else:
                    return f"Query executed successfully. Status message: {cursor.statusmessage}"
        except Exception as e:
            print(f"AGNO_TOOL: ERROR in overridden run_query: {e}")
            # Rollback in case of error to keep the transaction state clean
            if self._connection and not self._connection.closed:
                self._connection.rollback()
            return f"An error occurred while executing the SQL query: {e}"