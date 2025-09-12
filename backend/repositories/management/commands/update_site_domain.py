# Update site domain for localhost development
from django.core.management.base import BaseCommand
from django.contrib.sites.models import Site

class Command(BaseCommand):
    help = 'Update site domain for localhost development'

    def handle(self, *args, **options):
        try:
            site = Site.objects.get(id=1)
            old_domain = site.domain
            site.domain = 'localhost:8000'
            site.name = 'Helix Local'
            site.save()
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully updated site domain from "{old_domain}" to "{site.domain}"'
                )
            )
        except Site.DoesNotExist:
            Site.objects.create(id=1, domain='localhost:8000', name='Helix Local')
            self.stdout.write(
                self.style.SUCCESS('Created new site with domain "localhost:8000"')
            )
