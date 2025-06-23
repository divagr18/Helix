# backend/repositories/ai_services.py
from typing import Generator,Optional
from django.conf import settings
from openai import OpenAI as OpenAIClient

from .models import CodeClass, CodeSymbol, CodeDependency,KnowledgeChunk
from pgvector.django import L2Distance
def generate_class_summary_stream(
    code_class: CodeClass,
    openai_client: OpenAIClient
) -> Generator[str, None, None]:
    """
    Assembles a high-signal prompt and streams a summary for a CodeClass.
    """
    
    # 1. Gather Class Metadata
    class_name = code_class.name
    file_path = code_class.code_file.file_path
    methods = CodeSymbol.objects.filter(code_class=code_class).order_by('start_line')

    # 2. Assemble Interface Summary
    public_methods_summary = []
    private_methods_names = []
    init_method_source = "N/A"

    for method in methods:
        # Extract signature from the start of the source code (a simple heuristic)
        # A more robust solution would use the AST if the signature is stored separately.
        try:
            source_code = method.source_code # Assuming you add a property/method to get this
            signature = source_code.split('):', 1)[0] + '):' if '):' in source_code else source_code.split('\n')[0]
        except Exception:
            signature = f"def {method.name}(...):"

        if method.name.startswith('_'):
            if method.name != "__init__":
                private_methods_names.append(method.name)
        else:
            doc_summary = ""
            if method.documentation:
                doc_summary = f"  # {method.documentation.splitlines()[0]}" # First line of docstring
            public_methods_summary.append(f"{signature}{doc_summary}")
        
        if method.name == "__init__":
            init_method_source = method.source_code

    # 3. Gather Dependency Context
    # Get top 5 external functions/classes this class calls
    external_callees = CodeDependency.objects.filter(
        caller__code_class=code_class
    ).exclude(
        callee__code_class=code_class # Exclude internal method calls
    ).select_related('callee').values_list('callee__name', flat=True).distinct()[:5]

    # Get top 5 external functions/classes that call this class's methods
    external_callers = CodeDependency.objects.filter(
        callee__code_class=code_class
    ).exclude(
        caller__code_class=code_class
    ).select_related('caller').values_list('caller__name', flat=True).distinct()[:5]

    # 4. Construct the High-Signal Prompt
    prompt_parts = [
    "You are Helix, an expert software architect writing a technical summary for a Python class.",
    f"The class is named `{class_name}` and is located in the file `{file_path}`.",
    "\n--- Class Interface ---",
    "Public Methods:",
    ] + (public_methods_summary if public_methods_summary else ["  (No public methods found)"]) + [
        "\nPrivate Methods:",
        f"  {', '.join(private_methods_names)}" if private_methods_names else "  (No private methods found)",
        "\nConstructor (`__init__`) Source:",
        "```python",
        init_method_source,
        "```",
    ]

    if external_callees:
        prompt_parts.extend(["\n--- Dependencies ---", f"This class calls: {', '.join(external_callees)}"])
    if external_callers:
        prompt_parts.extend(["\n--- Relationships ---", f"This class is used by: {', '.join(external_callers)}"])

    prompt_parts.extend([
        "\n--- Task ---",
        "Based on the provided interface, constructor, and context, generate a concise README for this class in Markdown format. You must add a dependancy section as well.",
        "Your response MUST strictly follow this Markdown structure. Do not add any other text or explanation outside of this structure.",
        
        # --- NEW: Provide a clear template ---
        "Template:",
        "### Purpose",
        "A one or two-sentence explanation of the class's main responsibility.",
        "",
        "### Key Methods",
        "* `method_name()`: Brief description of what this method does.",
        "* `another_method()`: Brief description of what this method does.",
        "",
        "### Usage Example",
        "```python",
        "# A short, conceptual Python code snippet",
        "# showing how to instantiate and use the class.",
        "```",
        # --- END TEMPLATE ---

        "\nGenerate the complete Markdown summary now, filling in the template with the correct information for the `UserManager` class:"
    ])
    
    prompt = "\n".join(prompt_parts)
    print(f"DEBUG_CLASS_SUMMARY_PROMPT: For class {code_class.id}\n{prompt}\n--------------------")

    # 5. Call LLM and Stream Response
    try:
        stream = openai_client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {"role": "system", "content": "You are a helpful AI software architect that writes clear, concise technical documentation in Markdown."},
                {"role": "user", "content": prompt}
            ],
            stream=True,
            temperature=0.4,
            max_tokens=1000
        )
        full_content = []
        for chunk in stream:
            content = chunk.choices[0].delta.content
            if content:
                full_content += content
                yield content  # If you're streaming to client

        # After streaming is done, print the full content

    except Exception as e:
        error_message = f"// Helix encountered an error while summarizing the class: {str(e)}"
        print(f"CLASS_SUMMARY_STREAM_ERROR: {error_message}")
        yield error_message

