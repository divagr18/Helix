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