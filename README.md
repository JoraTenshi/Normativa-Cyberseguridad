# Cybersecurity Regulations

A web application to manage and access cybersecurity regulations and compliance rules.

## About

This project is a containerized web application using Alpine Linux for lightweight and efficient deployments. It consists of:
- **Nginx (Reverse Proxy)**: Single entry point routing requests to frontend and backend
- **Frontend Container**: User interface (Alpine-based, port 3000 internal)
- **Backend Container**: API and data processing (Alpine-based, port 8000 internal)
- **Docker Compose**: Orchestrates all services for easy local development

## Architecture

```
Internet (port 80)
    ↓
Nginx (Reverse Proxy - Port 80)
    ├─→ Frontend (http://frontend:3000)
    └─→ Backend API (http://backend:8000/api)
```

All requests go through Nginx on port 80, which routes them appropriately.

## Getting Started

### Requirements

- Docker installed: [https://www.docker.com/](https://www.docker.com/)
- Docker Compose (included with Docker)

### Quick Start

1. Go to the project folder:
   bash
   cd Normativa-Cyberseguridad

2. Start the application:
   bash
   docker-compose up --build

3. Access the application:
   - **Application:** http://localhost
   - **API:** http://localhost/api/

Press `Ctrl + C` to stop, or run `docker-compose down` to stop and remove containers.

## Project Structure

```
Normativa-Cyberseguridad/
├── docker-compose.yml      # Docker services configuration
├── .env.example            # Environment variables template
├── .gitignore              # Files to ignore
├── Makefile                # Build and automation commands
├── README.md               # This file
├── BACKEND_SETUP.md        # Backend technology guide
├── backend/                # Backend API container
│   └── Dockerfile          # Alpine Linux image
├── frontend/               # Frontend UI container
│   └── Dockerfile          # Alpine Linux image
└── nginx/                  # Reverse proxy & gateway
    ├── Dockerfile          # Nginx Alpine image
    └── nginx.conf          # Routing configuration
```

## How It Works

1. **Nginx** listens on port 80 and acts as a reverse proxy
2. Requests to `/` are routed to the **Frontend** container
3. Requests to `/api/` are routed to the **Backend** container
4. WebSocket connections are upgraded for real-time features
5. X-Forwarded-For headers are passed for proper client IP tracking

## Docker Commands

- **Start all services:** `docker-compose up --build`
- **Start in background:** `docker-compose up -d`
- **Stop all services:** `docker-compose down`
- **View running services:** `docker-compose ps`
- **View all logs:** `docker-compose logs`
- **View specific service logs:**
  - Backend: `docker-compose logs backend`
  - Frontend: `docker-compose logs frontend`
  - Nginx: `docker-compose logs nginx`

## Container Information

### Nginx
- **Image:** nginx:alpine (lightweight, ~11MB)
- **Port:** 80 (entry point)
- **Role:** Reverse proxy and request router
- **Config:** `/nginx/nginx.conf`

### Backend
- **Image:** alpine:latest (~7MB + your dependencies)
- **Internal Port:** 8000
- **Route:** `/api/*`
- **Utilities:** curl, wget, git, bash

### Frontend
- **Image:** alpine:latest (~7MB + your dependencies)
- **Internal Port:** 3000 (typically Vite/React dev server)
- **Route:** `/`
- **Utilities:** curl, wget, git, bash

## Troubleshooting

**Port 80 already in use?**
- Check what's using port 80: `sudo lsof -i :80` (on Linux/macOS)
- Stop other services or change the port mapping in `docker-compose.yml` (e.g., `"8080:80"`)

**Containers fail to start?**
- Check logs: `docker-compose logs`
- Ensure Docker daemon is running
- Clean up: `docker-compose down` then rebuild

**Permission denied errors?**
- Linux users need Docker permissions: `sudo usermod -aG docker $USER`
- Then log out and log back in

**Backend/Frontend not accessible via Nginx?**
- Verify service names in `docker-compose.yml` match `nginx.conf`
- Check nginx logs: `docker-compose logs nginx`
- Ensure containers are running: `docker-compose ps`

**WebSocket connection issues?**
- Nginx is configured to upgrade WebSocket connections
- Check browser console for errors
- Verify proxy configuration in `/nginx/nginx.conf`

## Next Steps

- Add your backend technology (Python/Django, Node.js/Express, etc.)
- See [BACKEND_SETUP.md](BACKEND_SETUP.md) for detailed backend setup
- Configure frontend application (React, Vue, etc.)
- Customize `/nginx/nginx.conf` for your specific routing needs
- Set environment variables in `.env` file

## Notes

- **Lightweight:** All containers use Alpine Linux (~7-11MB each)
- **Production-Ready:** Nginx provides a stable gateway for scaling
- **Development-Friendly:** Easy to modify and debug with Docker Compose
- **Security:** Never share your `.env` file
- **Logs:** Use `docker-compose logs` to debug any issues
- **Stopping:** Always use `docker-compose down` to properly clean up resources

## Useful Resources

- [Nginx Documentation](https://nginx.org/en/docs/)
- [Docker Documentation](https://docs.docker.com/)
- [Alpine Linux](https://alpinelinux.org/)
