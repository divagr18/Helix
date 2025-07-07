# backend/repositories/decorators.py
from functools import wraps
from .models import Organization, Repository
from django.http import JsonResponse

def check_usage_limit(view_func):
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        # We need to get the organization from the request.
        # This assumes the org_id or repo_id is in the URL kwargs.
        repo_id = kwargs.get('repo_id')
        org_id = kwargs.get('org_id')
        
        organization = None
        if org_id:
            organization = Organization.objects.get(id=org_id)
        elif repo_id:
            organization = Repository.objects.select_related('organization').get(id=repo_id).organization

        if organization:
            # TODO: Add logic to reset `ai_requests_this_month` if a new month has started.
            
            if organization.ai_requests_this_month >= organization.ai_requests_limit:
                return JsonResponse(
                    {"error": "You have reached your monthly limit for AI requests."},
                    status=429 # "Too Many Requests" is a fitting status code
                )
            
            # Increment the count
            organization.ai_requests_this_month += 1
            organization.save(update_fields=['ai_requests_this_month'])

        return view_func(request, *args, **kwargs)
    return _wrapped_view