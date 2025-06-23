# backend/config/api_router.py

from rest_framework.routers import DefaultRouter
from repositories.views import RepositoryViewSet,GithubReposView,FileContentView,GenerateDocstringView, CodeSymbolDetailView
router = DefaultRouter()
from django.urls import path # Make sure path is imported
from users.views import AuthCheckView
from repositories.views import UserNotificationsView, MarkNotificationReadView
router.register(r'repositories', RepositoryViewSet, basename='repository')
from repositories.views import (
    RepositoryViewSet, 
    GithubReposView, 
    FileContentView, 
    GenerateDocstringView, 
    SaveDocstringView,
    CodeSymbolDetailView,
    GenerateArchitectureDiagramView,
    SemanticSearchView,
    CreateDocPRView,BatchGenerateDocsForFileView,
    CreateBatchDocsPRView,
    
    # --- IMPORT THE NEW VIEWS (we will create these next) ---
    BatchGenerateDocsForSelectedFilesView,
    CreateBatchPRForSelectedFilesView,
    TaskStatusView,ApproveDocstringView,ExplainCodeView, SuggestTestsView,RepositoryInsightsView,CommitHistoryView,
    ClassSummaryView,ReprocessRepositoryView, SuggestRefactorsView
)
# The variable name 'urlpatterns' is what Django expects to find.
urlpatterns = router.urls
urlpatterns += [
    path('github-repos/', GithubReposView.as_view(), name='github-repos'),
    path('files/<int:file_id>/content/', FileContentView.as_view(), name='file-content'),
    path('functions/<int:function_id>/generate-docstring/', GenerateDocstringView.as_view(), name='generate-docstring'),
    path('functions/<int:function_id>/save-docstring/', SaveDocstringView.as_view(), name='save-docstring'),
    path('symbols/<int:pk>/', CodeSymbolDetailView.as_view(), name='symbol-detail'),
    path('search/semantic/', SemanticSearchView.as_view(), name='semantic-search'),
    path('auth/check/', AuthCheckView.as_view(), name='auth-check'),
    path('symbols/<int:symbol_id>/create-pr/', CreateDocPRView.as_view(), name='symbol-create-pr'),
    path('symbols/<int:symbol_id>/generate-diagram/', GenerateArchitectureDiagramView.as_view(), name='generate-architecture-diagram'),
    path('files/<int:code_file_id>/batch-generate-docs/', BatchGenerateDocsForFileView.as_view(), name='batch-generate-docs-file'),
    path('files/<int:code_file_id>/create-batch-pr/', CreateBatchDocsPRView.as_view(), name='create-batch-pr-file'),     
    path('repositories/<int:repo_id>/batch-generate-docs-selected/', 
         BatchGenerateDocsForSelectedFilesView.as_view(), 
         name='batch-generate-docs-selected'),
    
    path('repositories/<int:repo_id>/create-batch-pr-selected/', 
         CreateBatchPRForSelectedFilesView.as_view(), 
         name='create-batch-pr-selected'),
    path('task-status/<str:task_id>/', TaskStatusView.as_view(), name='task-status'),
    path('symbols/<int:symbol_id>/approve-docstring/', ApproveDocstringView.as_view(), name='approve-docstring'),
    path('notifications/', UserNotificationsView.as_view(), name='user-notifications'),
    path('notifications/<int:notification_id>/mark-read/', MarkNotificationReadView.as_view(), name='notification-mark-read'),
    path('symbols/<int:symbol_id>/explain-code/', ExplainCodeView.as_view(), name='symbol-explain-code'), 
    path('symbols/<int:symbol_id>/suggest-tests/', SuggestTestsView.as_view(), name='symbol-suggest-tests'),
    path('classes/<int:class_id>/summarize/', ClassSummaryView.as_view(), name='class-summarize'),
    path('repositories/<int:repo_id>/reprocess/', ReprocessRepositoryView.as_view(), name='repository-reprocess'), 
    path('repositories/<int:repo_id>/insights/', RepositoryInsightsView.as_view(), name='repository-insights'),
    path('repositories/<int:repo_id>/commit-history/', CommitHistoryView.as_view(), name='repository-commit-history'),
    path('symbols/<int:symbol_id>/suggest-refactors/', SuggestRefactorsView.as_view(), name='symbol-suggest-refactors'), # 03c03c03c NEW PATH




]