def generate_refactor_stream(
    symbol_obj: CodeSymbol,
    openai_client: OpenAIClient
) -> Generator[str, None, None]:
    """
    Assembles a high-signal prompt and streams refactoring suggestions for a CodeSymbol.
    """
    source_code = symbol_obj.source_code
    if not source_code or source_code.strip().startswith("# Error:"):
        yield f"// Helix could not retrieve valid source code to suggest refactors. Please try reprocessing the repository."
        return

    symbol_kind = "method" if symbol_obj.code_class else "function"
    
    # --- Context Injection ---
    context_parts = [
        f"The {symbol_kind} is named `{symbol_obj.name}`."
    ]
    if symbol_obj.loc is not None and symbol_obj.cyclomatic_complexity is not None:
        context_parts.append(
            f"**Code Metrics:** It has a Lines of Code (LOC) of `{symbol_obj.loc}` and a Cyclomatic Complexity of `{symbol_obj.cyclomatic_complexity}`."
        )
        if symbol_obj.cyclomatic_complexity > 10:
            context_parts.append("The complexity is high, so pay special attention to simplifying conditional logic.")
    
    context_str = "\n".join(context_parts)

    # --- Prompt Engineering ---
    prompt = (
        f"You are Helix, an expert Senior Python Developer. Your task is to refactor the provided code and explain your changes by strictly following the specified output format.\n\n"
        f"--- Context ---\n"
        f"{context_str}\n\n"
        f"--- Original Source Code ---\n"
        f"```python\n{source_code}\n```\n\n"
        f"--- INSTRUCTIONS ---\n"
        f"1. Analyze the original code for any opportunities to improve readability, maintainability, or efficiency.\n"
        f"2. Synthesize ALL improvements into a single, final, refactored version of the code.\n"
        f"3. Your entire response MUST be a single Markdown document. Do NOT include any conversational text or introductions before the first heading.\n"
        f"4. The response MUST strictly follow this exact two-part format:\n\n"
        f"### Summary of Changes\n"
        f"A Markdown bulleted list. Each bullet point MUST start with a bolded title describing the change, followed by a colon, a description of the change, the word 'Reasoning', a colon, and the justification.\n"
        f"Use this exact format for each bullet point:\n"
        f"*   **[CHANGE TITLE]:** [Description of the change]. **Reasoning:** [Justification for the change].\n"
        f"\n"
        f"### Refactored Code\n"
        f"A single Python code block containing the complete, final, refactored code. This block must include any new helper functions you created, followed by the updated original function.\n\n"
        f"--- START RESPONSE ---"
    )

    print(f"DEBUG_SUGGEST_REFACTORS_PROMPT: For symbol {symbol_obj.id}\n{prompt}\n--------------------")

    # --- LLM Call ---
    try:
        stream = openai_client.chat.completions.create(
            model="gpt-4.1-mini", # "gpt-4-turbo-preview" is recommended
            messages=[
                {"role": "system", "content": "You are a helpful AI code quality analyst that provides specific refactoring suggestions in Markdown format."},
                {"role": "user", "content": prompt}
            ],
            stream=True,
            temperature=0.3, # Low temperature for factual, standard refactoring patterns
            max_tokens=2048   # Allow for detailed suggestions with code
        )
        for chunk in stream:
            content = chunk.choices[0].delta.content
            if content:
                yield content
    except Exception as e:
        error_message = f"// Helix encountered an error while suggesting refactors: {str(e)}"
        print(f"SUGGEST_REFACTORS_STREAM_ERROR: {error_message}")
        yield error_message


        
        
from django.conf import settings
from agno.tools.postgres import PostgresTools

from agno.agent import Agent, AgentKnowledge
from agno.models.openai import OpenAIChat
from agno.vectordb.pgvector import PgVector, SearchType

