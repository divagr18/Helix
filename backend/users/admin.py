from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, BetaInviteCode

class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'github_id', 'is_staff')
@admin.register(BetaInviteCode)
class BetaInviteCodeAdmin(admin.ModelAdmin):
    list_display = ('code', 'is_active', 'uses', 'max_uses', 'created_at', 'created_by')
    list_filter = ('is_active',)
    search_fields = ('code', 'created_by__username')
    # Make most fields read-only in the detail view to prevent accidental changes
    readonly_fields = ('code', 'uses', 'created_at')

    def save_model(self, request, obj, form, change):
        # Automatically set the 'created_by' to the current admin user
        if not obj.pk: # Only on creation
            obj.created_by = request.user
        super().save_model(request, obj, form, change)



admin.site.register(CustomUser, CustomUserAdmin)
