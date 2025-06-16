# backend/repositories/views.py
from django.utils.decorators import method_decorator
from rest_framework import viewsets, permissions
from .models import Repository
from .serializers import RepositorySerializer,RepositoryDetailSerializer
from rest_framework.views import APIView
from django.views.decorators.csrf import csrf_exempt
from rest_framework.response import Response
from allauth.socialaccount.models import SocialToken
import requests
@method_decorator(csrf_exempt, name="dispatch")

class RepositoryViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # This logic is now correct from our last fix.
        if self.action == 'list':
            return Repository.objects.filter(user=self.request.user)
        return Repository.objects.all()

    def get_serializer_class(self):
        # If we are just listing repos, use the simple summary serializer.
        if self.action == 'list':
            return RepositorySerializer
        # For ALL other actions (retrieve, create, update), use the detailed one.
        return RepositoryDetailSerializer

    def perform_create(self, serializer):
        # This is fine, it just associates the user.
        serializer.save(user=self.request.user)

@method_decorator(csrf_exempt, name="dispatch")
class GithubReposView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        # This is the magic: find the user's GitHub token stored by allauth
        try:
            token = SocialToken.objects.get(
                account__user=request.user, 
                account__provider='github'
            )
        except SocialToken.DoesNotExist:
            return Response({"error": "GitHub token not found."}, status=400)

        # Use the token to make an authenticated request to the GitHub API
        headers = {
            "Authorization": f"token {token.token}",
            "Accept": "application/vnd.github.v3+json",
        }
        
        # Fetch repos from GitHub API
        url = "https://api.github.com/user/repos?type=owner&sort=updated"
        response = requests.get(url, headers=headers)

        if response.status_code != 200:
            return Response(
                {"error": "Failed to fetch from GitHub."}, 
                status=response.status_code
            )
        
        # We only need a few fields for the frontend
        repos_data = response.json()
        simplified_repos = [
            {
                "id": repo["id"],
                "name": repo["name"],
                "full_name": repo["full_name"],
                "private": repo["private"],
            }
            for repo in repos_data
        ]

        return Response(simplified_repos)
    
