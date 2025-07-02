import os
import json

# A top-level variable
MODULE_CONSTANT = "HELLO_HELIX"

def function_with_docstring(param1: int, param2: str = "default") -> str:
    """This is the main summary line.

    This is a more detailed description of what the function does.
    It can span multiple lines and contains indentation that needs
    to be handled correctly by the parser.

    Args:
        param1 (int): The first parameter.
        param2 (str): The second, optional parameter.

    Returns:
        str: A formatted string combining the parameters.
    """
    # This is an important inline comment that must be preserved.
    result = f"Received: {param1} and {param2}"
    print(result)
    return result

def function_without_docstring(data):
    # This function intentionally lacks a docstring.
    # The parser should return `null` for its docstring field.
    if data:
        return True
    return False

class MyTestClass:
    """
    A summary for the entire class.
    Note: The current parser does not extract class docstrings, only method/function ones.
    """
    def __init__(self, name):
        self.name = name # Set the instance name

    def method_with_docstring(self):
        """A simple, one-line docstring for a method."""
        return f"Hello from {self.name}"

    def _private_method_no_doc(self):
        # This private method has no docstring.
        pass

@my_decorator
def decorated_function(x, y):
    """A docstring for a function that has a decorator."""
    # The parser needs to correctly find this docstring
    # inside the decorated_definition node.
    return x * y

def another_function():
    """Single line docstring."""
    return MODULE_CONSTANT