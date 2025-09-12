# backend/users/signals.py
from django.dispatch import receiver
from django.db import transaction
from allauth.account.signals import user_signed_up
from repositories.models import Organization, OrganizationMember

@receiver(user_signed_up)
def handle_new_user_signup(request, user, **kwargs):
    """
    This single handler runs after a new user signs up via any method (social or local).
    It creates the user's default personal workspace.
    """
    print(f"SIGNAL: user_signed_up received for new user '{user.username}'")

    # Create the default workspace
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
        else:
            print(f"SIGNAL: Default workspace '{org_name}' already exists for user '{user.username}'.")

    except Exception as e:
        # Log error if workspace creation fails, but don't stop the process.
        print(f"SIGNAL: ERROR - Failed to create default workspace for {user.username}: {e}")

