# backend/repositories/diagram_utils.py
import re
from .models import CodeSymbol, CodeDependency

# --- Helper Function to Sanitize Strings for Mermaid Node IDs (from views.py) ---
def sanitize_for_mermaid_id(text: str, prefix: str = "node_") -> str:
    """
    Sanitizes a string to be a valid Mermaid node ID.
    Mermaid IDs should be alphanumeric and can contain underscores.
    They cannot typically start with a number if unquoted, so we add a prefix.
    """
    if not text: # Handle empty or None string case
        return f"{prefix}empty_or_none"
    # Replace common problematic characters (like '::', '/', '.') with underscores
    sanitized = re.sub(r'[^a-zA-Z0-9_]', '_', text)
    # Ensure it doesn't start with a number by adding a prefix if the sanitized part itself starts with a digit
    if not sanitized: # Should not happen if original text was not empty
        return f"{prefix}empty_sanitized"
    if sanitized[0].isdigit():
        return f"{prefix}num_{sanitized}"
    return f"{prefix}{sanitized}"

def generate_react_flow_data(
    central_symbol: CodeSymbol, 
    callers: list[CodeSymbol], 
    callees: list[CodeSymbol]
) -> dict:
    """
    Generates node and edge data suitable for React Flow.
    """
    nodes = []
    edges = []

    # Node IDs will be their database IDs (as strings)
    central_node_id = str(central_symbol.id)

    # Simple programmatic layout:
    node_x_spacing = 250
    node_y_spacing = 120
    center_x, center_y = 250, 150 # Initial position for central node

    # Central Node
    nodes.append({
        "id": central_node_id,
        "data": {"label": central_symbol.name, "type": "central", "db_id": central_symbol.id}, # Add db_id for click
        "position": {"x": center_x, "y": center_y},
        "type": "customSymbolNode" # We'll define this custom node type in React
    })

    # Caller Nodes
    for i, caller in enumerate(callers):
        caller_node_id = str(caller.id)
        nodes.append({
            "id": caller_node_id,
            "data": {"label": caller.name, "type": "caller", "db_id": caller.id},
            "position": {"x": center_x - node_x_spacing, "y": center_y + (i - (len(callers) -1) / 2) * node_y_spacing},
            "type": "customSymbolNode"
        })
        edges.append({
            "id": f"e-{caller_node_id}-{central_node_id}",
            "source": caller_node_id,
            "target": central_node_id,
            "animated": False # Or True for effect
        })

    # Callee Nodes
    for i, callee in enumerate(callees):
        callee_node_id = str(callee.id)
        nodes.append({
            "id": callee_node_id,
            "data": {"label": callee.name, "type": "callee", "db_id": callee.id},
            "position": {"x": center_x + node_x_spacing, "y": center_y + (i - (len(callees) -1) / 2) * node_y_spacing},
            "type": "customSymbolNode"
        })
        edges.append({
            "id": f"e-{central_node_id}-{callee_node_id}",
            "source": central_node_id,
            "target": callee_node_id,
            "animated": False
        })
        
    return {"nodes": nodes, "edges": edges}
def generate_mermaid_for_symbol_dependencies(
    central_symbol: CodeSymbol, 
    callers: list[CodeSymbol], 
    callees: list[CodeSymbol]
) -> str:
    """
    Generates Mermaid.js graph syntax for a central symbol and its direct dependencies.
    """
    mermaid_lines = ["graph TD;"] # TopDown graph
    mermaid_lines.append("    %% Default link style for brighter lines")
    mermaid_lines.append("    linkStyle default stroke:#cccccc,stroke-width:2px;")
    # --- Node Definitions ---
    mermaid_lines.append("    %% Node Definitions")
    
    # Sanitize IDs for Mermaid - Use symbol.id for guaranteed uniqueness in the diagram context
    # The label will be symbol.name. The unique_id can be too long/complex for a Mermaid node ID.
    central_node_mermaid_id = sanitize_for_mermaid_id(f"symbol_{central_symbol.id}", prefix="") # No extra prefix if already "symbol_"
    central_node_label = central_symbol.name.replace('"',"'") # Escape quotes for label
    
    # Define central node first
    # We'll add a data attribute for the actual database ID for click handling
    mermaid_lines.append(f'    {central_node_mermaid_id}["{central_node_label}"];')
    # Example of adding a class for easier JS targeting, or data attribute:
    # mermaid_lines.append(f'    click {central_node_mermaid_id} call handleSymbolClick("{central_symbol.id}") "Go to symbol details";')
    # For now, let's just define nodes. Click handling will be a separate step.

    # Define caller nodes
    for caller in callers:
        caller_mermaid_id = sanitize_for_mermaid_id(f"symbol_{caller.id}", prefix="")
        caller_label = caller.name.replace('"',"'")
        mermaid_lines.append(f'    {caller_mermaid_id}["{caller_label}"];')

    # Define callee nodes
    for callee in callees:
        callee_mermaid_id = sanitize_for_mermaid_id(f"symbol_{callee.id}", prefix="")
        callee_label = callee.name.replace('"',"'")
        mermaid_lines.append(f'    {callee_mermaid_id}["{callee_label}"];')
    mermaid_lines.append("")

    # --- Style Definitions ---
    mermaid_lines.append("    %% Style Definitions")
    mermaid_lines.append(f'    style {central_node_mermaid_id} fill:#87CEEB,stroke:#00008B,stroke-width:2px,color:#000000;')
    for caller in callers:
        caller_mermaid_id = sanitize_for_mermaid_id(f"symbol_{caller.id}", prefix="")
        mermaid_lines.append(f'    style {caller_mermaid_id} fill:#90EE90,stroke:#006400,stroke-width:1px,color:#000000;')
    for callee in callees:
        callee_mermaid_id = sanitize_for_mermaid_id(f"symbol_{callee.id}", prefix="")
        mermaid_lines.append(f'    style {callee_mermaid_id} fill:#FFB6C1,stroke:#8B0000,stroke-width:1px,color:#000000;')
    mermaid_lines.append("")

    # --- Edge Definitions ---
    mermaid_lines.append("    %% Edge Definitions")
    for caller in callers:
        caller_mermaid_id = sanitize_for_mermaid_id(f"symbol_{caller.id}", prefix="")
        mermaid_lines.append(f'    {caller_mermaid_id} --> {central_node_mermaid_id};')
    for callee in callees:
        callee_mermaid_id = sanitize_for_mermaid_id(f"symbol_{callee.id}", prefix="")
        mermaid_lines.append(f'    {central_node_mermaid_id} --> {callee_mermaid_id};')
    mermaid_lines.append("")

    # --- Legend ---
    mermaid_lines.append("    %% Legend")
    mermaid_lines.append("    subgraph Legend")
    mermaid_lines.append('        direction LR')
    mermaid_lines.append('        caller_legend["Caller"]; style caller_legend fill:#90EE90,stroke:#006400,color:#000000;')
    mermaid_lines.append('        central_legend["Central Symbol"]; style central_legend fill:#87CEEB,stroke:#00008B,color:#000000;')
    mermaid_lines.append('        callee_legend["Callee"]; style callee_legend fill:#FFB6C1,stroke:#8B0000,color:#000000;')
    mermaid_lines.append("    end")

    return "\n".join(mermaid_lines)