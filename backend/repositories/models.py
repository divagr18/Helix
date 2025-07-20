import uuid
from django.db import models
from django.conf import settings
from pgvector.django import VectorField # Import VectorField
from pgvector.django import HnswIndex
from django.utils import timezone
from django.contrib.auth import get_user_model
from .utils import get_source_for_symbol
User = get_user_model()
class Organization(models.Model):
    """
    Represents a team or workspace that owns repositories.
    This is the primary tenant model.
    """
    name = models.CharField(max_length=200, help_text="The name of the organization or workspace.")
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT, # Prevent deleting a user that owns an organization
        related_name="owned_organizations",
        help_text="The user who created and owns the organization."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    ai_requests_this_month = models.PositiveIntegerField(default=0)
    ai_requests_limit = models.PositiveIntegerField(default=100) # A generous limit for the beta

    last_usage_reset = models.DateField(default=timezone.now)

    class Meta:
        db_table = 'organizations'
        ordering = ['name']

    def __str__(self):
        return self.name

# --- NEW MODEL: OrganizationMember (The "through" table) ---
class OrganizationMember(models.Model):
    """
    Links a User to an Organization, defining their role within that team.
    """
    class Role(models.TextChoices):
        OWNER = 'OWNER', 'Owner'
        ADMIN = 'ADMIN', 'Admin'
        MEMBER = 'MEMBER', 'Member'

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="organization_memberships")
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MEMBER)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'organization_members'
        # A user can only have one role within a single organization
        unique_together = ('organization', 'user')
        ordering = ['organization__name', 'user__username']

    def __str__(self):
        return f"{self.user.username} is a {self.get_role_display()} of {self.organization.name}"
