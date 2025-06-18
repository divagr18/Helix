from django.shortcuts import render

# Create your views here.
# backend/users/views.py (or a new auth_views.py)
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

@method_decorator(csrf_exempt, name='dispatch')
class AuthCheckView(APIView):
    permission_classes = [IsAuthenticated] # This view requires authentication

    def get(self, request, *args, **kwargs):
        # If the request reaches here, the user is authenticated
        # because of IsAuthenticated permission class.
        return Response({"message": "Authenticated"}, status=status.HTTP_200_OK)