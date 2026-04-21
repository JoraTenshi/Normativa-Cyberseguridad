.PHONY: help setup install run run-backend run-frontend clean destroy

help:
	@echo "Available commands:"
	@echo "  make setup          - Generate .env file and create virtual environments"
	@echo "  make install        - Install all dependencies"
	@echo "  make run            - Start both backend and frontend"
	@echo "  make run-backend    - Start only the backend"
	@echo "  make run-frontend   - Start only the frontend"
	@echo "  make clean          - Remove .env file and clean up"
	@echo "  make destroy        - Remove .env and all virtual environments"

# Generate .env file from .env.example
setup: .env

.env:
	@echo "Creating .env file from .env.example..."
	@cp .env.example .env
	@echo ".env file created successfully!"

# Install dependencies
install: setup
	@echo "Installing backend dependencies..."
	@cd backend && python -m venv venv
	@cd backend && . venv/bin/activate && pip install --upgrade pip && pip install -r requirements.txt
	@echo "Backend dependencies installed!"
	@echo ""
	@echo "Installing frontend dependencies..."
	@cd frontend && npm install
	@echo "Frontend dependencies installed!"

# Run both backend and frontend
run: install
	@echo "Starting backend and frontend..."
	@echo "Backend will run on http://localhost:8000"
	@echo "Frontend will run on http://localhost:3000"
	@echo ""
	@echo "Press Ctrl+C to stop both services"
	@(cd backend && . venv/bin/activate && python main.py) &
	@(cd frontend && npm start)

# Run only backend
run-backend: setup
	@echo "Checking backend dependencies..."
	@if [ ! -d "backend/venv" ]; then \
		echo "Installing backend dependencies..."; \
		cd backend && python -m venv venv && . venv/bin/activate && pip install --upgrade pip && pip install -r requirements.txt; \
	fi
	@echo "Starting backend on http://localhost:8000"
	@cd backend && . venv/bin/activate && python main.py

# Run only frontend
run-frontend: setup
	@echo "Checking frontend dependencies..."
	@if [ ! -d "frontend/node_modules" ]; then \
		echo "Installing frontend dependencies..."; \
		cd frontend && npm install; \
	fi
	@echo "Starting frontend on http://localhost:3000"
	@cd frontend && npm start

# Clean up (remove .env)
clean:
	@if [ -f ".env" ]; then \
		echo "Removing .env file..."; \
		rm .env; \
		echo ".env file removed!"; \
	else \
		echo ".env file not found, nothing to remove"; \
	fi

# Destroy (remove .env and all environments)
destroy: clean
	@echo "Removing backend virtual environment..."
	@rm -rf backend/venv
	@echo "Removing frontend node_modules..."
	@rm -rf frontend/node_modules
	@echo "All environments cleaned up!"
