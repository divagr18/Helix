# backend/users/forms.py
from django import forms
from allauth.account.forms import SignupForm
from .models import BetaInviteCode

class CustomSignupForm(SignupForm):
    # We don't need to add a field here because it's not on this form.
    # We just need to override the clean method for validation.

    def clean(self):
        cleaned_data = super().clean()
        
        # Get the invite code from the session, which was set by our API view
        invite_code_str = self.request.session.get('validated_invite_code')
        
        if not invite_code_str:
            raise forms.ValidationError("No valid invite code found. Please use an invite link to sign up.")

        try:
            invite_code = BetaInviteCode.objects.get(code=invite_code_str, is_active=True)
            if invite_code.uses >= invite_code.max_uses:
                raise forms.ValidationError("This invite code has already been used.")
        except BetaInviteCode.DoesNotExist:
            raise forms.ValidationError("Invalid invite code.")

        return cleaned_data

    def save(self, request):
        # After the user is created, we increment the use count of the code
        user = super().save(request)
        
        invite_code_str = request.session.get('validated_invite_code')
        if invite_code_str:
            try:
                invite_code = BetaInviteCode.objects.get(code=invite_code_str)
                invite_code.uses += 1
                invite_code.save()
                # Clean up the session
                del request.session['validated_invite_code']
            except BetaInviteCode.DoesNotExist:
                # Should not happen if clean() passed, but good to be safe
                pass
        
        return user