# Docker Setup Guide

This guide explains how to run Lumigift using Docker and Docker Compose.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac)
- OR Docker Engine + Docker Compose (Linux)
- At least 4GB of available RAM
- At least 10GB of available disk space

## Quick Start

### 1. Clone and Configure

```bash
git clone https://github.com/JosephOnuh/Lumigift-lumigift.git
cd lumigift

# Copy environment template
cp .env.local.example .env.local

# Edit .env.local with your actual values
# At minimum, set NEXTAUTH_SECRET:
# openssl rand -base64 32
```

### 2. Start Services

```bash
# Production mode (optimized build)
docker-compose up

# OR Development mode (hot reload)
docker-compose -f docker-compose.dev.yml up
```

### 3. Access the Application

- **App**: http://localhost:3000
- **PostgreSQL**: localhost:5432
  - User: `lumigift`
  - Password: `lumigift_dev_password`
  - Database: `lumigift`
- **Redis**: localhost:6379

## Architecture

The Docker setup includes three services:

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Network                       │
│                                                         │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐    │
│  │   App    │─────▶│ Postgres │      │  Redis   │    │
│  │ (Next.js)│      │   :5432  │      │  :6379   │    │
│  │  :3000   │─────▶└──────────┘      └──────────┘    │
│  └──────────┘                                          │
│       │                                                │
└───────┼────────────────────────────────────────────────┘
        │
        ▼
   localhost:3000
```

## Docker Files

### Dockerfile (Production)

Multi-stage build optimized for production:

1. **deps** - Install production dependencies
2. **builder** - Build the Next.js application
3. **runner** - Minimal runtime image with non-root user

**Features:**
- Multi-stage build reduces final image size
- Non-root user for security
- Health checks included
- Standalone output for optimal performance

### Dockerfile.dev (Development)

Single-stage build for development:

- Hot reload support via volume mounts
- Full development dependencies
- Faster startup (no build step)

### docker-compose.yml (Production)

Production-ready configuration:

- Optimized Next.js build
- Persistent volumes for data
- Health checks for all services
- Automatic service dependencies
- Environment variable support

### docker-compose.dev.yml (Development)

Development configuration:

- Source code mounted as volumes
- Hot reload enabled
- Same database/redis setup as production
- Faster iteration cycle

## Common Commands

### Starting Services

```bash
# Start all services (foreground)
docker-compose up

# Start in background (detached)
docker-compose up -d

# Start specific service
docker-compose up postgres redis

# Development mode
docker-compose -f docker-compose.dev.yml up
```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app

# Last 100 lines
docker-compose logs --tail=100 app
```

### Stopping Services

```bash
# Stop all services (keeps data)
docker-compose down

# Stop and remove volumes (deletes data)
docker-compose down -v

# Stop specific service
docker-compose stop app
```

### Rebuilding

```bash
# Rebuild all services
docker-compose build

# Rebuild and start
docker-compose up --build

# Rebuild specific service
docker-compose build app
```

### Database Operations

```bash
# Access PostgreSQL shell
docker-compose exec postgres psql -U lumigift -d lumigift

# Run migrations manually
docker-compose exec postgres psql -U lumigift -d lumigift -f /docker-entrypoint-initdb.d/0001_add_stellar_tx_hash.sql

# Backup database
docker-compose exec postgres pg_dump -U lumigift lumigift > backup.sql

# Restore database
docker-compose exec -T postgres psql -U lumigift -d lumigift < backup.sql
```

### Redis Operations

```bash
# Access Redis CLI
docker-compose exec redis redis-cli

# Check Redis status
docker-compose exec redis redis-cli ping

# View all keys
docker-compose exec redis redis-cli KEYS '*'

# Flush all data (careful!)
docker-compose exec redis redis-cli FLUSHALL
```

### Application Shell

```bash
# Access app container shell
docker-compose exec app sh

# Run npm commands
docker-compose exec app npm run test
docker-compose exec app npm run lint
```

## Environment Variables

Environment variables are sourced from `.env.local` and passed to the containers.

### Required Variables

```bash
# Generate a strong secret
NEXTAUTH_SECRET=$(openssl rand -base64 32)
```

### Optional Overrides

By default, `docker-compose.yml` configures:
- `DATABASE_URL=postgresql://lumigift:lumigift_dev_password@postgres:5432/lumigift`
- `REDIS_URL=redis://redis:6379`

You can override these in `.env.local` if needed.

## Troubleshooting

### Port Already in Use

If you see "port is already allocated":

```bash
# Check what's using the port
# Windows (PowerShell)
netstat -ano | findstr :3000

# Linux/Mac
lsof -i :3000

# Use different ports in docker-compose.yml
ports:
  - "3001:3000"  # Map to different host port
```

### Database Connection Failed

```bash
# Check if postgres is healthy
docker-compose ps

# View postgres logs
docker-compose logs postgres

# Restart postgres
docker-compose restart postgres
```

### App Won't Start

```bash
# Check app logs
docker-compose logs app

# Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

### Out of Disk Space

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove everything (careful!)
docker system prune -a --volumes
```

### Migrations Not Running

Migrations run automatically when postgres starts for the first time. If you need to re-run:

```bash
# Remove postgres volume
docker-compose down -v

# Start fresh (migrations will run)
docker-compose up
```

## Production Deployment

For production deployment, consider:

1. **Use secrets management** - Don't commit `.env.local`
2. **Use managed databases** - AWS RDS, Azure Database, etc.
3. **Use managed Redis** - AWS ElastiCache, Redis Cloud, etc.
4. **Enable SSL/TLS** - Use reverse proxy (nginx, Traefik)
5. **Set resource limits** - Add memory/CPU limits to docker-compose.yml
6. **Use Docker Swarm or Kubernetes** - For orchestration and scaling
7. **Monitor containers** - Use Prometheus, Grafana, or cloud monitoring

### Example Production Additions

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
      replicas: 3
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
```

## Performance Tips

### Development

- Use `docker-compose.dev.yml` for faster iteration
- Mount only necessary directories
- Use `.dockerignore` to exclude unnecessary files

### Production

- Use multi-stage builds (already configured)
- Enable BuildKit for faster builds:
  ```bash
  DOCKER_BUILDKIT=1 docker-compose build
  ```
- Use layer caching effectively
- Minimize image size by removing dev dependencies

## Security Best Practices

✅ **Implemented:**
- Non-root user in production image
- Minimal base image (Alpine Linux)
- Health checks for all services
- No secrets in Dockerfile or docker-compose.yml

⚠️ **Additional Recommendations:**
- Scan images for vulnerabilities: `docker scan lumigift-app`
- Use Docker secrets in production
- Enable Docker Content Trust
- Regularly update base images
- Use read-only file systems where possible

## Further Reading

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Next.js Docker Documentation](https://nextjs.org/docs/deployment#docker-image)
- [PostgreSQL Docker Hub](https://hub.docker.com/_/postgres)
- [Redis Docker Hub](https://hub.docker.com/_/redis)
