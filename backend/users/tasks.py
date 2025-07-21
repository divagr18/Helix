# users/tasks.py
from celery import shared_task
from django.conf import settings
# We will implement the boto3 logic later
# import boto3

@shared_task
def send_verification_email_task(user_email: str, token: str):
    """
    Sends the email verification link to the user.
    """
    verification_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    
    # --- AWS SES LOGIC WILL GO HERE ---
    # For now, we'll just print it to the console for debugging.
    print("--- SENDING VERIFICATION EMAIL ---")
    print(f"To: {user_email}")
    print(f"URL: {verification_url}")
    print("---------------------------------")
    # In a real implementation, you would use boto3 to send an email
    # with a nice HTML template containing the verification_url.
    
    return f"Verification email task dispatched for {user_email}"