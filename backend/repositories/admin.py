# backend/repositories/admin.py

from django.contrib import admin
from .models import Repository, AsyncTaskStatus

@admin.register(Repository)
class RepositoryAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'user', 'status', 'updated_at')
    list_filter = ('status', 'user')
from .models import CodeFile, CodeSymbol,CodeClass,CodeDependency,Notification,EmbeddingBatchJob 

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

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'repository', 'notification_type', 'message_summary', 'is_read', 'created_at')
    list_filter = ('is_read', 'notification_type', 'user', 'repository')
    search_fields = ('user__username', 'repository__full_name', 'message')
    readonly_fields = ('created_at',)
    actions = ['mark_as_read', 'mark_as_unread']

    def message_summary(self, obj):
        return obj.message[:75] + '...' if len(obj.message) > 75 else obj.message
    message_summary.short_description = 'Message'

    def mark_as_read(self, request, queryset):
        queryset.update(is_read=True)
    mark_as_read.short_description = "Mark selected notifications as read"

    def mark_as_unread(self, request, queryset):
        queryset.update(is_read=False)
    mark_as_unread.short_description = "Mark selected notifications as unread"

@admin.register(EmbeddingBatchJob)
class EmbeddingBatchJobAdmin(admin.ModelAdmin):
    list_display = (
        'id', 
        'repository', 
        'batch_id', 
        'status', 
        'input_file_id', 
        'output_file_id', 
        'created_at', 
        'updated_at',
        'openai_completed_at',
        'results_processed_at'
    )
    list_filter = ('status', 'repository', 'created_at')
    search_fields = ('batch_id', 'repository__full_name')
    readonly_fields = (
        'created_at', 
        'updated_at', 
        'submitted_to_openai_at', 
        'openai_completed_at', 
        'results_processed_at',
        'openai_metadata' # Often better as readonly in admin
    )
    fieldsets = (
        (None, {
            'fields': ('repository', 'status', 'batch_id', 'input_file_id', 'output_file_id', 'error_file_id')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'submitted_to_openai_at', 'openai_completed_at', 'results_processed_at'),
            'classes': ('collapse',) # Make this section collapsible
        }),
        ('Details', {
            'fields': ('openai_metadata', 'custom_metadata', 'error_details'),
            'classes': ('collapse',)
        }),
    )