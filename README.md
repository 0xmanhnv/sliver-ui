# SliverUI

Web-based GUI for [Sliver C2 Framework](https://github.com/BishopFox/sliver).

## Features

- **Dashboard** - Real-time overview of sessions, beacons, and listeners
- **Session Management** - Interactive shell, file browser, process list
- **Beacon Management** - View and manage beacon callbacks
- **Implant Builder** - Visual form-based implant generation
- **Listener Management** - Start/stop listeners with one click
- **Multi-user Support** - Role-based access control (RBAC)
- **Audit Logging** - Track all operator actions

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Sliver server running with operator config
- SSL certificates (self-signed or valid)

### Setup

```bash
# Clone and enter directory
cd sliver-gui

# Initial setup
make setup

# Generate self-signed SSL (development only)
make ssl-gen

# Copy your Sliver operator config
cp /path/to/operator.cfg config/

# Edit configuration
nano .env

# Start development environment
make dev
```

### Access

- **Development**: http://localhost:5173
- **Production**: https://localhost:8443

**Default credentials:**
- Username: `admin`
- Password: `changeme123`

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│                    (React + TailwindCSS)                     │
└─────────────────────────────┬───────────────────────────────┘
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Nginx (TLS)                            │
└─────────────────────────────┬───────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│   FastAPI Backend       │     │    React Frontend       │
│   (Python + SliverPy)   │     │    (Static files)       │
└────────────┬────────────┘     └─────────────────────────┘
             │
             │ gRPC (mTLS)
             ▼
┌─────────────────────────────────────────────────────────────┐
│                      Sliver Server                           │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | JWT signing key | (required) |
| `DATABASE_URL` | SQLite database path | `sqlite:///./data/sliverui.db` |
| `REDIS_URL` | Redis connection URL | `redis://redis:6379/0` |
| `SLIVER_CONFIG` | Path to operator.cfg | `/app/config/operator.cfg` |
| `JWT_EXPIRE_MINUTES` | Token expiry | `60` |
| `CORS_ORIGINS` | Allowed origins | `http://localhost:5173` |

### Sliver Operator Config

Generate an operator config from your Sliver server:

```bash
# On Sliver server
sliver > new-operator --name sliverui --lhost your-server-ip

# Copy the generated .cfg file to config/operator.cfg
```

## Development

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements-dev.txt

# Run development server
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

### Running Tests

```bash
# All tests
make test

# Backend only
make test-be

# Frontend only
make test-fe
```

## Production Deployment

### 1. Configure Environment

```bash
# Copy and edit .env
cp .env.example .env
nano .env

# Set a strong SECRET_KEY
SECRET_KEY=$(openssl rand -hex 32)
```

### 2. SSL Certificates

```bash
# Option A: Self-signed (testing only)
make ssl-gen

# Option B: Let's Encrypt
certbot certonly --standalone -d your-domain.com
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem
```

### 3. Deploy

```bash
# Build and start
make build
make up

# Check status
make status
docker-compose logs -f
```

### 4. Post-deployment

```bash
# Change default admin password immediately!
# Login to UI and go to Settings

# Or via CLI
docker-compose exec backend python -c "
from app.services.database import async_session_maker
from app.models import User
from app.core.security import get_password_hash
import asyncio

async def change_password():
    async with async_session_maker() as session:
        result = await session.execute(
            select(User).where(User.username == 'admin')
        )
        user = result.scalar_one()
        user.password_hash = get_password_hash('YOUR_NEW_PASSWORD')
        await session.commit()

asyncio.run(change_password())
"
```

## User Roles

| Role | Permissions |
|------|-------------|
| **admin** | Full access, user management |
| **operator** | Sessions, beacons, implants, listeners |
| **viewer** | Read-only access |

## API Documentation

When running in development mode, API docs are available at:

- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc
- OpenAPI JSON: http://localhost:8000/api/openapi.json

## Security Considerations

1. **Change default credentials** immediately after deployment
2. **Use strong SECRET_KEY** (at least 32 random characters)
3. **Use valid SSL certificates** in production
4. **Restrict network access** to trusted IPs only
5. **Enable audit logging** and review regularly
6. **Keep Sliver and SliverUI updated**

## Troubleshooting

### Cannot connect to Sliver

```bash
# Check if operator config is valid
docker-compose exec backend python -c "
from sliver import SliverClientConfig
config = SliverClientConfig.parse_config_file('/app/config/operator.cfg')
print(f'Server: {config.host}:{config.port}')
"

# Check connectivity
docker-compose exec backend python -c "
import asyncio
from app.services.sliver_client import sliver_manager
asyncio.run(sliver_manager.connect())
print('Connected!' if sliver_manager.is_connected else 'Failed')
"
```

### Database issues

```bash
# Reset database
rm data/sqlite/sliverui.db
make up

# The database will be recreated with default admin user
```

### Container issues

```bash
# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Rebuild containers
docker-compose build --no-cache
docker-compose up -d
```

## License

This project is for authorized security testing only.

## Credits

- [Sliver](https://github.com/BishopFox/sliver) by BishopFox
- [SliverPy](https://github.com/moloch--/sliver-py) for Python bindings
- [FastAPI](https://fastapi.tiangolo.com/) for the backend framework
- [React](https://react.dev/) + [TailwindCSS](https://tailwindcss.com/) for the frontend
