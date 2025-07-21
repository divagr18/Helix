from django.shortcuts import render

# Create your views here.
# backend/users/views.py (or a new auth_views.py)
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import generics, permissions, status
from django.contrib.auth import authenticate, login, logout

from .models import VerificationToken
from .tasks import send_password_reset_email_task, send_verification_email_task
from .serializers import ResendVerificationSerializer, SignUpSerializer, TokenVerificationSerializer, UserDetailSerializer
from allauth.account.views import LogoutView as AllauthLogoutView

@method_decorator(csrf_exempt, name='dispatch')
class AuthCheckView(APIView):
    permission_classes = [IsAuthenticated] # This view requires authentication

    def get(self, request, *args, **kwargs):
        # If the request reaches here, the user is authenticated
        # because of IsAuthenticated permission class.
        return Response({"message": "Authenticated"}, status=status.HTTP_200_OK)
class UserMeView(APIView):
    """
    View to retrieve, update, and delete the currently authenticated user.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        print('request.user:', request.user)
        print('request.session:', request.session.items())
        if not request.user.is_authenticated:
            return Response({'detail': 'Not authenticated'}, status=403)
        serializer = UserDetailSerializer(request.user)
        return Response(serializer.data)


    def patch(self, request, *args, **kwargs):
        """Update current user's details."""
        serializer = UserDetailSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, *args, **kwargs):
        """
        Initiate account deletion.
        For safety, this should trigger an async task.
        """
        user = request.user
        
        # For now, we'll perform a direct delete.
        # In production, you'd dispatch a Celery task:
        # delete_user_account_task.delay(user.id)
        
        print(f"ACCOUNT_DELETION: Deleting user {user.username} (ID: {user.id}) and all associated data.")
        user.delete() # This will cascade and delete all their owned orgs, repos, etc.
        
        return Response(
            {"message": "Your account and all associated data have been scheduled for deletion."},
            status=status.HTTP_204_NO_CONTENT
        )
    
