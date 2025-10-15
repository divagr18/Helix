# Deployment Guide

## Overview

This guide covers deploying Helix in various environments, from development to production.

## Quick Start (Development)

The default `docker-compose.yml` is configured for local development:

```bash
# Copy environment variables
cp .env.example .env

# Edit .env and add your GitHub OAuth credentials
# GITHUB_OAUTH_CLIENT_ID=your_client_id
# GITHUB_OAUTH_CLIENT_SECRET=your_secret

# Start all services
docker-compose up

# Access the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
```

## Production Deployment

### Using docker-compose.prod.yml

The production compose file includes:
- Gunicorn WSGI server for Django
- Nginx reverse proxy
- Health checks for all services
- Resource limits
- Restart policies
- Network isolation

**Setup:**

```bash
# 1. Copy production compose file
cp docker-compose.prod.yml docker-compose.yml

# 2. Create production .env file
cp .env.example .env.prod

# 3. Update .env.prod with production values:
#    - Strong passwords for POSTGRES_PASSWORD and REDIS_PASSWORD
#    - Set DJANGO_DEBUG=False
#    - Set DJANGO_SECRET_KEY to a strong random value
#    - Configure DJANGO_ALLOWED_HOSTS
#    - Add your domain to FRONTEND_URL and CSRF_TRUSTED_ORIGINS

# 4. Build and start services
docker-compose --env-file .env.prod up -d --build

# 5. Check service health
docker-compose ps
docker-compose logs -f
```

### Production Checklist

**Security:**
- [ ] Change all default passwords
- [ ] Generate strong `DJANGO_SECRET_KEY`
- [ ] Set `DJANGO_DEBUG=False`
- [ ] Configure `DJANGO_ALLOWED_HOSTS` with your domain
- [ ] Set up SSL/TLS certificates
- [ ] Enable Redis password authentication
- [ ] Review and restrict exposed ports
- [ ] Set up firewall rules

**Database:**
- [ ] Configure automated backups
- [ ] Set up point-in-time recovery
- [ ] Monitor disk usage
- [ ] Consider managed database service (AWS RDS, Azure Database, etc.)

**Monitoring:**
- [ ] Set up application logging
- [ ] Configure error tracking (Sentry)
- [ ] Monitor resource usage
- [ ] Set up uptime monitoring
- [ ] Configure alerts

**Performance:**
- [ ] Adjust Gunicorn workers based on CPU cores
- [ ] Configure Redis maxmemory based on usage
- [ ] Set up CDN for static files
- [ ] Enable gzip compression in nginx
- [ ] Optimize PostgreSQL settings

**Backup Strategy:**
- [ ] Database backups (daily recommended)
- [ ] Volume backups (postgres_data, repo_cache)
- [ ] Configuration backups (.env, nginx configs)
- [ ] Test restore procedures

## Environment-Specific Configurations

### Development
```yaml
# docker-compose.yml (default)
# - Hot-reload enabled
# - Debug mode on
# - Exposed database port
# - Volume mounts for code changes
```

### Staging
```yaml
# Similar to production but:
# - May expose more ports for debugging
# - Less strict resource limits
# - Can use test credentials
```

### Production
```yaml
# docker-compose.prod.yml
# - Gunicorn instead of runserver
# - nginx for static files and reverse proxy
# - Health checks enabled
# - Resource limits configured
# - Restart policies set
```

## Cloud Platform Deployment

### AWS

**Option 1: ECS (Elastic Container Service)**
```bash
# 1. Push images to ECR
# 2. Create ECS task definitions
# 3. Configure service with load balancer
# 4. Use RDS for PostgreSQL
# 5. Use ElastiCache for Redis
```

**Option 2: EC2 with Docker Compose**
```bash
# 1. Launch EC2 instance
# 2. Install Docker and Docker Compose
# 3. Clone repository
# 4. Run docker-compose.prod.yml
# 5. Configure security groups
```

### Azure

**Azure Container Instances or App Service**
```bash
# 1. Push images to Azure Container Registry
# 2. Create Azure Database for PostgreSQL
# 3. Create Azure Cache for Redis
# 4. Deploy containers to App Service
```

### Google Cloud

**Cloud Run or GKE**
```bash
# 1. Push images to GCR
# 2. Use Cloud SQL for PostgreSQL
# 3. Use Memorystore for Redis
# 4. Deploy to Cloud Run or GKE
```

## SSL/TLS Configuration

### Using Let's Encrypt with Certbot

```bash
# 1. Install certbot
docker run -it --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  certbot/certbot certonly --standalone \
  -d yourdomain.com

# 2. Update nginx configuration
# 3. Mount certificates in docker-compose.yml
volumes:
  - /etc/letsencrypt:/etc/nginx/certs:ro

# 4. Set up auto-renewal
```

## Scaling

### Horizontal Scaling

**Backend:**
```yaml
backend:
  deploy:
    replicas: 3
  # Add load balancer
```

**Workers:**
```yaml
worker:
  deploy:
    replicas: 5  # Based on workload
```

### Vertical Scaling

Adjust resource limits in docker-compose.prod.yml:
```yaml
deploy:
  resources:
    limits:
      memory: 4G  # Increase as needed
      cpus: '2.0'
```

## Database Migrations

```bash
# Run migrations after deployment
docker-compose exec backend python manage.py migrate

# Create superuser (first deployment)
docker-compose exec backend python manage.py createsuperuser
```

## Monitoring and Logs

```bash
# View logs
docker-compose logs -f [service]

# View resource usage
docker stats

# Health check
curl http://localhost/api/health/
```

## Backup and Restore

### Database Backup
```bash
# Backup
docker-compose exec db pg_dump -U helix helix > backup.sql

# Restore
docker-compose exec -T db psql -U helix helix < backup.sql
```

### Volume Backup
```bash
# Backup volumes
docker run --rm \
  -v helix_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres_backup.tar.gz /data
```

## Troubleshooting

### Container won't start
```bash
docker-compose logs [service]
docker-compose ps
```

### Database connection issues
```bash
# Check database is running
docker-compose exec db pg_isready -U helix

# Check backend can connect
docker-compose exec backend python manage.py dbshell
```

### Performance issues
```bash
# Check resource usage
docker stats

# Increase workers/resources in docker-compose.yml
```

## Updating Helix

```bash
# 1. Pull latest changes
git pull origin main

# 2. Backup database
docker-compose exec db pg_dump -U helix helix > backup.sql

# 3. Rebuild and restart
docker-compose down
docker-compose up -d --build

# 4. Run migrations
docker-compose exec backend python manage.py migrate
```

## Support

For deployment issues:
- Check logs: `docker-compose logs`
- Review [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- Open an issue: https://github.com/divagr18/Helix/issues
