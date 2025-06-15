from . import api_router # Import our new router
from django.contrib import admin
from django.urls import path,include
from allauth.socialaccount.providers.github.provider import GitHubProvider # <--- ADD THIS IMPORT


urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/', include('allauth.urls')),
    path('api/v1/', include(api_router)), 
]