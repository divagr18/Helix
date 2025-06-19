# backend/repositories/admin.py

from django.contrib import admin
from .models import Repository, AsyncTaskStatus

@admin.register(Repository)
class RepositoryAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'user', 'status', 'updated_at')
    list_filter = ('status', 'user')
from .models import CodeFile, CodeSymbol,CodeClass,CodeDependency

admin.site.register(CodeFile)
admin.site.register(CodeClass) # Register the new Class model
admin.site.register(CodeSymbol)
admin.site.register(CodeDependency)

@admin.register(AsyncTaskStatus) # Use decorator for more options later if needed
class AsyncTaskStatusAdmin(admin.ModelAdmin):
    list_display = ('task_id', 'user', 'repository', 'task_name', 'status', 'progress', 'updated_at')
    list_filter = ('status', 'task_name', 'user', 'repository')
    search_fields = ('task_id', 'user__username', 'repository__full_name', 'message')
    readonly_fields = ('created_at', 'updated_at', 'task_id')