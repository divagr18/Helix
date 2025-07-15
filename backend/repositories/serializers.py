# backend/repositories/serializers.py
from rest_framework import serializers
from .models import Repository, CodeFile, CodeClass, CodeSymbol, CodeDependency,AsyncTaskStatus,Insight, User,Organization,OrganizationMember
from rest_framework import generics, permissions
import os # Ensure os is imported
REPO_CACHE_BASE_PATH = "/var/repos" # Use the same constant
# A serializer for our most granular item: a function or method.
from .models import Notification
from .models import ModuleDocumentation # Import new model

class DependencyLinkSerializer(serializers.ModelSerializer):
    # We'll represent the other end of the link by its unique_id and name
    unique_id = serializers.CharField(source='__str__', read_only=True)
    name = serializers.CharField(source='name', read_only=True)
    
    class Meta:
        model = CodeSymbol
        fields = [
            'id', 'unique_id', 'name', 'start_line', 'end_line',
            'documentation', 'content_hash', 'documentation_hash',
            'incoming_calls', 'outgoing_calls' # Add the new fields
        ]
class LinkedSymbolSerializer(serializers.ModelSerializer):
    class Meta:
        model = CodeSymbol
        fields = ['id', 'name', 'unique_id']

# Main CodeSymbolSerializer
class CodeSymbolSerializer(serializers.ModelSerializer):
    incoming_calls = serializers.SerializerMethodField()
    outgoing_calls = serializers.SerializerMethodField()
    source_code = serializers.SerializerMethodField() # Add this new field


    class Meta:
        model = CodeSymbol
        fields = [
            'id', 'unique_id', 'name', 'start_line', 'end_line',
            'documentation','existing_docstring',      # The one from the source code
            'signature_end_location', 'content_hash', 'documentation_hash', 'documentation_status', 
            'incoming_calls', 'outgoing_calls','source_code','is_orphan','get_documentation_status_display','loc',
            'cyclomatic_complexity', # Add to fields list
        ]

    def get_incoming_calls(self, obj):
        # 'obj' is the CodeSymbol instance (the one being called).
        # We need to find all CodeDependency records where 'obj' is the 'callee'.
        # Then, for each of these dependencies, we get the 'caller' CodeSymbol.
        dependencies = CodeDependency.objects.filter(callee=obj)
        callers = [dep.caller for dep in dependencies]
        return LinkedSymbolSerializer(callers, many=True).data

    def get_outgoing_calls(self, obj):
        # 'obj' is the CodeSymbol instance (the one making the call).
        # We need to find all CodeDependency records where 'obj' is the 'caller'.
        # Then, for each of these dependencies, we get the 'callee' CodeSymbol.
        dependencies = CodeDependency.objects.filter(caller=obj)
        callees = [dep.callee for dep in dependencies]
        return LinkedSymbolSerializer(callees, many=True).data
    def get_source_code(self, obj: CodeSymbol) -> str | None:
        # 'obj' is the CodeSymbol instance
        actual_code_file = None
        if obj.code_file:
            actual_code_file = obj.code_file
        elif obj.code_class and obj.code_class.code_file:
            actual_code_file = obj.code_class.code_file
        
        if not actual_code_file:
            return None

        # Construct the path to the cached file
        # REPO_CACHE_BASE_PATH should be accessible here (e.g., from settings or models)
        repo_path = os.path.join(REPO_CACHE_BASE_PATH, str(actual_code_file.repository.id))
        full_file_path = os.path.join(repo_path, actual_code_file.file_path)

        if os.path.exists(full_file_path):
            try:
                with open(full_file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    lines = f.readlines()
                # Extract the specific lines of code for the symbol
                # Ensure start_line and end_line are valid 1-based indices
                if obj.start_line > 0 and obj.end_line >= obj.start_line and obj.end_line <= len(lines):
                    symbol_code_lines = lines[obj.start_line - 1 : obj.end_line]
                    return "".join(symbol_code_lines)
                else:
                    print(f"Warning: Invalid start/end lines for symbol {obj.unique_id} in file {full_file_path}. Start: {obj.start_line}, End: {obj.end_line}, Total lines: {len(lines)}")
                    return f"# Error: Could not extract source due to invalid line numbers ({obj.start_line}-{obj.end_line})."
            except Exception as e:
                print(f"Error reading file content for symbol {obj.unique_id}: {e}")
                return f"# Error reading file: {e}"
        else:
            print(f"Warning: Source file not found in cache for symbol {obj.unique_id}: {full_file_path}")
            return "# Error: Source file not found in cache."

# A serializer for a class, which will nest its methods.
class ClassSerializer(serializers.ModelSerializer):
    # This line tells DRF to find all CodeSymbols linked to this class
    # via the 'methods' related_name and serialize them.
    methods = CodeSymbolSerializer(many=True, read_only=True)
    #test
    class Meta:
        model = CodeClass
        fields = [
            'id', 'name', 'start_line', 'end_line',
            'structure_hash', 'methods','summary','generated_summary_md',
        ]

# A serializer for a file, which nests its top-level functions AND its classes.
class CodeFileSerializer(serializers.ModelSerializer):
    # This line finds all CodeSymbols linked directly to this file
    # via the 'symbols' related_name.
    symbols = CodeSymbolSerializer(many=True, read_only=True)
    
    # This line finds all CodeClasses linked to this file
    # via the 'classes' related_name.
    classes = ClassSerializer(many=True, read_only=True)

    class Meta:
        model = CodeFile
        fields = [
            'id', 'file_path', 'structure_hash',
            'symbols',  # This is the crucial key for top-level functions
            'classes','imports'
        ]

# A serializer for the full repository detail view.

class RepositoryCreateSerializer(serializers.ModelSerializer):
    """
    Serializer specifically for creating a new Repository.
    It validates the incoming data required for creation.
    """
    # This field is sent by the frontend
    organization_id = serializers.IntegerField(write_only=True)
    

    class Meta:
        model = Repository
        # These are the fields the frontend will send to create a repo
        fields = [
            'github_id',
            'full_name',
            'default_branch',
            'organization_id',
        ]
class RepositoryDetailSerializer(serializers.ModelSerializer):
    files = CodeFileSerializer(many=True, read_only=True)

    class Meta:
        model = Repository
        fields = [
            'id', 'name', 'full_name', 'github_id',
            'status', 'root_merkle_hash', 'files',
        'last_processed']
        read_only_fields = ['status', 'files', 'root_merkle_hash']


# The simple serializer for the dashboard list view (no changes needed here).
class RepositorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Repository
        fields = ['id', 'name', 'full_name', 'github_id', 'status','last_processed', 'updated_at','documentation_coverage',
            'orphan_symbol_count']
        read_only_fields = ['status', 'updated_at']


class AsyncTaskStatusSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField() # Shows user.username
    repository_full_name = serializers.CharField(source='repository.full_name', read_only=True, allow_null=True)

    class Meta:
        model = AsyncTaskStatus
        fields = [
            'task_id', 
            'user', 
            'repository', # Will be repository ID
            'repository_full_name', # Added for convenience
            'task_name', 
            'get_task_name_display', # Human-readable choice display
            'status', 
            'get_status_display',    # Human-readable choice display
            'progress', 
            'message', 
            'result_data', 
            'created_at', 
            'updated_at'
        ]
        read_only_fields = fields
        
class NotificationSerializer(serializers.ModelSerializer):
    repository_full_name = serializers.CharField(source='repository.full_name', read_only=True, allow_null=True)
    
    class Meta:
        model = Notification
        fields = [
            'id', 'user', 'repository', 'repository_full_name', 
            'notification_type', 'get_notification_type_display', 
            'message', 'is_read', 'created_at', 'link_url'
        ]
        read_only_fields = ('user', 'created_at')
    
class InsightSymbolSerializer(serializers.ModelSerializer):
    """A minimal serializer for the symbol linked in an insight."""
    class Meta:
        model = CodeSymbol
        fields = ['id', 'name', 'unique_id']

class InsightSerializer(serializers.ModelSerializer):
    related_symbol = InsightSymbolSerializer(read_only=True)

    class Meta:
        model = Insight
        fields = [
            'id',
            'commit_hash',
            'insight_type',
            'get_insight_type_display', # Use the display name for UI
            'message',
            'data',
            'related_symbol',
            'is_resolved',
            'created_at',
        ]
        

class ModuleDocumentationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModuleDocumentation
        fields = ['id', 'repository', 'module_path', 'content_md', 'last_generated_at']


class SimpleUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']

class OrganizationMemberSerializer(serializers.ModelSerializer):
    user = SimpleUserSerializer(read_only=True)
    
    class Meta:
        model = OrganizationMember
        fields = ['id', 'user', 'role']

class OrganizationSerializer(serializers.ModelSerializer):
    # We can choose to nest the members directly if we want
    memberships = OrganizationMemberSerializer(many=True, read_only=True)
    owner = SimpleUserSerializer(read_only=True)
    
    class Meta:
        model = Organization
        fields = ['id', 'name', 'owner', 'created_at', 'memberships']

# A serializer for creating an organization
class CreateOrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ['name'] # Only the name is needed for creation


from .models import Invitation

class InvitationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invitation
        fields = ['id', 'email', 'role', 'status', 'created_at']
        read_only_fields = ['id', 'status', 'created_at']

class CreateInvitationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=OrganizationMember.Role.choices, default=OrganizationMember.Role.MEMBER)

