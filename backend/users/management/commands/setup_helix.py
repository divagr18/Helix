from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.contrib.auth import get_user_model
from django.db import connection
import os


class Command(BaseCommand):
    help = 'Initialize Helix application with all necessary setup'

    def add_arguments(self, parser):
        parser.add_argument(
            '--create-superuser',
            action='store_true',
            help='Create a superuser interactively',
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS('🚀 Starting Helix initialization...')
        )

        # Run migrations
        self.stdout.write('📦 Running database migrations...')
        call_command('migrate', verbosity=0)
        self.stdout.write(self.style.SUCCESS('✅ Migrations completed'))

        # Setup GitHub OAuth
        self.stdout.write('🔐 Setting up GitHub OAuth...')
        call_command('setup_github_oauth')

        # Check database connectivity
        self.stdout.write('🗄️  Checking database connectivity...')
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                self.stdout.write(self.style.SUCCESS('✅ Database connection OK'))
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Database connection failed: {e}')
            )

        # Check if readonly user exists
        self.stdout.write('👤 Checking readonly database user...')
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT 1 FROM pg_roles WHERE rolname = 'helix_readonly'"
                )
                if cursor.fetchone():
                    self.stdout.write(
                        self.style.SUCCESS('✅ Readonly user exists')
                    )
                else:
                    self.stdout.write(
                        self.style.WARNING('⚠️  Readonly user not found')
                    )
        except Exception as e:
            self.stdout.write(
                self.style.WARNING(f'⚠️  Could not check readonly user: {e}')
            )

        # Create superuser if requested
        if options['create_superuser']:
            User = get_user_model()
            if not User.objects.filter(is_superuser=True).exists():
                self.stdout.write('👑 Creating superuser...')
                call_command('createsuperuser')
            else:
                self.stdout.write(
                    self.style.WARNING('⚠️  Superuser already exists')
                )

        # Display environment info
        self.stdout.write('\n📋 Environment Configuration:')
        env_vars = [
            'GITHUB_CLIENT_ID',
            'OPENAI_API_KEY',
            'E2B_API_KEY',
            'DATABASE_URL',
            'CELERY_BROKER_URL'
        ]
        
        for var in env_vars:
            value = os.environ.get(var)
            if value:
                # Mask sensitive values
                if 'SECRET' in var or 'KEY' in var or 'PASSWORD' in var:
                    display_value = f"{value[:8]}..." if len(value) > 8 else "***"
                else:
                    display_value = value
                self.stdout.write(f"  ✅ {var}: {display_value}")
            else:
                self.stdout.write(f"  ❌ {var}: Not set")

        self.stdout.write(
            self.style.SUCCESS(
                '\n🎉 Helix initialization completed!\n'
                'You can now start using the application.'
            )
        )
