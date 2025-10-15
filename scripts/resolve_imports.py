# scripts/resolve_imports.py
import sys
import json
import os
from importlib.util import resolve_name

def resolve_imports(source_root, file_path, raw_imports):
    """
    Uses Python's own import resolution machinery to find the canonical
    absolute path for each raw import string.
    """
    resolved_paths = []
    
    # Convert the file system path to a Python module path to act as the "package" context
    # e.g., 'my_app/views.py' -> 'my_app.views'
    current_module_path = file_path.replace('.py', '').replace(os.path.sep, '.')

    for imp_string in raw_imports:
        try:
            # resolve_name is the core of Python's relative import logic.
            # It takes the name to resolve (e.g., '.models') and the package
            # it's being resolved from (e.g., 'my_app.views').
            absolute_path = resolve_name(imp_string, current_module_path)
            resolved_paths.append(absolute_path)
        except (ImportError, ValueError):
            # If importlib can't resolve it (e.g., it's a third-party library
            # not in the path, or an invalid import), we just use the original string.
            # This is a safe fallback.
            resolved_paths.append(imp_string)
            
    return resolved_paths

if __name__ == "__main__":
    if len(sys.argv) != 4:
        # Print errors to stderr so they don't corrupt the JSON output on stdout
        print(json.dumps({"error": "Invalid arguments"}), file=sys.stderr)
        sys.exit(1)
        
    source_root_arg = sys.argv[1]
    file_path_arg = sys.argv[2]
    raw_imports_json_arg = sys.argv[3]
    
    # Add the repository's source root to Python's path so it can find the modules
    sys.path.insert(0, source_root_arg)
    
    try:
        raw_imports_list = json.loads(raw_imports_json_arg)
        resolved = resolve_imports(source_root_arg, file_path_arg, raw_imports_list)
        # Print the final, successful JSON result to stdout
        print(json.dumps(resolved))
    except json.JSONDecodeError:
        print(json.dumps({"error": "Invalid JSON for raw_imports"}), file=sys.stderr)
        sys.exit(1)