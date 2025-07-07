# backend/repositories/permissions.py
from rest_framework import permissions
from .models import Organization, OrganizationMember, Repository

class IsMemberOfOrganization(permissions.BasePermission):
    """
    Custom permission to only allow members of an organization to access
    organization-owned objects (like Repositories).
    """

    def has_permission(self, request, view):
        # This method is for view-level permissions (e.g., on a list view).
        # We will primarily use has_object_permission for detail views.
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        """
        This method is for object-level permissions.
        It's called for detail views (GET, PATCH, DELETE on /.../<id>/).
        """
        # `obj` is the instance being accessed (e.g., a Repository instance).
        
        organization = None
        
        # Determine the organization from the object being accessed.
        if isinstance(obj, Repository):
            organization = obj.organization
        elif hasattr(obj, 'repository'): # For models like CodeFile, CodeSymbol, etc.
            organization = obj.repository.organization
        # Add more elifs here for other models like Organization itself.
        elif isinstance(obj, Organization):
            organization = obj

        if not organization:
            # If we can't determine the organization, deny permission for safety.
            return False

        # The core logic: Check if a membership exists for the current user
        # in the determined organization.
        return OrganizationMember.objects.filter(
            organization=organization,
            user=request.user
        ).exists()