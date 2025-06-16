# backend/repositories/serializers.py
from rest_framework import serializers
from .models import Repository, CodeFile, CodeClass, CodeSymbol

# A serializer for our most granular item: a function or method.
class CodeSymbolSerializer(serializers.ModelSerializer):
    class Meta:
        model = CodeSymbol
        fields = [
            'id', 'name', 'start_line', 'end_line',
            'documentation', 'content_hash', 'documentation_hash'
        ]

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