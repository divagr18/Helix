# backend/config/api_router.py

from rest_framework.routers import DefaultRouter
from repositories.views import RepositoryViewSet,GithubReposView,FileContentView,GenerateDocstringView, CodeSymbolDetailView
router = DefaultRouter()
from django.urls import path # Make sure path is imported

router.register(r'repositories', RepositoryViewSet, basename='repository')
from repositories.views import SaveDocstringView # Import the new view

# The variable name 'urlpatterns' is what Django expects to find.
urlpatterns = router.urls
urlpatterns += [
    path('github-repos/', GithubReposView.as_view(), name='github-repos'),
    path('files/<int:file_id>/content/', FileContentView.as_view(), name='file-content'),
    path('functions/<int:function_id>/generate-docstring/', GenerateDocstringView.as_view(), name='generate-docstring'),
    path('functions/<int:function_id>/save-docstring/', SaveDocstringView.as_view(), name='save-docstring'),
    path('symbols/<int:pk>/', CodeSymbolDetailView.as_view(), name='symbol-detail'),



]