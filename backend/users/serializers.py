# backend/users/serializers.py
from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()

class UserDetailSerializer(serializers.ModelSerializer):
    """
    Serializer for user details. Makes email read-only.
    """
    class Meta:
        model = User
        # Expose fields that are safe to view and edit
        fields = ['id', 'username', 'email', 'first_name', 'last_name']
        read_only_fields = ['email'] # Can't change email for now