class LogoutView(APIView, AllauthLogoutView):
    """
    An API view that uses allauth's logout logic.
    Accepts a POST request to log out the user.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        # The AllauthLogoutView's post method handles the actual logout.
        # We are just wrapping it to ensure it works as an API endpoint.
        return super().post(request, *args, **kwargs)
    
class SignUpView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny] # Anyone can sign up
    serializer_class = SignUpSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # The serializer's .create() method is called, creating an inactive user
        user = serializer.save()
        
        # --- Post-creation logic ---
        
        # 1. Increment the invite code's usage count
        invite_code_obj = serializer.context['invite_code_obj']
        invite_code_obj.uses += 1
        invite_code_obj.save()

        # 2. Create a verification token for the new user
        token = VerificationToken.objects.create(
            user=user,
            token_type=VerificationToken.TokenType.EMAIL_VERIFICATION
        )

        # 3. Dispatch the email sending task to a Celery worker
        send_verification_email_task.delay(user.email, str(token.token))

        headers = self.get_success_headers(serializer.data)
        return Response(
            {"message": "Sign-up successful. Please check your email to verify your account."},
            status=status.HTTP_201_CREATED,
            headers=headers
        )
    
class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny] # Anyone with a valid link can verify

    def post(self, request, *args, **kwargs):
        serializer = TokenVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        token_value = serializer.validated_data['token']

        try:
            # Find the token in the database. We use select_related to efficiently
            # fetch the associated user in the same database query.
            verification_token = VerificationToken.objects.select_related('user').get(
                token=token_value,
                token_type=VerificationToken.TokenType.EMAIL_VERIFICATION
            )
        except VerificationToken.DoesNotExist:
            return Response(
                {"error": "Invalid token."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if the token is still valid (not used and not expired)
        if not verification_token.is_valid():
            return Response(
                {"error": "This verification link has expired or has already been used."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # --- Success Case ---
        # 1. Activate the user
        user = verification_token.user
        user.is_active = True
        user.save(update_fields=['is_active'])

        # 2. Mark the token as used
        verification_token.is_used = True
        verification_token.save(update_fields=['is_used'])

        print(f"USER_AUTH: User '{user.username}' successfully verified their email.")

        return Response(
            {"message": "Your email has been successfully verified. You can now log in."},
            status=status.HTTP_200_OK
        )
from django.contrib.auth import get_user_model

User = get_user_model()

class ResendVerificationView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = ResendVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        try:
            user = User.objects.get(email__iexact=email)

            # Only resend if the user is not already active
            if not user.is_active:
                # Invalidate any old, unused tokens for this user to be safe
                VerificationToken.objects.filter(
                    user=user, 
                    token_type=VerificationToken.TokenType.EMAIL_VERIFICATION,
                    is_used=False
                ).update(is_used=True) # Mark them as used to invalidate

                # Create a new token
                new_token = VerificationToken.objects.create(
                    user=user,
                    token_type=VerificationToken.TokenType.EMAIL_VERIFICATION
                )

                # Dispatch the email task again
                send_verification_email_task.delay(user.email, str(new_token.token))
        
        except User.DoesNotExist:
            # If the user doesn't exist, we don't do anything.
            # We still return a success response to prevent email enumeration attacks.
            # An attacker should not be able to figure out which emails are registered.
            pass

        return Response(
            {"message": "If an account with that email exists, a new verification link has been sent."},
            status=status.HTTP_200_OK
        )
    
class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        # We can use email or username to log in
        identifier = request.data.get('identifier') # e.g., 'john.doe' or 'john.doe@example.com'
        password = request.data.get('password')

        if not identifier or not password:
            return Response(
                {"error": "Please provide both an identifier and a password."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Determine if the identifier is an email or a username
        user_query = User.objects.filter(
            Q(username__iexact=identifier) | Q(email__iexact=identifier)
        )
        user = user_query.first()

        if user:
            # Check if the account is active *before* checking the password
            if not user.is_active:
                return Response(
                    {"error": "Your account has not been verified. Please check your email."},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Authenticate the user
            authenticated_user = authenticate(request, username=user.username, password=password)
            
            if authenticated_user is not None:
                # If authentication is successful, log the user in to create a session
                login(request, authenticated_user)
                print(f"USER_AUTH: User '{authenticated_user.username}' logged in successfully.")
                # We can return some user data to the frontend
                return Response({
                    "message": "Login successful.",
                    "user": { "id": user.id, "username": user.username, "email": user.email }
                }, status=status.HTTP_200_OK)

        # If user is not found or password is incorrect, return a generic error
        return Response(
            {"error": "Invalid credentials. Please try again."},
            status=status.HTTP_401_UNAUTHORIZED
        )

class LogoutView(APIView):
    # User must be authenticated to log out
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        print(f"USER_AUTH: User '{request.user.username}' logging out.")
        logout(request)
        return Response({"message": "Successfully logged out."}, status=status.HTTP_200_OK)
    
class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = ResendVerificationSerializer(data=request.data) # We can reuse this serializer
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        try:
            user = User.objects.get(email__iexact=email)
            
            # Invalidate old password reset tokens
            VerificationToken.objects.filter(
                user=user,
                token_type=VerificationToken.TokenType.PASSWORD_RESET,
                is_used=False
            ).update(is_used=True)

            # Create a new password reset token
            token = VerificationToken.objects.create(
                user=user,
                token_type=VerificationToken.TokenType.PASSWORD_RESET
            )
            
            # Dispatch a task to send the password reset email
            # We'll need to create this new task
            send_password_reset_email_task.delay(user.email, str(token.token))

        except User.DoesNotExist:
            pass # Fail silently to prevent email enumeration

        return Response(
            {"message": "If an account with that email exists, a password reset link has been sent."},
            status=status.HTTP_200_OK
        )
    
from rest_framework import serializers
class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.UUIDField()
    new_password = serializers.CharField(write_only=True, style={'input_type': 'password'})

class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        token_value = serializer.validated_data['token']
        new_password = serializer.validated_data['new_password']

        try:
            token = VerificationToken.objects.select_related('user').get(
                token=token_value,
                token_type=VerificationToken.TokenType.PASSWORD_RESET
            )
        except VerificationToken.DoesNotExist:
            return Response({"error": "Invalid token."}, status=status.HTTP_400_BAD_REQUEST)

        if not token.is_valid():
            return Response({"error": "This password reset link has expired or has already been used."}, status=status.HTTP_400_BAD_REQUEST)

        # Set the new password
        user = token.user
        user.set_password(new_password)
        user.save()

        # Invalidate the token
        token.is_used = True
        token.save()

        return Response({"message": "Your password has been reset successfully. You can now log in."}, status=status.HTTP_200_OK)