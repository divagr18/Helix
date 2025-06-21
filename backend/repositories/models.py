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
    last_processed = models.DateTimeField(
        null=True, 
        blank=True, 
        help_text="Timestamp of the last successful processing by the Celery task."
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    root_merkle_hash = models.CharField(max_length=64, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        db_table = 'repositories'
        verbose_name_plural = "Repositories"
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
    is_orphan = models.BooleanField(
        default=False, 
        db_index=True, # Index for faster querying of orphans
        help_text="True if this symbol is not called by any other symbol in the repository."
    )
    loc = models.PositiveIntegerField(
        null=True, blank=True, help_text="Lines of Code (non-empty, non-comment lines within the symbol body)"
    )
    cyclomatic_complexity = models.PositiveIntegerField(
        null=True, blank=True, help_text="Calculated cyclomatic complexity of the symbol"
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
    
class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    repository = models.ForeignKey(Repository, on_delete=models.CASCADE, null=True, blank=True, related_name="notifications_on_repo") # Changed related_name
    
    # Optional: Link directly to a symbol if the notification is about a specific one
    # symbol = models.ForeignKey(CodeSymbol, on_delete=models.CASCADE, null=True, blank=True, related_name="notifications")

    class NotificationType(models.TextChoices):
        STALENESS_ALERT = 'STALENESS_ALERT', 'Documentation Staleness Alert'
        TASK_COMPLETED = 'TASK_COMPLETED', 'Task Completed'
        # Add more types as needed

    notification_type = models.CharField(
        max_length=30, 
        choices=NotificationType.choices, 
        default=NotificationType.STALENESS_ALERT # Example default
    )
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Optional: A URL the user can click to go to the relevant page
    link_url = models.URLField(max_length=512, blank=True, null=True)


    class Meta:
        db_table = 'user_notifications'
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification for {self.user.username} ({self.get_notification_type_display()}): {self.message[:50]}..."
    
class EmbeddingBatchJob(models.Model):
    # Link to the repository this batch job is for
    repository = models.ForeignKey(
        'Repository', # Use string reference if Repository is defined later in file or in another app's models.py
        on_delete=models.CASCADE, 
        null=True, # Can be null if somehow a batch job isn't tied to a specific repo (less likely for us)
        blank=True,
        related_name="embedding_batch_jobs"
    )
    # OpenAI specific IDs
    batch_id = models.CharField(
        max_length=100, 
        unique=True,  # OpenAI batch IDs are unique
        db_index=True, # Good for querying by batch_id
        help_text="OpenAI Batch API Job ID"
    )
    input_file_id = models.CharField(
        max_length=100, 
        help_text="OpenAI File ID for the input batch .jsonl file"
    )
    output_file_id = models.CharField(
        max_length=100, 
        null=True, 
        blank=True,
        help_text="OpenAI File ID for the output results .jsonl file"
    )
    error_file_id = models.CharField(
        max_length=100, 
        null=True, 
        blank=True,
        help_text="OpenAI File ID for the error details .jsonl file"
    )
    
    class JobStatus(models.TextChoices):
        # Custom status before OpenAI Batch API is involved
        PENDING_SUBMISSION = 'pending_submission', 'Pending Submission to OpenAI' 
        # OpenAI Batch API Statuses (mirroring theirs)
        VALIDATING = 'validating', 'Validating'
        FAILED_VALIDATION = 'failed_validation', 'Failed Validation' # If input file fails validation
        IN_PROGRESS = 'in_progress', 'In Progress'
        FINALIZING = 'finalizing', 'Finalizing'
        COMPLETED = 'completed', 'Completed by OpenAI'
        FAILED = 'failed', 'Failed by OpenAI'
        EXPIRED = 'expired', 'Expired by OpenAI'
        CANCELLING = 'cancelling', 'Cancelling'
        CANCELLED = 'cancelled', 'Cancelled'
        RESULTS_PROCESSING = 'results_processing', 'Processing Results'
        RESULTS_PROCESSED = 'results_processed', 'Results Processed in DB'
        RESULTS_FAILED_TO_PROCESS = 'results_failed_to_process', 'Failed to Process Results'


    status = models.CharField(
        max_length=30, 
        choices=JobStatus.choices, 
        default=JobStatus.PENDING_SUBMISSION,
        db_index=True
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True) # Tracks last status update or poll
    submitted_to_openai_at = models.DateTimeField(null=True, blank=True)
    openai_completed_at = models.DateTimeField(null=True, blank=True) # When OpenAI marks it complete
    results_processed_at = models.DateTimeField(null=True, blank=True) # When we finish DB updates

    # Metadata from OpenAI or our own
    openai_metadata = models.JSONField(null=True, blank=True, help_text="Metadata from OpenAI Batch object")
    custom_metadata = models.JSONField(null=True, blank=True, help_text="Custom metadata for this job")
    error_details = models.TextField(null=True, blank=True, help_text="Details of any processing errors")

    def __str__(self):
        return f"Embedding Batch {self.batch_id or 'N/A'} for Repo {self.repository_id or 'N/A'} - Status: {self.get_status_display()}"

    class Meta:
        db_table = 'embedding_batch_jobs'
        ordering = ['-created_at']
        verbose_name = "Embedding Batch Job"
        verbose_name_plural = "Embedding Batch Jobs"