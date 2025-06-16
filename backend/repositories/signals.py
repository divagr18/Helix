# backend/repositories/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Repository
from .tasks import process_repository

@receiver(post_save, sender=Repository)
def repository_post_save(sender, instance, created, **kwargs):
    """
    When a Repository is saved, if it's a new one,
    kick off the background processing task.
    """
    if created:
        print(f"New repository created: {instance.full_name}. Kicking off processing task.")
        # .delay() is the Celery way to run a task in the background
        process_repository.delay(instance.id)