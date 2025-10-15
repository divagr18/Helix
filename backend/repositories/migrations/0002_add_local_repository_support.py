# Generated manually to add local repository support

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('repositories', '0001_initial'),  # Adjust this to match your latest migration
    ]

    operations = [
        migrations.AddField(
            model_name='repository',
            name='repository_type',
            field=models.CharField(
                choices=[('GITHUB', 'GitHub Repository'), ('LOCAL', 'Local Upload')],
                default='GITHUB',
                help_text='Whether this is a GitHub repo or local upload',
                max_length=10
            ),
        ),
        migrations.AlterField(
            model_name='repository',
            name='github_id',
            field=models.IntegerField(blank=True, null=True, unique=True),
        ),
    ]
