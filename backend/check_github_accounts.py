from allauth.socialaccount.models import SocialAccount

accounts = SocialAccount.objects.filter(provider='github')
print(f'Total GitHub accounts: {accounts.count()}')
for acc in accounts:
    print(f'User: {acc.user.username} ({acc.user.id}) - GitHub UID: {acc.uid} - Extra data: {acc.extra_data.get("login", "N/A")}')
