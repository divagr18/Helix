# backend/config/celery.py
import os
from celery import Celery
from celery.schedules import crontab

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('config')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix.
app.config_from_object('django.conf:settings', namespace='CELERY')
app.conf.beat_schedule = {
    'poll-openai-batch-jobs-every-5-minutes': {
        'task': 'repositories.tasks.poll_and_process_completed_batches_task',
        'schedule': crontab(minute='*/1'),  # Run every 5 minutes
        'args': (), # No arguments needed for this task
    },
    # You can add other scheduled tasks here in the future
}

app.conf.timezone = 'UTC'
# --- THIS IS THE CRUCIAL LINE WE MISSED ---
# Load task modules from all registered Django apps.
app.autodiscover_tasks()
# -----------------------------------------

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')