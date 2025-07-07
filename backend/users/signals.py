# backend/users/signals.py
from django.dispatch import receiver
from django.db import transaction
from allauth.account.signals import user_signed_up
from .models import BetaInviteCode
from repositories.models import Organization, OrganizationMember

@receiver(user_signed_up)
def handle_new_user_signup(request, user, **kwargs):
    """
    This single handler runs after a new user signs up via any method (social or local).
    It performs two critical actions:
    1. Creates the user's default personal workspace.
    2. Finds and "burns" the invite code used for sign-up.
    """
    print(f"SIGNAL: user_signed_up received for new user '{user.username}'")

    # --- Action 1: Create the default workspace ---
    # This logic is guaranteed to run for every new user.
    try:
        org_name = f"{user.username}'s Workspace"
        # Use get_or_create to be safe in case of race conditions or retries.
        new_org, org_created = Organization.objects.get_or_create(
            owner=user,
            defaults={'name': org_name}
        )
        if org_created:
            OrganizationMember.objects.create(
                organization=new_org,
                user=user,
                role=OrganizationMember.Role.OWNER
            )
            print(f"SIGNAL: Created default workspace '{org_name}' for user '{user.username}'.")
    except Exception as e:
        # Log error if workspace creation fails, but don't stop the process.
        print(f"SIGNAL: ERROR - Failed to create default workspace for {user.username}: {e}")

    # --- Action 2: Find and burn the invite code from the session ---
    # The `request` object is available in the user_signed_up signal.
    code_str = request.session.pop('validated_invite_code', None)
    
    if not code_str:
        print(f"SIGNAL: No 'validated_invite_code' found in session for user '{user.username}'. This might be an admin-created user.")
        return

    print(f"SIGNAL: Found invite code '{code_str}' in session. Attempting to burn it.")
    try:
        # Use a transaction to ensure the update is atomic.
        with transaction.atomic():
            # Find the specific code to update.
            invite = BetaInviteCode.objects.select_for_update().get(code=code_str)
            
            if invite.is_active and invite.uses < invite.max_uses:
                invite.uses += 1
                invite.save(update_fields=['uses'])
                print(f"SIGNAL: Successfully burned invite code '{code_str}'. New use count: {invite.uses}/{invite.max_uses}.")
            else:
                # This case shouldn't happen if the CustomSignupForm validation is working, but it's a good safeguard.
                print(f"SIGNAL: WARNING - Invite code '{code_str}' was found in session but is already inactive or fully used.")

    except BetaInviteCode.DoesNotExist:
        # This is a serious issue if a code was in the session but not the DB.
        print(f"SIGNAL: ERROR - Invite code '{code_str}' from session was not found in the database.")
    except Exception as e:
        print(f"SIGNAL: ERROR - An unexpected error occurred while burning invite code '{code_str}': {e}")