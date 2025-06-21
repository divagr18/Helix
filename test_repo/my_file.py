# This is a comment
# Another comment

def simple_func(): # LOC: 1, CC: 1
    pass

def func_with_if(a): # LOC: ~3, CC: 2
    if a > 10:
        return True # Decision point
    return False

def complex_func(x, y, z): # LOC: ~9, CC: 1 (if) + 1 (for) + 1 (and) + 1 (or) + 1 (initial) = 5
    """
    A more complex function.
    """
    count = 0
    if x > 5 and (y < 0 or z == 1): # 1 for if, 1 for and, 1 for or
        for i in range(x): # 1 for for
            count += i
            print(i) # Not a comment
    # Empty line
    return count

class MyClass:
    def __init__(self): # LOC: 1, CC: 1
        self.value = 0

    def method_with_while(self, limit): # LOC: ~4, CC: 2
        # Comment in method
        i = 0
        while i < limit: # Decision point
            self.value += 1
            i += 1
        return self.value