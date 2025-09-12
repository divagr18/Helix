class DataProcessor:
    """A class for processing data."""
    
    def __init__(self):
        self.data = []
    
    def add_data(self, item):
        """Add an item to the data list."""
        self.data.append(item)
    
    def process_data(self):
        """Process all data items."""
        processed = []
        for item in self.data:
            if isinstance(item, str):
                processed.append(item.upper())
            elif isinstance(item, (int, float)):
                processed.append(item * 2)
            else:
                processed.append(str(item))
        return processed
