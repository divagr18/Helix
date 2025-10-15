# backend/users/serializers.py
from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()

class UserDetailSerializer(serializers.ModelSerializer):
    """
    Serializer for user details. Makes email read-only.
    """
    has_github = serializers.SerializerMethodField()
    has_usable_password = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        # Expose fields that are safe to view and edit
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'has_github', 'has_usable_password']
        read_only_fields = ['email', 'has_github', 'has_usable_password'] # Can't change email for now
    
    def get_has_github(self, obj):
        """Check if user has a connected GitHub account"""
        from allauth.socialaccount.models import SocialAccount
        return SocialAccount.objects.filter(user=obj, provider='github').exists()
    
    def get_has_usable_password(self, obj):
        """Check if user has a local password set"""
        return obj.has_usable_password()

class SignUpSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        # These are the fields the user will submit
        fields = ('username', 'email', 'password')
        extra_kwargs = {
            'password': {'write_only': True, 'style': {'input_type': 'password'}},
            'email': {'required': False, 'allow_blank': True},
        }

    def validate_email(self, value):
        """Check that the email is not already in use (if provided)."""
        if value and User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def create(self, validated_data):
        """Create the new user as active (no email verification needed)."""
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            is_active=True  # <-- User is active immediately
        )
        return user
    
class TokenVerificationSerializer(serializers.Serializer):
    """
    A simple serializer to validate that a token is provided.
    """
    token = serializers.UUIDField()

    class Meta:
        fields = ('token',)
class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()

    class Meta:
        fields = ('email',)

class PasswordResetRequestSerializer(serializers.Serializer):
    username = serializers.CharField()

    class Meta:
        fields = ('username',)