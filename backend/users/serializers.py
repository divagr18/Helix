# backend/users/serializers.py
from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import BetaInviteCode

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

class SignUpSerializer(serializers.ModelSerializer):
    # We add the invite_code field, which is not part of the User model
    # `write_only=True` means it's used for input but not shown in output
    invite_code = serializers.UUIDField(write_only=True)

    class Meta:
        model = User
        # These are the fields the user will submit
        fields = ('username', 'email', 'password', 'invite_code')
        extra_kwargs = {
            'password': {'write_only': True, 'style': {'input_type': 'password'}},
            'email': {'required': True},
        }

    def validate_email(self, value):
        """Check that the email is not already in use."""
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_invite_code(self, value):
        """Check if the provided invite code is valid and can be used."""
        try:
            invite = BetaInviteCode.objects.get(code=value)
            if not invite.is_valid():
                raise serializers.ValidationError("This invite code is invalid or has expired.")
        except BetaInviteCode.DoesNotExist:
            raise serializers.ValidationError("Invalid invite code.")
        
        # We can pass the invite object to the create method via the validated_data
        self.context['invite_code_obj'] = invite
        return value

    def create(self, validated_data):
        """Create the new user, but set them as inactive."""
        # Remove our custom field before creating the user
        validated_data.pop('invite_code')
        
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            is_active=False  # <-- User is inactive until email is verified
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