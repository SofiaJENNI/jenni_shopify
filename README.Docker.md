# Docker Setup for JENNi Shopify App

This guide explains how to run the JENNi Shopify application using Docker.

## Quick Start

### Option 1: Simple Setup (App Only)
```bash
# Build and run the app (no Redis)
docker-compose -f docker-compose.simple.yml up --build

# Access the app at http://localhost:4000
```

### Option 2: Full Setup (App + Redis)
```bash
# Build and run with Redis for order queue
docker-compose up --build

# Access the app at http://localhost:4000
# Redis available at localhost:6379
```

## Environment Configuration

### 1. Copy Environment Template
```bash
cp .env.example .env
```

### 2. Edit `.env` with Your Values
```bash
# Required for Shopify integration
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret  
SHOPIFY_APP_URL=https://your-app-domain.com

# Required for JENNi integration
JENNI_CLIENT_ID=your_jenni_client_id
JENNI_CLIENT_SECRET=your_jenni_client_secret
JENNI_API_HOST=https://api.jenni.ai

# Optional (only needed for order processing)
REDIS_URL=redis://redis:6379
JENNI_ORDERS_URL=your_jenni_orders_url
JENNI_API_KEY=your_jenni_api_key
```

### 3. Update Docker Compose Environment
Edit `docker-compose.yml` or `docker-compose.simple.yml` to use your environment variables:

```yaml
environment:
  - SHOPIFY_API_KEY=${SHOPIFY_API_KEY}
  - SHOPIFY_API_SECRET=${SHOPIFY_API_SECRET}
  - SHOPIFY_APP_URL=${SHOPIFY_APP_URL}
  - JENNI_CLIENT_ID=${JENNI_CLIENT_ID}
  - JENNI_CLIENT_SECRET=${JENNI_CLIENT_SECRET}
  - JENNI_API_HOST=${JENNI_API_HOST}
```

## Docker Commands

### Development
```bash
# Start services in development mode
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f jenni-app

# Stop services
docker-compose down
```

### Build & Deploy
```bash
# Build only
docker build -t jenni-shopify-app .

# Run single container
docker run -p 4000:4000 --env-file .env jenni-shopify-app

# Rebuild after code changes
docker-compose up --build
```

### Maintenance
```bash
# Remove all containers and volumes
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Clean up Docker system
docker system prune -a
```

## File Structure

```
├── Dockerfile                    # Main application container
├── docker-compose.yml           # Full setup (app + Redis)
├── docker-compose.simple.yml    # Simple setup (app only)
├── .dockerignore                 # Files to exclude from Docker build
└── README.Docker.md             # This file
```

## Port Mapping

- **App**: `localhost:4000` → Container port 4000
- **Redis** (full setup): `localhost:6379` → Container port 6379

## Health Checks

Both setups include health checks:
- **App**: `GET /_health` endpoint
- **Redis**: `redis-cli ping` command

## Development Features

### Hot Reload
Source code is mounted as volumes for development, so changes are reflected immediately:
- `./src` → `/app/src`
- `./examples` → `/app/examples`
- `./extensions` → `/app/extensions`

### Debugging
```bash
# Access container shell
docker-compose exec jenni-app sh

# Check logs
docker-compose logs jenni-app

# Monitor Redis (full setup)
docker-compose exec redis redis-cli monitor
```

## Production Considerations

For production deployment:

1. **Use environment variables** instead of `.env` file
2. **Remove development volumes** from docker-compose.yml
3. **Use production Redis** instead of container Redis
4. **Add reverse proxy** (nginx, traefik) for HTTPS
5. **Set up log aggregation** for monitoring

### Production Dockerfile
```dockerfile
# Multi-stage build for smaller production image
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production=false
COPY . .
RUN npm run build

FROM node:18-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
USER 1001
CMD ["npm", "start"]
```

## Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Find process using port 4000
lsof -i :4000

# Kill process or use different port
docker-compose -p jenni-alt up
```

**Permission errors:**
```bash
# Fix file permissions
sudo chown -R $(whoami):$(whoami) .
```

**Environment variables not working:**
```bash
# Check if .env is loaded
docker-compose config

# Pass variables explicitly
JENNI_CLIENT_ID=xxx docker-compose up
```

## Integration with Existing Workflow

The Docker setup is designed to work alongside existing development:

```bash
# Traditional development
npm run dev

# Docker development  
docker-compose up

# Both use the same source code and .env configuration
```
