.PHONY: up down seed cert recert install logs status clean setup help

BACKEND_DIR  = backend
FRONTEND_DIR = frontend
CERT_DIR     = nginx/certs
CERT_FILE    = $(CERT_DIR)/cert.pem
KEY_FILE     = $(CERT_DIR)/key.pem

.DEFAULT_GOAL := help

help:
	@echo "CyberAudit — Herramienta de Autoevaluación de Ciberseguridad"
	@echo ""
	@echo "  make setup   Generate MONGO_PASSWORD in .env (auto-run by 'up')"
	@echo "  make up      Build and start all services (MongoDB, backend, frontend, nginx)"
	@echo "  make down    Stop all services"
	@echo "  make status  Show service status"
	@echo "  make logs    Tail backend and frontend logs"
	@echo "  make seed    Re-seed the database (services must be running)"
	@echo "  make install Install npm dependencies locally (for IDE tooling)"
	@echo "  make cert    Generate SSL certificate (mkcert if installed, else self-signed)"
	@echo "  make recert  Force certificate regeneration (run after installing mkcert)"
	@echo "  make clean   Stop everything and remove containers, volumes, and node_modules"

# ── Root .env bootstrap (generates MONGO_PASSWORD if blank) ──────────────────
setup:
	@if [ ! -f .env ]; then \
		printf 'MONGO_USER=cybersec\nMONGO_PASSWORD=\n' > .env; \
	fi
	@if grep -qE '^MONGO_PASSWORD=$$' .env; then \
		PASS=$$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"); \
		sed -i "s|^MONGO_PASSWORD=.*|MONGO_PASSWORD=$$PASS|" .env; \
		echo ">>> Generated MONGO_PASSWORD and saved to .env"; \
	fi

# ── Main target ───────────────────────────────────────────────────────────────
up: setup cert $(BACKEND_DIR)/.env
	@echo ">>> [1/4] Building and starting all services..."
	docker-compose up -d --build
	@echo ">>> [2/4] Waiting for MongoDB to be healthy..."
	@while [ "$$(docker inspect --format='{{.State.Health.Status}}' cybersec_mongo 2>/dev/null)" != "healthy" ]; do \
		if [ "$$(docker inspect --format='{{.State.Status}}' cybersec_mongo 2>/dev/null)" = "exited" ]; then \
			echo " MongoDB crashed! Run: docker logs cybersec_mongo"; exit 1; \
		fi; \
		printf '.'; sleep 2; \
	done
	@echo " MongoDB ready."
	@echo ">>> [3/4] Waiting for backend to be healthy..."
	@while [ "$$(docker inspect --format='{{.State.Health.Status}}' cybersec_backend 2>/dev/null)" != "healthy" ]; do \
		if [ "$$(docker inspect --format='{{.State.Status}}' cybersec_backend 2>/dev/null)" = "exited" ]; then \
			echo " Backend crashed! Run: docker logs cybersec_backend"; exit 1; \
		fi; \
		printf '.'; sleep 2; \
	done
	@echo " Backend ready."
	@echo ">>> [4/4] Seeding database..."
	docker exec cybersec_backend node seed/seed.js
	@echo ""
	@echo "CyberAudit is up and running!"
	@echo "  App (HTTPS) -> https://localhost"
	@echo ""
	@echo "  make logs    to view logs"
	@echo "  make status  to check services"
	@echo "  make down    to stop all services"

# ── SSL certificate (generated once; uses mkcert if available) ────────────────
cert: $(CERT_FILE)

$(CERT_FILE):
	@mkdir -p $(CERT_DIR)
	@if command -v mkcert > /dev/null 2>&1; then \
		echo ">>> Generating trusted certificate with mkcert..."; \
		mkcert -cert-file $(CERT_FILE) -key-file $(KEY_FILE) localhost 127.0.0.1 ::1; \
		echo ">>> Certificate ready — no browser warning."; \
	else \
		echo ">>> mkcert not found — generating self-signed certificate..."; \
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

# ── Backend .env (created once from example) ─────────────────────────────────
$(BACKEND_DIR)/.env:
	@echo ">>> Creating backend/.env from .env.example..."
	cp $(BACKEND_DIR)/.env.example $(BACKEND_DIR)/.env
	@if [ -f $(CERT_FILE) ]; then \
		sed -i 's|^CORS_ORIGIN=.*|CORS_ORIGIN=https://localhost|' $(BACKEND_DIR)/.env; \
		echo ">>> Set CORS_ORIGIN=https://localhost (nginx HTTPS)"; \
	fi

# ── npm install (local only — for IDE tooling, not needed for Docker) ─────────
install: $(BACKEND_DIR)/node_modules $(FRONTEND_DIR)/node_modules

$(BACKEND_DIR)/node_modules: $(BACKEND_DIR)/package.json
	@echo ">>> Installing backend dependencies..."
	cd $(BACKEND_DIR) && npm install
	@touch $@

$(FRONTEND_DIR)/node_modules: $(FRONTEND_DIR)/package.json
	@echo ">>> Installing frontend dependencies..."
	cd $(FRONTEND_DIR) && npm install
	@touch $@

# ── Database seed (runs inside the backend container) ────────────────────────
seed:
	docker exec cybersec_backend node seed/seed.js

# ── Logs ──────────────────────────────────────────────────────────────────────
logs:
	docker-compose logs -f --tail=50 backend frontend

# ── Status ────────────────────────────────────────────────────────────────────
status:
	@docker-compose ps

# ── Stop ──────────────────────────────────────────────────────────────────────
down:
	docker-compose down

# ── Clean ─────────────────────────────────────────────────────────────────────
clean: down
	docker-compose down -v --rmi local 2>/dev/null || true
	rm -rf $(BACKEND_DIR)/node_modules $(FRONTEND_DIR)/node_modules
	rm -f  $(BACKEND_DIR)/.env
	@echo "Clean complete. (SSL certs kept in $(CERT_DIR) — delete manually to regenerate)"
