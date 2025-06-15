# backend/repositories/views.py
from django.utils.decorators import method_decorator
from rest_framework import viewsets, permissions
from .models import Repository
from .serializers import RepositorySerializer
from rest_framework.views import APIView
from django.views.decorators.csrf import csrf_exempt
from rest_framework.response import Response
from allauth.socialaccount.models import SocialToken
import requests
@method_decorator(csrf_exempt, name="dispatch")

class RepositoryViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows a user's repositories to be viewed or created.
    """
    serializer_class = RepositorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        This view should return a list of all the repositories
        for the currently authenticated user.
        """
        return Repository.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        """
        When a new repository is created, automatically associate it
        with the currently authenticated user.
        """
        # We will add more logic here later to fetch from GitHub API
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
    
