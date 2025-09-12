# backend/users/forms.py
from django import forms
from allauth.account.forms import SignupForm

class CustomSignupForm(SignupForm):
    """
    Custom signup form that allows anyone to sign up without beta invite codes.
    """
    
    def save(self, request):
        # Standard user creation without invite code validation
        user = super().save(request)
        return user