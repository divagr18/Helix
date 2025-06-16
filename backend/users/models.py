from django.contrib.auth.models import AbstractUser
from django.db import models

class CustomUser(AbstractUser):
    github_id = models.IntegerField(unique=True, null=True, blank=True)
    class Meta:
        # This line tells Django what to name the table in the database.
        db_table = 'users' 
    def __str__(self):
        return self.username