# backend/repositories/utils.py
import os
from typing import TYPE_CHECKING

# Import your models and settings
REPO_CACHE_BASE_PATH = "/var/repos"
# Use TYPE_CHECKING to avoid circular imports, a common Django pattern.
# The models module might one day import from utils, so this is safe.
if TYPE_CHECKING:
    from .models import CodeSymbol

def get_source_for_symbol(symbol_obj: 'CodeSymbol') -> str:
    """
    Retrieves the source code for a CodeSymbol instance from the cached file on disk.
    
    This function is designed to be robust and will return a descriptive error string
    prefixed with '# Error:' if the source code cannot be retrieved for any reason.
    """
    if not symbol_obj:
        return "# Error: Provided symbol object is None."

    # Determine the correct CodeFile instance from the symbol
    actual_code_file = None
    if symbol_obj.code_file:
        actual_code_file = symbol_obj.code_file
    elif symbol_obj.code_class and symbol_obj.code_class.code_file:
        actual_code_file = symbol_obj.code_class.code_file
    
    if not actual_code_file:
        print(f"ERROR_UTIL: Symbol {symbol_obj.id} ({symbol_obj.name}) has no associated CodeFile.")
        return f"# Error: Symbol {symbol_obj.id} is not linked to a file."

    if not REPO_CACHE_BASE_PATH:
        print("ERROR_UTIL: REPO_CACHE_BASE_PATH is not defined.")
        return "# Error: System configuration issue (REPO_CACHE_BASE_PATH is not set)."

    # Construct the full path to the source file
    repo_path_for_file = os.path.join(REPO_CACHE_BASE_PATH, str(actual_code_file.repository.id))
    full_file_path_for_file = os.path.join(repo_path_for_file, actual_code_file.file_path)

    if not os.path.exists(full_file_path_for_file):
        print(f"WARNING_UTIL: File not found in cache for {symbol_obj.unique_id or symbol_obj.name}: {full_file_path_for_file}")
        return "# Error: Source file not found in cache."

    try:
        with open(full_file_path_for_file, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        
        # Validate line numbers
        if symbol_obj.start_line > 0 and \
           symbol_obj.end_line >= symbol_obj.start_line and \
           symbol_obj.end_line <= len(lines):
            
            # Slice the lines to get the source code
            symbol_code_lines = lines[symbol_obj.start_line - 1 : symbol_obj.end_line]
            return "".join(symbol_code_lines)
        else:
            print(f"WARNING_UTIL: Invalid line numbers for {symbol_obj.unique_id or symbol_obj.name} in file {full_file_path_for_file}. "
                  f"Start: {symbol_obj.start_line}, End: {symbol_obj.end_line}, Total Lines: {len(lines)}")
            return f"# Error: Invalid line numbers ({symbol_obj.start_line}-{symbol_obj.end_line})."
            
    except Exception as e:
        print(f"ERROR_UTIL: Error reading file for {symbol_obj.unique_id or symbol_obj.name}: {e}")
        return f"# Error reading file: {e}"