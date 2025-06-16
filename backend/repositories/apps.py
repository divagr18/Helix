# backend/repositories/apps.py
from django.apps import AppConfig

class RepositoriesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'repositories'

    def ready(self):
        # This line imports the signals module when the app is ready,
        # connecting our signal handlers.
        import repositories.signals