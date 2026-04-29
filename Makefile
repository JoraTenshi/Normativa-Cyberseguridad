.PHONY: up down install seed mongo cert recert logs status clean help \
        _start_backend _start_frontend

BACKEND_DIR  = backend
FRONTEND_DIR = frontend
BACKEND_LOG  = .backend.log
FRONTEND_LOG = .frontend.log
BACKEND_PID  = .backend.pid
FRONTEND_PID = .frontend.pid
CERT_DIR     = nginx/certs
CERT_FILE    = $(CERT_DIR)/cert.pem
KEY_FILE     = $(CERT_DIR)/key.pem

.DEFAULT_GOAL := help

help:
	@echo "CyberAudit — Herramienta de Autoevaluación de Ciberseguridad"
	@echo ""
	@echo "  make up      Start everything (nginx HTTPS + MongoDB + backend + frontend)"
	@echo "  make down    Stop all services"
	@echo "  make status  Check which services are running"
	@echo "  make logs    Tail backend and frontend logs"
	@echo "  make seed    Re-seed the database"
	@echo "  make install Install npm dependencies (backend + frontend)"
	@echo "  make cert    Generate SSL certificate (mkcert if installed, else self-signed)"
	@echo "  make recert  Force certificate regeneration (run after installing mkcert)"
	@echo "  make clean   Stop everything and remove node_modules, .env, logs"

# ── Main target ───────────────────────────────────────────────────────────────
up: cert mongo $(BACKEND_DIR)/.env install seed _start_backend _start_frontend
	@echo ""
	@echo "CyberAudit is up and running!"
	@echo "  App (HTTPS) -> https://localhost"
	@echo "  Backend     -> http://localhost:5000  (internal)"
	@echo "  Frontend    -> http://localhost:3000  (internal)"
	@echo ""
	@echo "  NOTE: Accept the self-signed certificate warning in your browser."
	@echo ""
	@echo "  make logs    to view logs"
	@echo "  make status  to check services"
	@echo "  make down    to stop all services"

# ── SSL certificate (generated once; uses mkcert if available) ────────────────
cert: $(CERT_FILE)

$(CERT_FILE):
	@mkdir -p $(CERT_DIR)
	@if command -v mkcert > /dev/null 2>&1; then \
		echo ">>> [1/7] Generating trusted certificate with mkcert..."; \
		mkcert -cert-file $(CERT_FILE) -key-file $(KEY_FILE) localhost 127.0.0.1 ::1; \
		echo ">>> Certificate ready — no browser warning."; \
	else \
		echo ">>> [1/7] mkcert not found — generating self-signed certificate..."; \
		echo "    TIP: install mkcert to avoid browser warnings:"; \
		echo "         sudo apt install mkcert libnss3-tools && mkcert -install && make recert"; \
		openssl req -x509 -newkey rsa:4096 \
			-keyout $(KEY_FILE) \
			-out    $(CERT_FILE) \
			-days 365 -nodes \
			-subj '/C=ES/ST=Local/L=Local/O=CyberAudit/CN=localhost' 2>/dev/null; \
		echo ">>> Self-signed certificate ready (browser warning expected)."; \
	fi
	@if [ -f $(BACKEND_DIR)/.env ]; then \
		sed -i 's|^CORS_ORIGIN=.*|CORS_ORIGIN=https://localhost|' $(BACKEND_DIR)/.env; \
	fi

# Force cert regeneration (use after installing mkcert)
recert:
	rm -f $(CERT_FILE) $(KEY_FILE)
	$(MAKE) cert

# ── Docker services (MongoDB + nginx) ────────────────────────────────────────
mongo:
	@echo ">>> [2/7] Starting MongoDB and nginx..."
	docker-compose up -d
	@echo ">>> Waiting for MongoDB to accept connections..."
	@until docker exec cybersec_mongo mongosh --quiet --eval "db.runCommand({ping:1})" > /dev/null 2>&1; do \
		printf '.'; sleep 1; \
	done
	@echo " MongoDB ready."

# ── Backend .env (created once; sets CORS to https://localhost if cert exists) ─
$(BACKEND_DIR)/.env:
	@echo ">>> Creating backend/.env from .env.example..."
	cp $(BACKEND_DIR)/.env.example $(BACKEND_DIR)/.env
	@if [ -f $(CERT_FILE) ]; then \
		sed -i 's|^CORS_ORIGIN=.*|CORS_ORIGIN=https://localhost|' $(BACKEND_DIR)/.env; \
		echo ">>> Set CORS_ORIGIN=https://localhost (nginx HTTPS)"; \
	fi

# ── npm install (skips if node_modules is up to date) ────────────────────────
install: $(BACKEND_DIR)/node_modules $(FRONTEND_DIR)/node_modules

