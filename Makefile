.PHONY: help build up down delete

help:
	@echo "Available commands:"
	@echo "  make build          - Build backend and nginx Docker images"
	@echo "  make up             - Start backend and nginx containers"
	@echo "  make down           - Stop backend and nginx containers"
	@echo "  make delete         - Delete backend and nginx Docker images"

# Build backend and nginx Docker images
build:
	@echo "Building backend and nginx Docker images..."
	@sudo docker-compose -f docker-compose.yml build backend nginx
	@echo "Images built successfully!"

# Start backend and nginx containers
up:
	@echo "Starting backend and nginx containers..."
	@echo "Backend will be available at http://192.168.1.154:8000"
	@echo "Nginx will be available at http://192.168.1.154:80"
	@echo "Press Ctrl+C to stop."
	@sudo docker-compose -f docker-compose.yml up backend nginx

# Stop backend and nginx containers
down:
	@echo "Stopping backend and nginx containers..."
	@sudo docker-compose -f docker-compose.yml down
	@echo "Containers stopped."

# Delete backend and nginx Docker images
delete:
	@echo "Deleting backend and nginx Docker images..."
	@sudo docker-compose -f docker-compose.yml down --rmi all
	@echo "Images deleted."
