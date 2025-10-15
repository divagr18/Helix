from django.shortcuts import redirect
from django.contrib import messages
from django.views import View


class SocialAccountConnectedView(View):
    """
    Custom view to handle successful social account connections.
    Redirects users back to the frontend settings page with a success message.
    """
    
    def get(self, request, *args, **kwargs):
        # Add success message
        messages.success(request, "GitHub account successfully connected!")
        
        # Redirect to frontend settings page
        return redirect('/settings/profile')
