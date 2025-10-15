from datetime import timedelta
import uuid
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
class CustomUser(AbstractUser):
    github_id = models.IntegerField(unique=True, null=True, blank=True)
    class Meta:
        # This line tells Django what to name the table in the database.
        db_table = 'users' 
    def __str__(self):
        return self.username
    

class BetaInviteCode(models.Model):
    """
    A model to manage invite codes for a closed beta.
    This allows controlling who can sign up for the application.
    """
    code = models.UUIDField(
        default=uuid.uuid4, 
        editable=False, 
        unique=True,
        help_text="The unique, unguessable code for the invitation."
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this code can still be used. Deactivate to disable it."
    )
    uses = models.PositiveIntegerField(
        default=0,
        help_text="The number of times this code has been used."
    )
    max_uses = models.PositiveIntegerField(
        default=1,
        help_text="The maximum number of times this code can be used."
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, # Allow for codes created by the system/superusers
        help_text="Admin or system user who created the code."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(
        null=True, 
        blank=True,
        help_text="Optional date when this invite code will expire."
    )

    class Meta:
        db_table = 'beta_invite_codes'
        verbose_name = "Beta Invite Code"
        verbose_name_plural = "Beta Invite Codes"

    def __str__(self):
        return str(self.code)

    def is_valid(self) -> bool:
        """
        Checks if the invite code can still be used.
        """
        if not self.is_active:
            return False
        if self.uses >= self.max_uses:
            return False
        if self.expires_at and self.expires_at < timezone.now(): # Requires `from django.utils import timezone`
            return False
        return True

class VerificationToken(models.Model):
    """
    Stores a single-use, expiring token for actions like email verification
    and password resets.
    """
    class TokenType(models.TextChoices):
        EMAIL_VERIFICATION = 'EMAIL_VERIFICATION', 'Email Verification'
        PASSWORD_RESET = 'PASSWORD_RESET', 'Password Reset'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="verification_tokens"
    )
    token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    token_type = models.CharField(max_length=30, choices=TokenType.choices)
    
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    class Meta:
        db_table = 'user_verification_tokens'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        # Automatically set the expiration date on creation
        if not self.pk: # If the object is new
            self.expires_at = timezone.now() + timedelta(hours=1)
        super().save(*args, **kwargs)

    def is_valid(self) -> bool:
        """Checks if the token is still valid (not used and not expired)."""
        return not self.is_used and self.expires_at > timezone.now()

    def __str__(self):
        return f"{self.get_token_type_display()} token for {self.user.username}"