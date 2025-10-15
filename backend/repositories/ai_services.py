# backend/repositories/ai_services.py
from collections import Counter
import json
import re
from typing import Generator,Optional
from django.conf import settings
from openai import OpenAI as OpenAIClient
from agno.tools import tool
import logging
from django.db.models import Q

logger = logging.getLogger(__name__)
from .models import CodeClass, CodeSymbol, CodeDependency,KnowledgeChunk,CodeClass,CodeFile,ModuleDocumentation 
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

        f"\nGenerate the complete Markdown summary now, filling in the template with the correct information for the `{class_name}` class:"
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
        full_response_text = ""
        for chunk in stream:
            content = chunk.choices[0].delta.content
            if content:
                full_response_text += content
                yield content  # If you're streaming to client

        # After streaming is done, print the full content
        if full_response_text:
            # We can do some basic cleaning here if needed, e.g., stripping whitespace
            cleaned_summary = full_response_text.strip()
            
            # For the one-line summary field, let's just take the first meaningful line.
            # The "Purpose" section is what we want.
            # … after cleaned_summary = full_response_text.strip() …

            # Split into lines
            lines = cleaned_summary.splitlines()

            one_line_summary = ""

            pattern = re.compile(
                r"###\s*Purpose\s*\n+`?(?P<sentence>.+?)(?:`?\n|$)",
                re.IGNORECASE,
            )

            m = pattern.search(cleaned_summary)
            if m:
                one_line_summary = m.group("sentence").strip()
            else:
                # As a last resort, try pulling the very next non-blank line after the first line
                lines = cleaned_summary.splitlines()
                for line in lines[1:]:
                    if line.strip():
                        one_line_summary = line.strip("` ").rstrip(".")
                        break

            # Save it
            if not one_line_summary:
                one_line_summary = lines[0].strip().replace("**", "")

            # Update both fields on the model instance
            code_class.summary = one_line_summary
            code_class.generated_summary_md = cleaned_summary
            
            # Save both fields in a single database call
            code_class.save(update_fields=['summary', 'generated_summary_md'])
            print(f"CLASS_SUMMARY_SERVICE: Successfully saved both summaries for class {code_class.id}.")

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
@tool(name="user_scoped_run_query")
def user_scoped_run_query(query: str, user_id: int) -> str:
    """
    Executes a SQL query with RLS enforced using the user_id.
    """
    try:
        tool = HelixPostgresTools(user_id=user_id)
        return tool.run_query(query)
    except Exception as e:
        return f"RLS query error: {e}"

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
            user_scoped_run_query
        ],
        show_tool_calls=False,
        markdown=True,
        instructions=(
            f"You are Helix, an AI assistant for a software repository. You have two tools available. You are in the repo with id{repo_id} and name {repo_name}, talking to user with userid {user_id}. Use this info for your database operations.\n"
            "The columns in your vector DB are: id,chunk_type,content,embedding,related_class_id,related_file_id,related_symbol_id,repository_id,created_at"
            "1. `helix_knowledge_search`: This is your primary tool for answering questions. Use it for any questions about the 'how' or 'purpose' of code, architecture, or implementation examples. It automatically searches all levels of documentation, from high-level READMEs down to source code, and provides the most relevant context.\n"
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
        
def generate_module_readme_stream(
    repo_id: int,
    module_path: str,
    openai_client: OpenAIClient
) -> Generator[str, None, None]:
    """
    Generates an in-depth, architectural README.md for a module by synthesizing
    semantic data from KnowledgeChunks and structural data from CodeDependencies.
    """
    print(f"MODULE_README_SERVICE (v3): Starting hyper-contextual analysis for repo {repo_id}, path '{module_path}'")

    # --- Step 1: Scoping & Initial Data Gathering ---
    files_in_module = CodeFile.objects.filter(
        repository_id=repo_id, file_path__startswith=module_path
    ).prefetch_related('classes', 'symbols')
    
    if not files_in_module.exists():
        yield "Could not find any files in the specified module path to generate a README."
        return

    file_ids_in_module = [f.id for f in files_in_module]
    all_symbols_in_module = CodeSymbol.objects.filter(code_file_id__in=file_ids_in_module)
    symbol_ids_in_module = [s.id for s in all_symbols_in_module]
    print(f"MODULE_README_SERVICE: Found {len(file_ids_in_module)} files and {len(symbol_ids_in_module)} symbols.")

    # --- Step 2: Build the "Module Content Manifest" and Infer Ecosystem ---
    file_content_map = {}
    all_module_imports = set()
    for file in files_in_module:
        file_content_map[file.file_path] = {
            "classes": [c.name for c in file.classes.all()],
            "functions": [s.name for s in file.symbols.filter(code_class__isnull=True)],
            "imports": file.imports or []
        }
        all_module_imports.update(file.imports or [])

    inferred_ecosystem = []
    if any('django' in imp for imp in all_module_imports): inferred_ecosystem.append('Django')
    if any('pandas' in imp or 'numpy' in imp for imp in all_module_imports): inferred_ecosystem.append('Data Science (Pandas/NumPy)')
    if any('react' in imp for imp in all_module_imports): inferred_ecosystem.append('React')
    if any('fastapi' in imp for imp in all_module_imports): inferred_ecosystem.append('FastAPI')
    print(f"MODULE_README_SERVICE: Inferred ecosystem: {inferred_ecosystem}")

    # --- Step 3: Gather Semantic Layer (from KnowledgeChunks) ---
    chunks = KnowledgeChunk.objects.filter(
        related_file_id__in=file_ids_in_module,
        chunk_type__in=[KnowledgeChunk.ChunkType.CLASS_SUMMARY, KnowledgeChunk.ChunkType.SYMBOL_DOCSTRING]
    ).select_related('related_class', 'related_symbol')
    class_summaries_map = {chunk.related_class.id: chunk.content for chunk in chunks if chunk.chunk_type == 'CLASS_SUMMARY'}
    symbol_doc_summaries_map = {chunk.related_symbol.id: chunk.content.strip().split('\n')[0] for chunk in chunks if chunk.chunk_type == 'SYMBOL_DOCSTRING'}

    # --- Step 4: Gather Structural & Quality Layers ---
    # Dependencies & Consumers
    incoming_deps = CodeDependency.objects.filter(callee_id__in=symbol_ids_in_module).exclude(caller_id__in=symbol_ids_in_module).select_related('caller__code_file', 'callee')
    outgoing_deps = CodeDependency.objects.filter(caller_id__in=symbol_ids_in_module).exclude(callee_id__in=symbol_ids_in_module).select_related('callee__code_file')
    
    external_consumers = sorted(list(set(dep.caller.code_file.file_path.replace('/', '.').replace('.py', '') for dep in incoming_deps if dep.caller.code_file)))
    external_dependencies = sorted(list(set(dep.callee.code_file.file_path.replace('/', '.').replace('.py', '') for dep in outgoing_deps if dep.callee.code_file)))

    # Key Entrypoints (weighted by call count)
    entrypoint_counts = Counter(dep.callee for dep in incoming_deps)
    key_entrypoints = [item[0] for item in entrypoint_counts.most_common(5)]

    # Code Health Summary
    health_symbols = all_symbols_in_module.filter(
        Q(cyclomatic_complexity__gte=10) | Q(loc__gte=100) | Q(is_orphan=True)
    ).order_by('-cyclomatic_complexity', '-loc')[:5] # Top 5 health concerns

    # --- Step 5: Construct the Hyper-Contextualized Prompt ---
    prompt_parts = [
        "You are an expert Staff Engineer writing a comprehensive, in-depth architectural README.md for a software module.",
        "Based *only* on the architectural analysis provided below, generate a detailed and insightful README.",
        "\n--- ARCHITECTURAL ANALYSIS DOSSIER ---"
    ]
    if inferred_ecosystem:
        prompt_parts.append(f"**Project Ecosystem:** {', '.join(inferred_ecosystem)}")
    prompt_parts.append(f"**Module Path:** `{module_path or 'Repository Root'}`")

    if file_content_map:
        prompt_parts.append("\n**Module Content Manifest:**")
        for file_path, contents in sorted(file_content_map.items())[:10]: # Limit files for brevity
            prompt_parts.append(f"- **File:** `{file_path}`")
            if contents["classes"]: prompt_parts.append(f"  - **Classes:** {', '.join([f'`{c}`' for c in contents['classes']])}")
            if contents["functions"]: prompt_parts.append(f"  - **Functions:** {', '.join([f'`{f}()`' for f in contents['functions']])}")
            if contents["imports"]: prompt_parts.append(f"  - **Imports:** {', '.join([f'`{i}`' for i in contents['imports'][:5]])}")

    if key_entrypoints:
        prompt_parts.append("\n**Key Public-Facing Components (Most Used Externally):**")
        for symbol in key_entrypoints:
            summary = symbol_doc_summaries_map.get(symbol.id, "No summary available.")
            count = entrypoint_counts[symbol]
            prompt_parts.append(f"- `def {symbol.name}(...)` (called {count} times externally): {summary}")

    if health_symbols:
        prompt_parts.append("\n**Code Health Summary:**")
        for symbol in health_symbols:
            if symbol.cyclomatic_complexity and symbol.cyclomatic_complexity >= 10:
                prompt_parts.append(f"- **High Complexity:** `{symbol.name}` has a complexity of {symbol.cyclomatic_complexity}.")
            if symbol.loc and symbol.loc >= 100:
                prompt_parts.append(f"- **Large Symbol:** `{symbol.name}` is {symbol.loc} lines long.")
            if symbol.is_orphan:
                prompt_parts.append(f"- **Potential Dead Code:** `{symbol.name}` is an orphan (no incoming calls).")

    if external_dependencies:
        prompt_parts.append("\n**External Dependencies (This module relies on):**")
        prompt_parts.extend([f"- `{dep}`" for dep in external_dependencies[:10]])

    if external_consumers:
        prompt_parts.append("\n**External Consumers (Who uses this module):**")
        prompt_parts.extend([f"- `{consumer}`" for consumer in external_consumers[:10]])

    prompt_parts.extend([
        "\n--- TASK ---",
        "Generate the `README.md` now. It must be well-structured and include the following sections:",
        "1.  **## Overview**: A detailed paragraph explaining the module's role and primary responsibilities.",
        "2.  **## Core Abstractions**: A description of the key public-facing classes and functions.",
        "3.  **## Interactions & Dependencies**: Explain how this module fits into the larger system.",
        "4.  **## Code Health & Maintainability**: Briefly mention any areas of high complexity or potential dead code as noted in the health summary.",
        "5.  **## Usage Example**: A conceptual code snippet showing how an external consumer might use this module's public API.",
        "\nYour response must be only the raw Markdown content of the README file. Do not wrap your response in markdown ```s."
    ])
    
    final_prompt = "\n".join(prompt_parts)
    print(f"MODULE_README_SERVICE: Sending final prompt to LLM. Length: {len(final_prompt)}")
    print(final_prompt)

    # --- Step 5: Stream to LLM and Save ---
    full_response_text = ""
    try:
        stream = openai_client.chat.completions.create(
            model="gpt-4.1-mini", # Use a powerful model for this complex task
            messages=[{"role": "user", "content": final_prompt}],
            stream=True,
            temperature=0.3,
        )
        for chunk in stream:
            content = chunk.choices[0].delta.content
            if content:
                full_response_text += content
                yield content
                
        if full_response_text:
            cleaned_readme = full_response_text.strip()
            module_doc, created = ModuleDocumentation.objects.update_or_create(
                repository_id=repo_id,
                module_path=module_path,
                defaults={'content_md': cleaned_readme}
            )
            action = "created" if created else "updated"
            print(f"MODULE_README_SERVICE: Successfully {action} ModuleDocumentation for repo {repo_id}, path '{module_path}'.")
    except Exception as e:
        print(f"MODULE_README_SERVICE: FATAL - LLM streaming failed: {e}")
        yield f"// Helix encountered an error while generating the README."

def generate_refactoring_suggestions(symbol_obj: CodeSymbol, openai_client: OpenAIClient) -> list:
    """
    Uses an LLM to analyze a CodeSymbol and generate a list of
    structured refactoring suggestions in JSON format.
    """
    source_code = symbol_obj.source_code
    if not source_code or source_code.strip().startswith("# Error:"):
        logger.error(f"AI_REFACTOR: Invalid source code for symbol {symbol_obj.id}.")
        return []

    symbol_kind = "method" if symbol_obj.code_class else "function"
    
    # --- Context Injection (re-used from your existing function) ---
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

    # --- NEW, JSON-FOCUSED PROMPT ---
    # This prompt is adapted from yours to request a specific JSON structure.
    prompt = (
        f"You are an expert software architect. Your task is to analyze the provided Python code and identify actionable refactoring opportunities.\n\n"
        f"--- Context ---\n"
        f"{context_str}\n\n"
        f"--- Original Source Code ---\n"
        f"```python\n{source_code}\n```\n\n"
        f"--- INSTRUCTIONS ---\n"
        f"Analyze the code and return a JSON object containing a single key: 'suggestions'.\n"
        f"The value of 'suggestions' MUST be an array of JSON objects, where each object represents one distinct refactoring opportunity.\n"
        f"Each suggestion object MUST have the following keys:\n"
        f"- \"title\": A short, descriptive title (e.g., \"Extract Method: Input Validation\").\n"
        f"- \"description\": A brief explanation of why this refactoring is beneficial.\n"
        f"- \"type\": A string describing the type of fix, example list: [\"extract_method\", \"simplify_conditional\", \"remove_duplication\", \"rename_variable\", \"improve_loop\"].\n"
        f"- \"severity\": A string from this exact list: [\"low\", \"medium\", \"high\"].\n"
        f"- \"complexity_reduction\": An integer representing the estimated reduction in cyclomatic complexity (e.g., -2).\n"
        f"- \"current_code_snippet\": A string containing the exact lines from the original code that should be refactored.\n"
        f"- \"refactored_code_snippet\": A string containing the new code that would replace the original snippet.\n\n"
        f"If you find no refactoring opportunities, return an object with an empty array: {{\"suggestions\": []}}."
    )

    # --- LLM Call (Non-streaming, JSON mode) ---
    try:
        logger.info(f"AI_REFACTOR: Requesting refactoring suggestions for symbol {symbol_obj.id}.")
        response = openai_client.chat.completions.create(
            model="gpt-4.1-mini", # Or your preferred model that supports JSON mode
            response_format={"type": "json_object"}, # Enable JSON mode
            messages=[
                {"role": "system", "content": "You are a helpful AI code quality analyst that provides refactoring suggestions in a structured JSON format."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
        )
        
        content = response.choices[0].message.content
        if not content:
            logger.warning(f"AI_REFACTOR: LLM returned empty content for symbol {symbol_obj.id}.")
            return []

        # Parse the JSON string and extract the 'suggestions' array
        suggestions_data = json.loads(content)
        
        if isinstance(suggestions_data, dict) and "suggestions" in suggestions_data:
            # Validate that the result is a list before returning
            if isinstance(suggestions_data["suggestions"], list):
                return suggestions_data["suggestions"]
            else:
                logger.warning(f"AI_REFACTOR: 'suggestions' key is not a list for symbol {symbol_obj.id}.")
                return []
        else:
            logger.warning(f"AI_REFACTOR: LLM returned unexpected JSON structure for symbol {symbol_obj.id}.")
            return []

    except Exception as e:
        logger.exception(f"AI_REFACTOR: An exception occurred during LLM call for symbol {symbol_obj.id}: {e}")
        return []