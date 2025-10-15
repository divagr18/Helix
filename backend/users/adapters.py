from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.exceptions import ImmediateHttpResponse
from django.shortcuts import redirect
from django.contrib import messages
from allauth.socialaccount.models import SocialAccount
from django.conf import settings


class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    """
    Custom adapter to handle GitHub account linking scenarios.
    If a GitHub account is already connected to another user, we disconnect it
    and connect it to the current user (if they're trying to connect).
    """
    
    def pre_social_login(self, request, sociallogin):
        """
        Invoked just after a user successfully authenticates via a social provider,
        but before the login is actually processed.
        """
        # If user is already logged in and trying to connect (not login)
        if request.user.is_authenticated:
            # Check if this GitHub account is already connected to a different user
            try:
                existing_account = SocialAccount.objects.get(
                    provider=sociallogin.account.provider,
                    uid=sociallogin.account.uid
                )
                
                # If it's connected to a different user, disconnect it first
                if existing_account.user != request.user:
                    old_username = existing_account.user.username
                    existing_account.delete()
                    messages.info(
                        request,
                        f"GitHub account was previously connected to user '{old_username}'. "
                        f"It has been disconnected and will now be connected to your account."
                    )
            except SocialAccount.DoesNotExist:
                # No existing account, proceed normally
                pass
    
    def get_connect_redirect_url(self, request, socialaccount):
        """
        Return the URL to redirect to after successfully connecting a social account.
        Redirect to frontend settings page.
        """
        return f"{settings.FRONTEND_URL}/settings/profile"
    
    def authentication_error(self, request, provider_id, error=None, exception=None, extra_context=None):
        """
        Handle authentication errors gracefully
        """
        messages.error(request, f"Authentication failed: {error or 'Unknown error'}")
        # Redirect back to settings page instead of showing error page
        raise ImmediateHttpResponse(redirect(f"{settings.FRONTEND_URL}/settings/profile"))
