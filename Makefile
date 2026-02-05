.PHONY: help dev build up down logs clean test lint setup

# Default target
help:
	@echo "SliverUI - Make targets"
	@echo ""
	@echo "Development:"
	@echo "  make setup      - Initial setup (create directories, copy configs)"
	@echo "  make dev        - Start development environment"
	@echo "  make logs       - View development logs"
	@echo ""
	@echo "Production:"
	@echo "  make build      - Build production images"
	@echo "  make up         - Start production environment"
	@echo "  make down       - Stop production environment"
	@echo ""
	@echo "Utilities:"
	@echo "  make test       - Run tests"
	@echo "  make lint       - Run linters"
	@echo "  make clean      - Clean up containers and volumes"
	@echo "  make shell-be   - Shell into backend container"
	@echo "  make shell-fe   - Shell into frontend container"

# Initial setup
setup:
	@echo "Creating directories..."
	mkdir -p data/sqlite data/redis logs/nginx config nginx/ssl
	@echo "Copying example configs..."
	cp -n .env.example .env 2>/dev/null || true
	@echo ""
	@echo "Setup complete! Next steps:"
	@echo "1. Edit .env with your configuration"
	@echo "2. Add your Sliver operator config to config/operator.cfg"
	@echo "3. Add SSL certificates to nginx/ssl/ (or generate self-signed)"
	@echo "4. Run 'make dev' for development or 'make up' for production"

# Development
dev:
	docker-compose -f docker-compose.dev.yml up --build

dev-d:
	docker-compose -f docker-compose.dev.yml up --build -d

dev-down:
	docker-compose -f docker-compose.dev.yml down

logs:
	docker-compose -f docker-compose.dev.yml logs -f

logs-be:
	docker-compose -f docker-compose.dev.yml logs -f backend

logs-fe:
	docker-compose -f docker-compose.dev.yml logs -f frontend

# Production
build:
	docker-compose build

up:
	docker-compose up -d

down:
	docker-compose down

restart:
	docker-compose restart

prod-logs:
	docker-compose logs -f

# Database
db-migrate:
	docker-compose exec backend alembic upgrade head

db-rollback:
	docker-compose exec backend alembic downgrade -1

# User management
create-admin:
	docker-compose exec backend python -c "from app.cli import create_admin; import asyncio; asyncio.run(create_admin())"

# Testing
test:
	cd backend && pytest -v
	cd frontend && npm test

test-be:
	cd backend && pytest -v --cov=app --cov-report=html

test-fe:
	cd frontend && npm test

# Linting
lint:
	cd backend && ruff check . && black --check .
	cd frontend && npm run lint

lint-fix:
	cd backend && ruff check --fix . && black .
	cd frontend && npm run lint -- --fix

# Shells
shell-be:
	docker-compose exec backend /bin/sh

shell-fe:
	docker-compose exec frontend /bin/sh

shell-db:
	docker-compose exec backend python -c "from app.services.database import async_session_maker; import asyncio; print('Use async_session_maker for DB access')"

# Cleanup
clean:
	docker-compose -f docker-compose.dev.yml down -v --remove-orphans
	docker-compose down -v --remove-orphans
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name node_modules -exec rm -rf {} + 2>/dev/null || true

# SSL certificate generation (self-signed for development)
ssl-gen:
	@mkdir -p nginx/ssl
	openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
		-keyout nginx/ssl/key.pem \
		-out nginx/ssl/cert.pem \
		-subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
	@echo "Self-signed certificate generated in nginx/ssl/"

# Backup
backup:
	@mkdir -p backups
	@timestamp=$$(date +%Y%m%d_%H%M%S); \
	cp data/sqlite/sliverui.db backups/sliverui_$$timestamp.db 2>/dev/null || echo "No database to backup"; \
	echo "Backup created: backups/sliverui_$$timestamp.db"

# Status
status:
	docker-compose ps
	@echo ""
	@echo "Health check:"
	@curl -s http://localhost:8000/health 2>/dev/null || echo "Backend not reachable"
