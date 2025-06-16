# backend/repositories/admin.py

from django.contrib import admin
from .models import Repository

@admin.register(Repository)
class RepositoryAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'user', 'status', 'updated_at')
    list_filter = ('status', 'user')
from .models import CodeFile, CodeFunction

admin.site.register(CodeFile)
admin.site.register(CodeFunction)