# backend/users/apps.py
from django.apps import AppConfig

class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'users'

    def ready(self):
        """
        This method is called when the app is ready.
        We import our signals here to ensure they are registered.
        """
        try:
            import users.signals
        except ImportError:
            pass