# =============================================================================
# SliverUI Unified Dockerfile (Frontend + Backend)
# =============================================================================
# Multi-stage build producing a single image with:
#   - Vite-built frontend static files
#   - FastAPI backend serving API + SPA
#   - Playwright + Chromium for browser automation
#   - sliver-client binary for armory operations
#
# Usage:
#   docker compose build
#   docker compose up -d
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Build frontend
# ---------------------------------------------------------------------------
FROM node:24-alpine AS frontend-builder

WORKDIR /build

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: Install Python dependencies
# ---------------------------------------------------------------------------
FROM python:3.14-slim AS backend-builder

WORKDIR /build

# Install sliver-client binary
ARG SLIVER_VERSION=v1.6.10
ARG TARGETARCH=amd64
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && curl -fSL "https://github.com/BishopFox/sliver/releases/download/${SLIVER_VERSION}/sliver-client_linux-${TARGETARCH}" \
       -o /usr/local/bin/sliver-client \
    && chmod +x /usr/local/bin/sliver-client \
    && /usr/local/bin/sliver-client version \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps into a virtual env for clean copy
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ---------------------------------------------------------------------------
# Stage 3: Final production image
# ---------------------------------------------------------------------------
FROM python:3.14-slim

WORKDIR /app

# Install runtime system deps (curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual env and sliver-client from builders
COPY --from=backend-builder /opt/venv /opt/venv
COPY --from=backend-builder /usr/local/bin/sliver-client /usr/local/bin/sliver-client
ENV PATH="/opt/venv/bin:$PATH"

# Install Playwright browser (headless Chromium for automation)
RUN playwright install --with-deps chromium

# Copy backend application code
COPY backend/app/ ./app/
COPY backend/alembic/ ./alembic/
COPY backend/alembic.ini .

# Copy frontend build output → /app/static/
COPY --from=frontend-builder /build/dist/ ./static/

# Create non-root user with home directory for sliver-client config
RUN useradd -m -u 1000 sliverui && \
    mkdir -p /app/data /home/sliverui/.sliver-client/configs && \
    chown -R sliverui:sliverui /app /home/sliverui

USER sliverui

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000"]
