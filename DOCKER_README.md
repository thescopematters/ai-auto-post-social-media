# Docker Setup Guide

## 📦 Project Structure

```
.
├── Dockerfile                  # Frontend production build
├── Dockerfile.dev             # Frontend development with hot-reload
├── docker-compose.yml         # Production setup
├── docker-compose.dev.yml     # Development setup with hot-reload
├── nginx.conf                 # Nginx config for frontend
├── .dockerignore              # Files to ignore in Docker builds
├── server/
│   ├── Dockerfile            # Backend Dockerfile
│   └── .env                  # Backend environment variables
└── .env                       # Frontend environment variables (create this)
```

## 🚀 Quick Start

### Production Mode

1. **Create environment files:**

```bash
# Frontend .env (root directory)
cat > .env << EOF
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:3002
EOF

# Backend .env (server/.env should already exist)
```

2. **Build and run:**

```bash
docker-compose up --build
```

3. **Access the application:**
   - **Frontend**: http://localhost:3000
   - **Backend API**: http://localhost:3002

### Development Mode (with Hot-Reload)

1. **Build and run development containers:**

```bash
docker-compose -f docker-compose.dev.yml up --build
```

2. **Changes to code will automatically reload!**
   - Frontend: Vite hot-reload on port 3000
   - Backend: tsx watch mode on port 3002

## 📋 Available Commands

### Production

```bash
# Start services
docker-compose up

# Start in background
docker-compose up -d

# Stop services
docker-compose down

# Rebuild and start
docker-compose up --build

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f frontend
docker-compose logs -f backend
```

### Development

```bash
# Start dev services
docker-compose -f docker-compose.dev.yml up

# Start in background
docker-compose -f docker-compose.dev.yml up -d

# Stop dev services
docker-compose -f docker-compose.dev.yml down

# Rebuild
docker-compose -f docker-compose.dev.yml up --build
```

## 🔧 Service Details

### Frontend Service
- **Port**: 3000
- **Technology**: React + Vite + TypeScript
- **Production**: Served by Nginx
- **Development**: Vite dev server with hot-reload
- **Container Name**: ai-frontend (prod) / ai-frontend-dev (dev)

### Backend Service
- **Port**: 3002
- **Technology**: Node.js + Express + TypeScript
- **Runtime**: tsx for TypeScript execution
- **Container Name**: ai-backend (prod) / ai-backend-dev (dev)

## 🌐 Environment Variables

### Frontend (.env in root directory)

```env
# Supabase
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Backend API
VITE_API_URL=http://localhost:3002

# Optional
VITE_APP_NAME=ContentAI Pro
VITE_APP_URL=http://localhost:3000
```

### Backend (server/.env)

See your existing `server/.env` file for backend configuration.

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Check what's using the port
lsof -i :3000
lsof -i :3002

# Kill the process
kill -9 <PID>
```

### Container Won't Start

```bash
# Remove all containers and volumes
docker-compose down -v

# Rebuild from scratch
docker-compose up --build --force-recreate
```

### View Container Logs

```bash
# All logs
docker-compose logs

# Follow logs
docker-compose logs -f

# Specific service
docker-compose logs -f frontend
```

### Access Container Shell

```bash
# Frontend
docker exec -it ai-frontend sh

# Backend
docker exec -it ai-backend sh
```

## 🏗️ Build Process

### Frontend Production Build

1. **Stage 1 (Builder)**:
   - Install dependencies
   - Build Vite app → `/dist` folder
   - Optimized production bundle

2. **Stage 2 (Nginx)**:
   - Copy built files to Nginx
   - Serve static files
   - Handle React Router routing

### Backend Build

- Direct Node.js container
- Uses tsx for TypeScript execution
- Hot-reload in development mode

## 📊 Container Networking

Both services are on the same Docker network (`app-network`), so they can communicate:

- Frontend can access backend at: `http://backend:3002`
- Backend can access frontend at: `http://frontend:3000`

## 🔒 Security Notes

1. **Never commit .env files** with real credentials
2. Use `.env.example` for documentation
3. Update CORS settings in backend for production
4. Use environment-specific configurations

## 💡 Tips

### Use Docker Compose Profiles

Add this to docker-compose.yml for optional services:

```yaml
services:
  database:
    profiles: ["full"]
    # ...
```

Run with: `docker-compose --profile full up`

### Resource Limits

Add resource limits to prevent memory issues:

```yaml
services:
  frontend:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

### Health Checks

Add health checks for better reliability:

```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## 📝 Next Steps

1. Create `.env` file with your configuration
2. Ensure `server/.env` exists with backend config
3. Run `docker-compose up --build`
4. Access frontend at http://localhost:3000
5. Check logs if issues arise

## 🎯 Production Deployment

For production deployment, consider:

1. Using environment-specific docker-compose files
2. Setting up CI/CD pipelines
3. Using Docker secrets for sensitive data
4. Implementing proper logging and monitoring
5. Setting up reverse proxy (Nginx/Traefik)
6. Using Docker Swarm or Kubernetes for orchestration

