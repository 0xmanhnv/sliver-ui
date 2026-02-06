# SliverUI

Web-based GUI for [Sliver C2 Framework](https://github.com/BishopFox/sliver).

## Features

- **Dashboard** - Real-time overview of sessions, beacons, and listeners
- **Session Management** - Interactive shell, file browser, process list
- **Beacon Management** - View and manage beacon callbacks
- **Implant Builder** - Visual form-based implant generation
- **Listener Management** - Start/stop listeners with one click
- **Browser Ops** - Cookie extraction, profile hijacking, Playwright automation
- **Multi-user Support** - Role-based access control (admin / operator / viewer)
- **Audit Logging** - Track all operator actions

## Architecture

```
Browser ──HTTPS──▶ Nginx (:443, TLS termination)
                      │
                      ▼
                  sliver-ui (:8000)
                  ┌──────────────────────────┐
                  │ FastAPI + Gunicorn        │
                  │  /api/v1/*  → REST API    │
                  │  /ws        → WebSocket   │
                  │  /health    → Health check│
                  │  /assets/*  → Static (JS) │
                  │  /*         → SPA (React) │
                  └──────────┬───────────────┘
                             │ gRPC (mTLS)
                             ▼
                       Sliver Server
```

The project builds into a **single Docker image** (`sliver-ui:latest`) that bundles the React frontend and the FastAPI backend together. Nginx runs as a separate container handling TLS only.

---

## Prerequisites

- Docker Engine 24+ and Docker Compose v2+
- A running Sliver C2 server with an operator config file
- SSL certificates for HTTPS (self-signed or CA-signed)

---

## Quick Start (Production)

### Step 1 - Prepare directories and config

```bash
make setup
```

This creates: `data/`, `logs/`, `config/`, `certs/`.

### Step 2 - Create `.env`

```bash
cp .env.example .env
```

Edit `.env` and set **at minimum**:

```ini
SECRET_KEY=<random-string-at-least-32-chars>
ADMIN_PASSWORD=<strong-password>
```

Generate a random secret key:

```bash
openssl rand -hex 32
```

### Step 3 - Sliver operator config

On your Sliver server, generate an operator config:

```bash
sliver > new-operator --name sliverui --lhost <sliver-server-ip> --permissions all
```

Copy the resulting `.cfg` file into this project:

```bash
cp /path/to/sliverui.cfg config/operator.cfg
```

### Step 4 - SSL certificates

```bash
# Option A: Self-signed (for testing)
make ssl-gen

# Option B: Let's Encrypt
certbot certonly --standalone -d your-domain.com
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem certs/cert.pem
cp /etc/letsencrypt/live/your-domain.com/privkey.pem   certs/key.pem
```

### Step 5 - Build and start

```bash
make build    # Build the unified Docker image
make up       # Start sliver-ui + nginx containers
```

### Step 6 - Verify

```bash
# Backend health
curl -f http://localhost:8000/health

# Frontend via nginx
curl -k https://localhost/

# API via nginx
curl -k https://localhost/api/v1/auth/me
```

Open `https://<your-ip>` in a browser and log in with the credentials from `.env`.

---

## Quick Start (Pre-built Image - No Build Required)

Deploy SliverUI from the pre-built image on [GHCR](https://ghcr.io/0xmanhnv/sliver-ui). No source code or local build needed — only 3 files required on the server.

### Step 1 - Download files

```bash
mkdir -p sliverui && cd sliverui

# Download the 2 required files from the repo
curl -LO https://raw.githubusercontent.com/0xmanhnv/sliver-ui/main/docker-compose.hub.yml
mkdir -p nginx
curl -L https://raw.githubusercontent.com/0xmanhnv/sliver-ui/main/nginx/nginx.conf -o nginx/nginx.conf
```

### Step 2 - Create directories and `.env`

```bash
mkdir -p data logs logs/nginx config certs

cat > .env << 'EOF'
SECRET_KEY=<paste-output-of-openssl-rand-hex-32>
ADMIN_PASSWORD=<strong-password>
ADMIN_USERNAME=admin
# Pin to a specific version (optional):
# SLIVERUI_VERSION=1.0.0
EOF
```

Generate a random secret key:

```bash
openssl rand -hex 32
```

### Step 3 - Sliver operator config + SSL certs

```bash
# Operator config (from Sliver server)
cp /path/to/sliverui.cfg config/operator.cfg

# SSL certificates
# Option A: Self-signed (for testing)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout certs/key.pem -out certs/cert.pem \
  -subj "/CN=localhost"

# Option B: Let's Encrypt (production)
# certbot certonly --standalone -d your-domain.com
# cp /etc/letsencrypt/live/your-domain.com/fullchain.pem certs/cert.pem
# cp /etc/letsencrypt/live/your-domain.com/privkey.pem   certs/key.pem
```

### Step 4 - Start

```bash
docker compose -f docker-compose.hub.yml up -d
```

### Step 5 - Verify

```bash
# Health check
curl -f http://localhost:8000/health

# Open in browser
# https://<your-server-ip>
```

### Update to a new version

```bash
# Pull latest image and restart
docker compose -f docker-compose.hub.yml pull
docker compose -f docker-compose.hub.yml up -d

# Or pin a specific version in .env:
# SLIVERUI_VERSION=1.2.0
```

### Directory layout on the server

```
sliverui/
├── docker-compose.hub.yml
├── .env
├── nginx/
│   └── nginx.conf
├── config/
│   └── operator.cfg
├── certs/
│   ├── cert.pem
│   └── key.pem
├── data/          # auto-created, contains sliverui.db
└── logs/          # auto-created
```

---

## Quick Start (Docker Run - No Compose)

Run SliverUI with plain `docker run` commands. No docker-compose needed.

### Step 1 - Prepare

```bash
mkdir -p sliverui/{data,logs,logs/nginx,config,certs,nginx} && cd sliverui

# Create .env (used by the commands below)
cat > .env << 'EOF'
SECRET_KEY=<paste-output-of-openssl-rand-hex-32>
ADMIN_PASSWORD=<strong-password>
EOF

# Place operator config + SSL certs
cp /path/to/sliverui.cfg config/operator.cfg
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout certs/key.pem -out certs/cert.pem -subj "/CN=localhost"
```

### Step 2 - Download nginx config

```bash
curl -L https://raw.githubusercontent.com/0xmanhnv/sliver-ui/main/nginx/nginx.conf \
  -o nginx/nginx.conf
```

### Step 3 - Run SliverUI

```bash
source .env

docker run -d \
  --name sliver-ui \
  --network host \
  --restart unless-stopped \
  -e APP_ENV=production \
  -e SECRET_KEY="$SECRET_KEY" \
  -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  -e ADMIN_USERNAME=admin \
  -e DATABASE_URL=sqlite:///./data/sliverui.db \
  -e SLIVER_CONFIG=/app/config/operator.cfg \
  -e LOG_LEVEL=INFO \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/logs:/app/logs" \
  -v "$(pwd)/config:/app/config:ro" \
  ghcr.io/0xmanhnv/sliver-ui:latest
```

### Step 4 - Run Nginx (TLS termination)

```bash
docker run -d \
  --name sliverui-nginx \
  --network host \
  --restart unless-stopped \
  -v "$(pwd)/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" \
  -v "$(pwd)/certs:/etc/nginx/ssl:ro" \
  -v "$(pwd)/logs/nginx:/var/log/nginx" \
  nginx:alpine
```

### Step 5 - Verify

```bash
curl -f http://localhost:8000/health
# Open https://<your-server-ip> in browser
```

### Useful commands

```bash
# View logs
docker logs -f sliver-ui
docker logs -f sliverui-nginx

# Restart
docker restart sliver-ui sliverui-nginx

# Stop and remove
docker stop sliver-ui sliverui-nginx
docker rm sliver-ui sliverui-nginx

# Update to new version
docker pull ghcr.io/0xmanhnv/sliver-ui:latest
docker stop sliver-ui && docker rm sliver-ui
# Re-run the "docker run" command from Step 3
```

---

## Development

### Docker dev environment (hot-reload)

```bash
make dev          # Start frontend + backend + redis with hot-reload
make logs         # Tail all dev logs
make logs-be      # Backend logs only
make logs-fe      # Frontend logs only
make dev-down     # Stop dev environment
```

Access:
- Frontend: `http://localhost:443` (port 443 mapped from Vite :5173, plain HTTP)
- Backend API: `http://localhost:8000`

### Local development (no Docker)

```bash
# Terminal 1 - Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend
npm install
npm run dev
```

### Tests and linting

```bash
make test         # Run all tests (backend + frontend)
make test-be      # Backend tests with coverage
make test-fe      # Frontend tests
make lint         # Check style
make lint-fix     # Auto-fix style issues
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECRET_KEY` | Yes | - | JWT signing key (min 32 chars) |
| `ADMIN_PASSWORD` | Yes | - | Password for the initial admin account |
| `ADMIN_USERNAME` | No | `admin` | Username for the initial admin account |
| `DATABASE_URL` | No | `sqlite:///./data/sliverui.db` | Database connection string |
| `SLIVER_CONFIG` | No | `/app/config/operator.cfg` | Path to Sliver operator config inside container |
| `LOG_LEVEL` | No | `INFO` | Logging level (DEBUG, INFO, WARNING, ERROR) |
| `GITHUB_TOKEN` | No | - | GitHub token for armory (raises rate limit from 60 to 5000 req/hour) |
| `APP_ENV` | No | `production` | Set to `development` to enable API docs |

---

## Container Management

### Common operations

```bash
make up           # Start production containers
make down         # Stop production containers
make restart      # Restart all containers
make status       # Show container status + health check
make prod-logs    # Tail production logs
```

### Database

```bash
make db-migrate   # Apply pending Alembic migrations
make db-rollback  # Rollback the last migration
```

### Shell access

```bash
make shell-be     # Bash shell inside the sliver-ui container
```

### Backup

```bash
make backup       # Snapshot the SQLite database to backups/
```

---

## Directory Structure

```
sliver-ui/
├── Dockerfile              # Unified multi-stage build (frontend + backend)
├── docker-compose.yml      # Production: sliver-ui + nginx
├── docker-compose.hub.yml  # Production: pull pre-built image + nginx
├── docker-compose.dev.yml  # Development: backend + frontend + redis
├── Makefile                # Make targets for common operations
├── .env.example            # Template for environment variables
├── backend/
│   ├── Dockerfile          # Backend-only image (standalone / dev)
│   ├── Dockerfile.dev      # Backend dev image (hot-reload)
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/            # Database migrations
│   └── app/                # FastAPI application
│       ├── main.py
│       ├── api/v1/         # REST API routes
│       ├── models/         # SQLAlchemy models
│       ├── schemas/        # Pydantic schemas
│       ├── services/       # Business logic
│       └── middleware/      # Rate limiting, etc.
├── frontend/
│   ├── Dockerfile          # Frontend-only image (standalone / dev)
│   ├── Dockerfile.dev      # Frontend dev image (hot-reload)
│   ├── package.json
│   └── src/                # React + TypeScript + TailwindCSS
├── nginx/
│   └── nginx.conf          # Nginx config (TLS + reverse proxy)
├── certs/                  # SSL certificates (cert.pem, key.pem) - mounted into nginx
├── config/                 # Sliver operator config (operator.cfg) - mounted read-only
├── data/                   # SQLite database (sliverui.db) - persistent volume
├── logs/                   # Application logs
└── logs/nginx/             # Nginx access/error logs
```

---

## User Roles

| Role | Permissions |
|------|-------------|
| **admin** | Full access: user management, settings, all operations |
| **operator** | Sessions, beacons, implants, listeners, browser ops |
| **viewer** | Read-only: dashboard, view sessions and beacons |

---

## API Documentation

Available when `APP_ENV=development`:

- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc

---

## Troubleshooting

### Sliver connection fails

```bash
# Check if operator config is valid
docker compose exec sliver-ui python -c "
from sliver import SliverClientConfig
cfg = SliverClientConfig.parse_config_file('/app/config/operator.cfg')
print(f'Target: {cfg.host}:{cfg.port}')
"

# Test live connection
docker compose exec sliver-ui python -c "
import asyncio
from app.services.sliver_client import sliver_manager
asyncio.run(sliver_manager.connect())
print('OK' if sliver_manager.is_connected else 'FAIL')
"
```

Common causes:
- Sliver server not reachable over WireGuard / VPN
- Operator config expired or generated for a different server
- Sliver DB was reset (all operator configs become invalid)

### Database reset

```bash
rm data/sliverui.db
make down && make up
# Database is recreated automatically on startup
```

### Container won't start

```bash
docker compose logs -f sliver-ui    # Check backend logs
docker compose logs -f nginx        # Check nginx logs

# Full rebuild
docker compose build --no-cache
docker compose up -d
```

### Port conflicts

Both containers use `network_mode: host`. Check for conflicts on ports **80**, **443** (nginx) and **8000** (sliver-ui):

```bash
ss -tlnp | grep -E ':(80|443|8000)\b'
```

---

## Make Targets Reference

| Target | Description |
|--------|-------------|
| `make help` | Show all available targets |
| `make setup` | Create directories, copy example configs |
| `make build` | Build unified production image |
| `make up` | Start production stack |
| `make down` | Stop production stack |
| `make restart` | Restart all containers |
| `make status` | Show container status + health |
| `make prod-logs` | Tail production logs |
| `make dev` | Start dev environment (hot-reload) |
| `make dev-d` | Start dev environment (detached) |
| `make dev-down` | Stop dev environment |
| `make logs` | Tail dev logs |
| `make logs-be` | Tail backend dev logs |
| `make logs-fe` | Tail frontend dev logs |
| `make db-migrate` | Run Alembic migrations |
| `make db-rollback` | Rollback last migration |
| `make shell-be` | Shell into sliver-ui container |
| `make shell-fe` | Shell into frontend dev container |
| `make test` | Run all tests |
| `make test-be` | Backend tests with coverage |
| `make test-fe` | Frontend tests |
| `make lint` | Check code style |
| `make lint-fix` | Auto-fix code style |
| `make ssl-gen` | Generate self-signed SSL cert |
| `make backup` | Backup SQLite database |
| `make clean` | Remove containers, volumes, caches |

---

## Security Notes

1. Always set a strong `SECRET_KEY` and `ADMIN_PASSWORD` before deploying
2. Use valid SSL certificates in production (not self-signed)
3. Restrict network access - only expose nginx to trusted networks
4. Review audit logs regularly via the UI
5. If the Sliver DB is reset, all operator configs become invalid - regenerate them

---

## License

For authorized security testing and research only.

## Credits

- [Sliver C2](https://github.com/BishopFox/sliver) by BishopFox
- [SliverPy](https://github.com/moloch--/sliver-py) - Python client bindings
- [FastAPI](https://fastapi.tiangolo.com/) - Backend framework
- [React](https://react.dev/) + [TailwindCSS](https://tailwindcss.com/) - Frontend
