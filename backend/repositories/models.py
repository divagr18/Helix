from django.db import models
from django.conf import settings

class Repository(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    
    name = models.CharField(max_length=255)
    full_name = models.CharField(max_length=512, unique=True) 
    github_id = models.IntegerField(unique=True)
    
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        INDEXING = 'INDEXING', 'Indexing'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED = 'FAILED', 'Failed'

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    root_merkle_hash = models.CharField(max_length=64, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        db_table = 'repositories'
    def __str__(self):
        return self.full_name
    
class CodeFile(models.Model):
    repository = models.ForeignKey(Repository, on_delete=models.CASCADE, related_name='files')
    file_path = models.CharField(max_length=1024)
    
    # We can add more fields later, like a hash of the file content
    structure_hash = models.CharField(max_length=64, blank=True, null=True)

    class Meta:
        db_table = 'code_files'
        # Ensure a file path is unique within a repository
        unique_together = ('repository', 'file_path')

    def __str__(self):
        return self.file_path
class CodeClass(models.Model):
    code_file = models.ForeignKey(CodeFile, on_delete=models.CASCADE, related_name='classes')
    name = models.CharField(max_length=255)
    start_line = models.IntegerField()
    end_line = models.IntegerField()
    structure_hash = models.CharField(max_length=64, blank=True, null=True)

    class Meta:
        db_table = 'code_classes'

    def __str__(self):
        return f"{self.name} ({self.code_file.file_path})"
class CodeSymbol(models.Model):
    # A symbol can belong directly to a file (top-level function)
    code_file = models.ForeignKey(CodeFile, on_delete=models.CASCADE, related_name='symbols', null=True, blank=True)
    # OR it can belong to a class (method)
    code_class = models.ForeignKey(CodeClass, on_delete=models.CASCADE, related_name='methods', null=True, blank=True)
    
    name = models.CharField(max_length=255)
    start_line = models.IntegerField()
    end_line = models.IntegerField()
    content_hash = models.CharField(max_length=64, blank=True, null=True)
    documentation_hash = models.CharField(max_length=64, blank=True, null=True)
    documentation = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'code_symbols'

    def __str__(self):
        parent = self.code_class.name if self.code_class else self.code_file.file_path
        return f"{self.name} in {parent}"
    
class CodeDependency(models.Model):
    # The symbol that is making the call
    caller = models.ForeignKey(CodeSymbol, on_delete=models.CASCADE, related_name='outgoing_calls')
    # The symbol that is being called
    callee = models.ForeignKey(CodeSymbol, on_delete=models.CASCADE, related_name='incoming_calls')
    
    class Meta:
        db_table = 'code_dependencies'
        # Prevent duplicate dependency entries for the same caller/callee pair
        unique_together = ('caller', 'callee')

    def __str__(self):
        return f"{self.caller.name} -> {self.callee.name}"