# backend/repositories/serializers.py
from rest_framework import serializers
from .models import Repository, CodeFile, CodeClass, CodeSymbol, CodeDependency
from rest_framework import generics, permissions

# A serializer for our most granular item: a function or method.


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

    class Meta:
        model = CodeSymbol
        fields = [
            'id', 'unique_id', 'name', 'start_line', 'end_line',
            'documentation', 'content_hash', 'documentation_hash',
            'incoming_calls', 'outgoing_calls'
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

# A serializer for a class, which will nest its methods.
class ClassSerializer(serializers.ModelSerializer):
    # This line tells DRF to find all CodeSymbols linked to this class
    # via the 'methods' related_name and serialize them.
    methods = CodeSymbolSerializer(many=True, read_only=True)

    class Meta:
        model = CodeClass
        fields = [
            'id', 'name', 'start_line', 'end_line',
            'structure_hash', 'methods'
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
            'classes'
        ]

# A serializer for the full repository detail view.
class RepositoryDetailSerializer(serializers.ModelSerializer):
    files = CodeFileSerializer(many=True, read_only=True)

    class Meta:
        model = Repository
        fields = [
            'id', 'name', 'full_name', 'github_id',
            'status', 'root_merkle_hash', 'files'
        ]
        read_only_fields = ['status', 'files', 'root_merkle_hash']


# The simple serializer for the dashboard list view (no changes needed here).
class RepositorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Repository
        fields = ['id', 'name', 'full_name', 'github_id', 'status', 'updated_at']
        read_only_fields = ['status', 'updated_at']