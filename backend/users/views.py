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

from backend.users.models import VerificationToken
from backend.users.tasks import send_verification_email_task
from .serializers import SignUpSerializer, UserDetailSerializer
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
    

    