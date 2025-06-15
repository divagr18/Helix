# backend/config/api_router.py

from rest_framework.routers import DefaultRouter
from repositories.views import RepositoryViewSet,GithubReposView
router = DefaultRouter()
from django.urls import path # Make sure path is imported

router.register(r'repositories', RepositoryViewSet, basename='repository')

# The variable name 'urlpatterns' is what Django expects to find.
urlpatterns = router.urls
urlpatterns += [
    path('github-repos/', GithubReposView.as_view(), name='github-repos'),

]