$(BACKEND_DIR)/node_modules: $(BACKEND_DIR)/package.json
	@echo ">>> [3/7] Installing backend dependencies..."
	cd $(BACKEND_DIR) && npm install
	@touch $@

$(FRONTEND_DIR)/node_modules: $(FRONTEND_DIR)/package.json
	@echo ">>> [4/7] Installing frontend dependencies..."
	cd $(FRONTEND_DIR) && npm install
	@touch $@

# ── Database seed ─────────────────────────────────────────────────────────────
seed: $(BACKEND_DIR)/.env $(BACKEND_DIR)/node_modules
	@echo ">>> [5/7] Seeding database..."
	cd $(BACKEND_DIR) && npm run seed

# ── Node.js processes ─────────────────────────────────────────────────────────
_start_backend:
	@echo ">>> [6/7] Starting backend..."
	@if [ -f $(BACKEND_PID) ] && kill -0 $$(cat $(BACKEND_PID)) 2>/dev/null; then \
		echo "    Already running (PID $$(cat $(BACKEND_PID)))"; \
	else \
		cd $(BACKEND_DIR) && nohup npm start > ../$(BACKEND_LOG) 2>&1 & echo $$! > ../$(BACKEND_PID); \
		sleep 2; \
		echo "    Backend started on http://localhost:5000 (PID $$(cat $(BACKEND_PID)))"; \
	fi

_start_frontend:
	@echo ">>> [7/7] Starting frontend..."
	@if [ -f $(FRONTEND_PID) ] && kill -0 $$(cat $(FRONTEND_PID)) 2>/dev/null; then \
		echo "    Already running (PID $$(cat $(FRONTEND_PID)))"; \
	else \
		cd $(FRONTEND_DIR) && BROWSER=none nohup npm start > ../$(FRONTEND_LOG) 2>&1 & echo $$! > ../$(FRONTEND_PID); \
		echo "    Frontend starting on http://localhost:3000 (PID $$(cat $(FRONTEND_PID)))"; \
		echo "    (first run may take 30-60 seconds to compile)"; \
	fi

# ── Logs ──────────────────────────────────────────────────────────────────────
logs:
	@echo "=== Backend ($(BACKEND_LOG)) ==="
	@tail -n 50 $(BACKEND_LOG) 2>/dev/null || echo "(no logs yet)"
	@echo ""
	@echo "=== Frontend ($(FRONTEND_LOG)) ==="
	@tail -n 50 $(FRONTEND_LOG) 2>/dev/null || echo "(no logs yet)"

# ── Status ────────────────────────────────────────────────────────────────────
status:
	@echo "=== Service Status ==="
	@if [ -f $(BACKEND_PID) ] && kill -0 $$(cat $(BACKEND_PID)) 2>/dev/null; then \
		echo "  Backend:  running (PID $$(cat $(BACKEND_PID)))"; \
	else \
		echo "  Backend:  stopped"; \
	fi
	@if [ -f $(FRONTEND_PID) ] && kill -0 $$(cat $(FRONTEND_PID)) 2>/dev/null; then \
		echo "  Frontend: running (PID $$(cat $(FRONTEND_PID)))"; \
	else \
		echo "  Frontend: stopped"; \
	fi
	@docker-compose ps 2>/dev/null | grep -q "cybersec_mongo" \
		&& echo "  MongoDB:  running" \
		|| echo "  MongoDB:  stopped"
	@docker-compose ps 2>/dev/null | grep -q "cybersec_nginx" \
		&& echo "  nginx:    running  -> https://localhost" \
		|| echo "  nginx:    stopped"

# ── Stop ──────────────────────────────────────────────────────────────────────
down:
	@echo "Stopping all services..."
	@if [ -f $(BACKEND_PID) ]; then \
		kill $$(cat $(BACKEND_PID)) 2>/dev/null && echo "  Backend stopped" || true; \
		rm -f $(BACKEND_PID); \
	fi
	@if [ -f $(FRONTEND_PID) ]; then \
		kill $$(cat $(FRONTEND_PID)) 2>/dev/null && echo "  Frontend stopped" || true; \
		rm -f $(FRONTEND_PID); \
	fi
	docker-compose down
	@echo "All services stopped."

# ── Clean ─────────────────────────────────────────────────────────────────────
clean: down
	rm -rf $(BACKEND_DIR)/node_modules $(FRONTEND_DIR)/node_modules
	rm -f  $(BACKEND_DIR)/.env $(BACKEND_LOG) $(FRONTEND_LOG)
	@echo "Clean complete. (SSL certs kept in $(CERT_DIR) — delete manually to regenerate)"