class Repository(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='repositories',
        help_text="The organization that owns this repository.",
        null=True
    )
    
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
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, # If the user is deleted, we keep the repo but nullify who added it
        null=True,
        related_name='added_repositories'
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    root_merkle_hash = models.CharField(max_length=64, blank=True, null=True)
    default_branch = models.CharField(max_length=100, default='main')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    documentation_coverage = models.FloatField(default=0.0)
    primary_language = models.CharField(
        max_length=50, 
        null=True, 
        blank=True, 
        help_text="The dominant programming language of the repository."
    )
    size_kb = models.PositiveIntegerField(
        default=0, 
        help_text="The size of the repository on disk in kilobytes."
    )
    commit_count = models.PositiveIntegerField(
        default=0, 
        help_text="The total number of commits in the default branch."
    )
    contributor_count = models.PositiveIntegerField(
        default=0, 
        help_text="The number of unique contributors to the repository."
    )
    orphan_symbol_count = models.IntegerField(default=0)
    source_root = models.CharField(
        max_length=255,
        default='.',
        blank=True,
        help_text="The source root directory for Python imports, relative to the repo root (e.g., 'src', '.')."
    )
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
    imports = models.JSONField(
        null=True, 
        blank=True, 
        help_text="A list of modules imported in this file, extracted by the parser."
    )
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
    summary = models.CharField(
        max_length=512, # A CharField is more appropriate for a single sentence
        null=True, 
        blank=True, 
        help_text="A concise, one-sentence summary of the class's purpose, generated by Helix AI."
    )
    generated_summary_md = models.TextField(
        null=True, 
        blank=True, 
        help_text="The full, detailed markdown summary of the class, generated by Helix AI."
    )
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
    @property
    def source_code(self) -> str:
        """
        Retrieves the source code for this symbol from the cached file on disk
        by calling the utility function.
        
        Returns a descriptive error string prefixed with '# Error:' if not found.
        """
        return get_source_for_symbol(self)
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
    existing_docstring = models.TextField(
        null=True, 
        blank=True, 
        help_text="The docstring that existed in the source code during the last scan."
    )
    
    signature_end_location = models.JSONField(
        null=True, 
        blank=True, 
        help_text="A JSON object with {'line': y, 'column': z} indicating where the function signature ends."
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
        MODULE_WORKFLOW = 'MODULE_WORKFLOW', 'Generate Module Documentation'
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
        unique=True,
        null=True, # <--- ADD THIS
        blank=True,  # OpenAI batch IDs are unique
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
    class JobType(models.TextChoices):
        SYMBOL_EMBEDDING = 'SYMBOL_EMBEDDING', 'Symbol Embedding'
        KNOWLEDGE_CHUNK_EMBEDDING = 'KNOWLEDGE_CHUNK_EMBEDDING', 'Knowledge Chunk Embedding'    
    job_type = models.CharField(
        max_length=30,
        choices=JobType.choices,
        default=JobType.SYMBOL_EMBEDDING, # Or make it required on creation
        help_text="The type of content this batch job is for."
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
    output_file_id = models.CharField(max_length=100, null=True, blank=True, help_text="The ID of the output file from a completed OpenAI job.")
    completed_at = models.DateTimeField(null=True, blank=True, help_text="Timestamp when the job was confirmed as completed by our poller.")
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

class Insight(models.Model):
    """
    Stores a single piece of generated insight about a repository change.
    """
    class InsightType(models.TextChoices):
        # --- Start with types from our Structural Diff ---
        SYMBOL_ADDED = 'SYMBOL_ADDED', 'Symbol Added'
        SYMBOL_REMOVED = 'SYMBOL_REMOVED', 'Symbol Removed'
        SYMBOL_MODIFIED = 'SYMBOL_MODIFIED', 'Symbol Modified'
        DEPENDENCY_ADDED = 'DEPENDENCY_ADDED', 'Dependency Added'
        DEPENDENCY_REMOVED = 'DEPENDENCY_REMOVED', 'Dependency Removed'
        # --- We will add more types later (e.g., REFACTOR_SUGGESTION) ---

    repository = models.ForeignKey(Repository, on_delete=models.CASCADE, related_name='insights')
    
    # The commit hash this insight is associated with.
    # We'll need to get this from the git pull.
    commit_hash = models.CharField(max_length=40, db_index=True)

    insight_type = models.CharField(max_length=30, choices=InsightType.choices, db_index=True)
    
    # A human-readable message for the insight.
    message = models.TextField()
    
    # JSON field to store structured data, e.g., symbol names, file paths.
    data = models.JSONField(default=dict, null=True, blank=True)

    # Link to a specific symbol if the insight is about one.
    # Use SET_NULL to keep the insight even if the symbol is deleted.
    related_symbol = models.ForeignKey(CodeSymbol, on_delete=models.SET_NULL, null=True, blank=True, related_name='insights')
    
    # Allows users to dismiss or action an insight.
    is_resolved = models.BooleanField(default=False, db_index=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'repository_insights'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['repository', 'commit_hash']),
        ]

    def __str__(self):
        return f"{self.get_insight_type_display()} for {self.repository.name} at {self.commit_hash[:7]}"
    
class KnowledgeChunk(models.Model):
    """
    Represents a searchable chunk of text content from a repository,
    along with its vector embedding for semantic search.
    """
    class ChunkType(models.TextChoices):
        # We will start with these two. More can be added later (e.g., CLASS_SUMMARY).
        MODULE_README = 'MODULE_README', 'Module README'       # <--- NEW
        CLASS_SUMMARY = 'CLASS_SUMMARY', 'Class Summary'  
        SYMBOL_DOCSTRING = 'SYMBOL_DOCSTRING', 'Symbol Docstring'
        SYMBOL_SOURCE = 'SYMBOL_SOURCE', 'Symbol Source Code'

    repository = models.ForeignKey(Repository, on_delete=models.CASCADE, related_name='knowledge_chunks')
    chunk_type = models.CharField(max_length=20, choices=ChunkType.choices, db_index=True)
    
    # The actual text content that was embedded
    content = models.TextField()
    
    # The vector embedding of the content
    embedding = VectorField(
        dimensions=1536,
        null=True,  # 03c03c03c ADD THIS: Allow the field to be null in the database
        blank=True  # 03c03c03c ADD THIS: Allow the field to be blank in Django forms/admin
    ) # Using default for OpenAI's text-embedding-ada-002

    # Links back to the source of the content for citation and context
    related_file = models.ForeignKey(CodeFile, on_delete=models.CASCADE, null=True, blank=True)
    related_class = models.ForeignKey(CodeClass, on_delete=models.CASCADE, null=True, blank=True)
    related_symbol = models.ForeignKey(CodeSymbol, on_delete=models.CASCADE, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'knowledge_chunks'
        ordering = ['-created_at']
        indexes = [
            # Add an HNSW index for fast, approximate nearest-neighbor search.
            # This is crucial for performance on large datasets.
            HnswIndex(
                name='knowledge_embedding_hnsw_l2_idx',
                fields=['embedding'],
                m=16,              # Recommended starting point
                ef_construction=64, # Recommended starting point
                opclasses=['vector_l2_ops']
            ),
        ]

    def __str__(self):
        related_name = "N/A"
        if self.related_symbol:
            related_name = self.related_symbol.name
        elif self.related_class:
            related_name = self.related_class.name
        elif self.related_file:
            related_name = self.related_file.file_path
        return f"{self.get_chunk_type_display()} for '{related_name}'"
    
class ModuleDocumentation(models.Model):
    """
    Stores AI-generated README.md content for a specific module/directory
    within a repository.
    """
    repository = models.ForeignKey(Repository, on_delete=models.CASCADE, related_name='module_docs')
    # The path to the module/directory this documentation describes.
    # An empty string "" denotes the root of the repository.
    module_path = models.CharField(max_length=1024, db_index=True)
    
    # The full markdown content of the generated README.
    content_md = models.TextField()

    last_generated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'module_documentation'
        # Ensure that for any given repository, a module path can only have one README.
        unique_together = ('repository', 'module_path')
        ordering = ['-last_generated_at']

    def __str__(self):
        path_display = self.module_path if self.module_path else "Repository Root"
        return f"README for {path_display} in {self.repository.full_name}"
    
class ModuleDependency(models.Model):
    """
    Represents a dependency where one file (the source) imports another
    file (the target) within the same repository. This forms the directed
    edges of the module dependency graph.
    """
    repository = models.ForeignKey(Repository, on_delete=models.CASCADE, related_name='module_dependencies')
    
    # The file that contains the `import` statement
    source_file = models.ForeignKey(CodeFile, on_delete=models.CASCADE, related_name='outgoing_dependencies')
    
    # The file that is being imported
    target_file = models.ForeignKey(CodeFile, on_delete=models.CASCADE, related_name='incoming_dependencies')

    class Meta:
        db_table = 'module_dependencies'
        # Ensure we don't create duplicate dependency edges
        unique_together = ('source_file', 'target_file')
        indexes = [
            models.Index(fields=['source_file']),
            models.Index(fields=['target_file']),
        ]

    def __str__(self):
        return f"'{self.source_file.file_path}' -> '{self.target_file.file_path}'"
    

class Invitation(models.Model):
    class InviteStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        ACCEPTED = 'ACCEPTED', 'Accepted'
        EXPIRED = 'EXPIRED', 'Expired'

    organization = models.ForeignKey('Organization', on_delete=models.CASCADE, related_name='invitations')
    email = models.EmailField(help_text="Email of the user being invited.")
    role = models.CharField(max_length=10, choices=OrganizationMember.Role.choices, default=OrganizationMember.Role.MEMBER)
    invited_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_invitations')
    token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    status = models.CharField(max_length=10, choices=InviteStatus.choices, default=InviteStatus.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'organization_invitations'
        unique_together = ('organization', 'email', 'status') # Allow re-inviting if previous was not pending
        ordering = ['-created_at']

    def __str__(self):
        return f"Invitation for {self.email} to join {self.organization.name}"

# backend/repositories/models.py

class TestCoverageReport(models.Model):
    """
    Represents a single, uploaded coverage report for a specific commit.
    """
    repository = models.ForeignKey(Repository, on_delete=models.CASCADE, related_name='coverage_reports')
    commit_hash = models.CharField(max_length=40, help_text="The commit hash this report is for.")
    uploaded_at = models.DateTimeField(auto_now_add=True)
    overall_coverage = models.FloatField(help_text="Overall line rate (e.g., 0.95 for 95%).")

    class Meta:
        db_table = 'test_coverage_reports'
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"Coverage Report for {self.repository.name} at {self.commit_hash[:7]}"

class FileCoverage(models.Model):
    """
    Stores coverage data for a single file within a report.
    """
    report = models.ForeignKey(TestCoverageReport, on_delete=models.CASCADE, related_name='file_coverages')
    # Use SET_NULL so that if a file is deleted from our index, we don't lose the historical coverage data
    code_file = models.ForeignKey(CodeFile, on_delete=models.SET_NULL, null=True, related_name='coverage_data')
    
    line_rate = models.FloatField(help_text="Line rate for this file (e.g., 0.80 for 80%).")
    
    # Store the line numbers in a JSONField for easy access and to avoid complex table structures
    covered_lines = models.JSONField(default=list, help_text="List of line numbers that were executed.")
    missed_lines = models.JSONField(default=list, help_text="List of line numbers that were not executed.")
    # For branch coverage, you could add partial_lines here as well

    class Meta:
        db_table = 'test_file_coverage'
        # A file should only appear once per report
        unique_together = ('report', 'code_file')