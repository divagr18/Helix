"""
Chat views for Q&A about repositories using vector search and AI.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.http import StreamingHttpResponse
from ..models import Repository
from ..ai_services import handle_chat_query_stream
from ..permissions import IsMemberOfOrganization


class RepositoryChatView(APIView):
    """
    Endpoint for chatting with the AI about a repository.
    Uses vector search on embeddings to answer questions.
    
    POST /api/v1/repositories/<id>/chat/
    Body: {
        "question": "How does authentication work?",
        "file_path": "optional/specific/file.py"  # Optional: focus on specific file
    }
    """
    permission_classes = [permissions.IsAuthenticated, IsMemberOfOrganization]
    
    def post(self, request, pk):
        try:
            # Verify repository access
            repository = Repository.objects.get(pk=pk)
            
            # Check if user has access via organization membership
            from ..models import OrganizationMember
            has_access = OrganizationMember.objects.filter(
                user=request.user,
                organization=repository.organization
            ).exists()
            
            if not has_access:
                return Response(
                    {"error": "You don't have access to this repository"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get question from request
            question = request.data.get('question', '').strip()
            file_path = request.data.get('file_path')  # Optional file context
            
            if not question:
                return Response(
                    {"error": "Question is required"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if repository has been analyzed (has embeddings)
            from ..models import KnowledgeChunk
            has_embeddings = KnowledgeChunk.objects.filter(repository=repository).exists()
            
            if not has_embeddings:
                return Response(
                    {"error": "Repository analysis not complete. Please wait for processing to finish."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Stream the AI response
            def stream_response():
                try:
                    for chunk in handle_chat_query_stream(
                        user_id=request.user.id,
                        repo_id=repository.id,
                        query=question,
                        file_path=file_path
                    ):
                        yield chunk
                except Exception as e:
                    yield f"\n\nError: {str(e)}"
            
            response = StreamingHttpResponse(
                stream_response(),
                content_type='text/event-stream'
            )
            response['Cache-Control'] = 'no-cache'
            response['X-Accel-Buffering'] = 'no'
            return response
            
        except Repository.DoesNotExist:
            return Response(
                {"error": "Repository not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": f"Chat failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RepositoryChatHistoryView(APIView):
    """
    Endpoint to get chat history for a repository (future feature).
    
    GET /api/v1/repositories/<id>/chat/history/
    """
    permission_classes = [permissions.IsAuthenticated, IsMemberOfOrganization]
    
    def get(self, request, pk):
        # TODO: Implement chat history storage and retrieval
        return Response(
            {"message": "Chat history not yet implemented"},
            status=status.HTTP_501_NOT_IMPLEMENTED
        )
