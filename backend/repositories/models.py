from django.db import models
from django.conf import settings
from pgvector.django import VectorField # Import VectorField
from django.contrib.auth import get_user_model

User = get_user_model()
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
    unique_id = models.CharField(max_length=1024, blank=True, null=True, db_index=True) # Must be exactly 'unique_id'
    name = models.CharField(max_length=255)
    start_line = models.IntegerField()
    end_line = models.IntegerField()
    content_hash = models.CharField(max_length=64, blank=True, null=True)
    documentation_hash = models.CharField(max_length=64, blank=True, null=True)
    documentation = models.TextField(blank=True, null=True)
    embedding = VectorField(dimensions=1536, blank=True, null=True)
    class DocStatus(models.TextChoices):
        NONE = 'NONE', 'No Documentation'
        PENDING_REVIEW = 'PENDING_REVIEW', 'AI Generated - Pending Review' # From previous plan
        HUMAN_EDITED_PENDING_PR = 'EDITED_PENDING_PR', 'Human Edited - Ready for PR' # Or 'APPROVED'
        # APPROVED_IN_PR = 'APPROVED_IN_PR', 'Approved - In PR'
        # MERGED = 'MERGED', 'Merged in Source' 
        STALE = 'STALE', 'Stale Documentation' # <<< NEW OR ENSURE IT EXISTS
        FRESH = 'FRESH', 'Fresh Documentation' # <<< NEW OR ENSURE IT EXISTS (when doc_hash == content_hash)

    documentation_status = models.CharField(
        max_length=20, 
        choices=DocStatus.choices, 
        default=DocStatus.NONE,
        help_text="The review and approval status of the documentation."
    )

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
    
class AsyncTaskStatus(models.Model):
    class TaskStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        SUCCESS = 'SUCCESS', 'Success'
        FAILURE = 'FAILURE', 'Failure'
        RETRY = 'RETRY', 'Retry' # If Celery is retrying

    class TaskName(models.TextChoices):
        # Add names for each of your long-running Celery tasks
        BATCH_GENERATE_DOCS = 'BATCH_GENERATE_DOCS', 'Batch Generate Docstrings'
        CREATE_BATCH_PR = 'CREATE_BATCH_PR', 'Create Batch Pull Request'
        PROCESS_REPOSITORY = 'PROCESS_REPOSITORY', 'Process Repository' # If you want to track initial processing
        # Add more as needed

    task_id = models.CharField(max_length=255, unique=True, primary_key=True, help_text="Celery task ID")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="task_statuses", help_text="User who initiated the task")
    repository = models.ForeignKey(Repository, on_delete=models.CASCADE, related_name="task_statuses", null=True, blank=True, help_text="Associated repository, if applicable")
    
    task_name = models.CharField(max_length=50, choices=TaskName.choices, help_text="Identifier for the type of task")
    status = models.CharField(max_length=20, choices=TaskStatus.choices, default=TaskStatus.PENDING)
    
    progress = models.PositiveIntegerField(default=0, help_text="Progress percentage (0-100), if applicable")
    message = models.TextField(blank=True, null=True, help_text="Status message, error details, or success summary")
    result_data = models.JSONField(blank=True, null=True, help_text="Structured result data, e.g., PR URL, counts")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'async_task_statuses'
        ordering = ['-created_at'] # Show newest tasks first by default

    def __str__(self):
        return f"Task {self.task_name} ({self.task_id}) for {self.user.username} - {self.status}"