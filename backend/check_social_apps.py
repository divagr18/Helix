from allauth.socialaccount.models import SocialApp

apps = SocialApp.objects.all()
print(f'Total social apps: {apps.count()}')
for app in apps:
    sites = list(app.sites.values_list('domain', flat=True))
    print(f'App: {app.provider} - {app.name}')
    print(f'  Client ID: {app.client_id[:10]}...')
    print(f'  Sites: {sites}')