class DetailedOrganizationSerializer(serializers.ModelSerializer):
    """
    A more detailed serializer for the Workspace Settings page,
    including members and pending invitations.
    """
    memberships = OrganizationMemberSerializer(many=True, read_only=True)
    # --- NEW: Add pending invitations ---
    invitations = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = ['id', 'name', 'owner', 'created_at', 'memberships', 'invitations']

    def get_invitations(self, obj):
        # We only want to show invitations that are still pending.
        pending_invites = obj.invitations.filter(status=Invitation.InviteStatus.PENDING)
        return InvitationSerializer(pending_invites, many=True).data
    
# backend/repositories/serializers.py
class RepositorySelectorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Repository
        fields = ['id', 'full_name']
        
# backend/repositories/serializers.py

class OrphanSymbolSerializer(serializers.ModelSerializer):
    """
    A serializer specifically for displaying orphan symbols in a list.
    It includes the necessary context like file path and class name.
    """
    file_path = serializers.CharField(source='code_file.file_path', read_only=True, allow_null=True)
    class_name = serializers.CharField(source='code_class.name', read_only=True, allow_null=True)

    class Meta:
        model = CodeSymbol
        fields = [
            'id',
            'name',
            'file_path',
            'class_name',
            'start_line',
            'loc',
            'cyclomatic_complexity',
        ]

