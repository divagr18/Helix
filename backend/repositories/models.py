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
    
    class Meta:
        db_table = 'code_files'
        # Ensure a file path is unique within a repository
        unique_together = ('repository', 'file_path')

    def __str__(self):
        return self.file_path

class CodeFunction(models.Model):
    code_file = models.ForeignKey(CodeFile, on_delete=models.CASCADE, related_name='functions')
    name = models.CharField(max_length=255)
    start_line = models.IntegerField()
    end_line = models.IntegerField()
    class Meta:
        db_table = 'code_functions'
    
    # This is where we will eventually store the generated documentation
    documentation = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.name} ({self.code_file.file_path})"