# backend/repositories/ai_services.py
from typing import Generator
from django.conf import settings
from openai import OpenAI as OpenAIClient

from .models import CodeClass, CodeSymbol, CodeDependency

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