def get_helix_knowledge_base() -> AgentKnowledge:
    """
    Creates and configures the connection to our knowledge base in pgvector.
    This tells Agno how to interface with our existing KnowledgeChunk table.
    """
    # Construct the database URL from Django settings for Agno
    db_settings = settings.DATABASES['default']
    db_url = (
        f"postgresql://helix:helix@db:5432/helix_dev"
    )

    # Configure the PgVector connection to our specific table and columns
    vector_db = PgVector(
        table_name="knowledge_chunks",  # The table created by our Django model
        db_url=db_url,
        schema="public",
        
        # Tell Agno about other columns it can use for metadata filtering (future use)
        search_type=SearchType.vector 
    )

    # We don't need to provide a source (like a PDF) because we populate the DB ourselves.
    # We just need to give the AgentKnowledge object the configured vector_db connection.
    return AgentKnowledge(vector_db=vector_db)
from .models import Repository  # <--- Import the Repository model

from .agno_tools import helix_knowledge_search,execute_structural_query,HelixPostgresTools
db_settings = settings.DATABASES['default']

def get_helix_qa_agent(user_id: int, repo_id: int, file_path: Optional[str] = None) -> Agent:
    """
    Factory function to create and configure the Helix Q&A agent.
    This is the central point for defining the agent's capabilities.
    """
    user_scoped_postgres_tools = HelixPostgresTools(user_id=user_id)
    try:
        repo = Repository.objects.get(id=repo_id)
        repo_name = repo.full_name
    except Repository.DoesNotExist:
        repo_name = f"ID: {repo_id}"
    agent = Agent(
        name="Helix",
        model=OpenAIChat(id="gpt-4.1-mini"),
        
        # 1. Provide the knowledge base for RAG
        
        # 2. Let Agno create its default `search_knowledge_base` tool.
        #    This is True by default when `knowledge` is provided.
        
        # 3. Add our one custom tool for metadata queries.
        tools=[
            helix_knowledge_search,
            execute_structural_query,
            user_scoped_postgres_tools
        ],
        show_tool_calls=False,
        markdown=True,
        instructions=(
            f"You are Helix, an AI assistant for a software repository. You have two tools available. You are in the repo with id{repo_id} and name {repo_name}, talking to user with userid {user_id}. Use this info for your database operations.\n"
            "The columns in your vector DB are: id,chunk_type,content,embedding,related_class_id,related_file_id,related_symbol_id,repository_id,created_at"
            "1. `helix_knowledge_search`: Use this for questions about the 'how' or 'purpose' of code, or for implementation examples. This tool searches documentation and source code.\n"
            "2. `execute_structural_query`: Use this for questions that ask for lists of items or metadata that are function level, not repo level., like 'list all functions' or 'how many orphans' If you don't find your answer in first run of the tool use the user_scoped_postgres_tools.\n"
            "3. `user_scoped_postgres_tools`: Use this for questions that ask for data about files, symbols etc. This lets you look at the database that stores everything. You MUST first run show_tables to see all the tables, and only then run your query. You do not let the user know that you are using this SQL tool. You must pass user_id to this tool.'.\n"

            "Based on the user's query, choose the best tool, execute it, and then formulate a helpful answer based on the tool's output. Cite function names or file paths when possible."
        ),debug_mode=True
    )
    return agent

def handle_chat_query_stream(user_id: int,repo_id: int, query: str, file_path: str | None = None) -> Generator[str, None, None]:
    """
    Handles a user's chat query by invoking the Agno-powered Q&A agent.
    This function is now a simple wrapper around the agent's execution.
    """
    print(f"AGNO_SERVICE: Handling query for repo {repo_id} with Agno agent. Query: '{query}'")
    try:
        # Get a freshly configured agent with the latest context
        agent = get_helix_qa_agent(user_id=user_id, repo_id=repo_id,file_path=file_path)
        run_iterator = agent.run(message=query, stream=True) # Also stream intermediate steps for debugging
        
        # Loop through the iterator and yield each chunk's content
        for chunk in run_iterator:
            # The chunk object from agno likely has a .content attribute for the text token
            if chunk and hasattr(chunk, 'content') and chunk.content:
                # You might want to format this as SSE JSON if the consumer expects it
                # For a simple generator, just yielding the text is fine.
                # Let's assume you want to yield the raw token string.
                yield chunk.content
        
            
    except Exception as e:
        print(f"AGNO_SERVICE: FATAL - Error during agent execution: {e}")
        # Use traceback for more details in your server logs
        import traceback
        traceback.print_exc()
        yield f"// Helix encountered a critical error while processing your request."   