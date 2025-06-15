from rest_framework import serializers
from .models import Repository

class RepositorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Repository
        # These are the fields that will be converted to JSON
        fields = ['id', 'name', 'full_name', 'status', 'updated_at']