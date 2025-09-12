def hello_world():
    """A simple hello world function."""
    return "Hello, World!"

class Calculator:
    """A simple calculator class."""
    
    def add(self, a, b):
        """Add two numbers."""
        return a + b
    
    def multiply(self, a, b):
        """Multiply two numbers."""
        return a * b

if __name__ == "__main__":
    calc = Calculator()
    print(hello_world())
    print(f"2 + 3 = {calc.add(2, 3)}")
    print(f"4 * 5 = {calc.multiply(4, 5)}")
