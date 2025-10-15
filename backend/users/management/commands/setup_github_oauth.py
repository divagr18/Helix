from django.core.management.base import BaseCommand
from django.contrib.sites.models import Site
from allauth.socialaccount.models import SocialApp
from django.conf import settings
import os


class Command(BaseCommand):
    help = 'Setup GitHub OAuth application automatically'

    def handle(self, *args, **options):
        # Get GitHub credentials from environment
        github_client_id = os.environ.get('GITHUB_CLIENT_ID')
        github_client_secret = os.environ.get('GITHUB_CLIENT_SECRET')
        
        if not github_client_id or not github_client_secret:
            self.stdout.write(
                self.style.WARNING(
                    'GitHub OAuth credentials not found in environment variables. '
                    'Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.'
                )
            )
            return

        # Get or create the default site
        try:
            site = Site.objects.get(pk=1)
            site.domain = 'localhost:8000'
            site.name = 'Helix Local'
            site.save()
            self.stdout.write(f"Updated site: {site.domain}")
        except Site.DoesNotExist:
            site = Site.objects.create(
                id=1,
                domain='localhost:8000',
                name='Helix Local'
            )
            self.stdout.write(f"Created site: {site.domain}")

        # Create or update GitHub social app
        github_app, created = SocialApp.objects.get_or_create(
            provider='github',
            defaults={
                'name': 'GitHub',
                'client_id': github_client_id,
                'secret': github_client_secret,
            }
        )

        if not created:
            # Update existing app with new credentials
            github_app.client_id = github_client_id
            github_app.secret = github_client_secret
            github_app.save()
            self.stdout.write(
                self.style.SUCCESS('Updated existing GitHub OAuth app')
            )
        else:
            self.stdout.write(
                self.style.SUCCESS('Created new GitHub OAuth app')
            )

        # Associate the app with the site
        if site not in github_app.sites.all():
            github_app.sites.add(site)
            self.stdout.write(f"Associated GitHub app with site: {site.domain}")

        self.stdout.write(
            self.style.SUCCESS(
                f'GitHub OAuth setup complete!\n'
                f'Client ID: {github_client_id}\n'
                f'Site: {site.domain}\n'
                f'Make sure your GitHub OAuth App is configured with:\n'
                f'  - Homepage URL: http://{site.domain}\n'
                f'  - Authorization callback URL: http://{site.domain}/accounts/github/login/callback/'
            )
        )
