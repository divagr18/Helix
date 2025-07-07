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
from rest_framework import permissions, status
from .serializers import UserDetailSerializer
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
    

    