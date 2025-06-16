# backend/repositories/serializers.py
from rest_framework import serializers
from .models import Repository, CodeFile, CodeFunction
class CodeFunctionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CodeFunction
        fields = ['id', 'name', 'start_line', 'end_line', 'documentation']

# This serializer will represent a single file and will nest its functions
class CodeFileSerializer(serializers.ModelSerializer):
    # This line tells DRF to use the CodeFunctionSerializer for the 'functions' field
    functions = CodeFunctionSerializer(many=True, read_only=True)

    class Meta:
        model = CodeFile
        fields = ['id', 'file_path', 'functions']
class RepositorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Repository
        # Add 'github_id' to the list of fields the serializer should process
        fields = ['id', 'name', 'full_name', 'github_id', 'status', 'updated_at']
        # We can also make some fields read-only so they can't be set by the client
        read_only_fields = ['status', 'updated_at']
class RepositoryDetailSerializer(serializers.ModelSerializer):
    # This line tells DRF to use the CodeFileSerializer for the 'files' field
    files = CodeFileSerializer(many=True, read_only=True)

    class Meta:
        model = Repository
        fields = ['id', 'name', 'full_name', 'github_id', 'status', 'files']