from .models import TestCoverageReport, FileCoverage

class FileCoverageSerializer(serializers.ModelSerializer):
    file_path = serializers.CharField(source='code_file.file_path', read_only=True)
    code_file_id = serializers.IntegerField(source='code_file.id', read_only=True)

    class Meta:
        model = FileCoverage
        fields = ['id', 'file_path', 'code_file_id','line_rate', 'covered_lines', 'missed_lines']

class TestCoverageReportSerializer(serializers.ModelSerializer):
    # Nest the file-specific coverage data within the main report
    file_coverages = FileCoverageSerializer(many=True, read_only=True)
    
    class Meta:
        model = TestCoverageReport
        fields = ['id', 'repository', 'commit_hash', 'uploaded_at', 'overall_coverage', 'file_coverages']

class GraphLinkSerializer(serializers.ModelSerializer):
    source = serializers.IntegerField(source='caller.id')
    target = serializers.IntegerField(source='callee.id')

    class Meta:
        model = CodeDependency
        fields = ['source', 'target']

class DashboardRepositorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Repository
        fields = [
            'id', 'full_name', 'status', 'last_processed',
            'documentation_coverage', 'orphan_symbol_count',
            # New fields
            'primary_language', 'size_kb', 'commit_count', 'contributor_count'
        ]