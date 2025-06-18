# backend/users/urls.py
from django.urls import path
from .views import AuthCheckView

urlpatterns = [
    path('auth/check/', AuthCheckView.as_view(), name='auth-check'),
]