# Production Dockerfile for SliverUI Backend
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Download and install sliver-client for armory operations
# sliver-py doesn't support armory, so we use CLI as workaround
# Using hardcoded version to avoid GitHub API rate limits during build
ARG SLIVER_VERSION=v1.6.10
RUN echo "Downloading sliver-client ${SLIVER_VERSION}..." \
    && curl -fSL "https://github.com/BishopFox/sliver/releases/download/${SLIVER_VERSION}/sliver-client_linux-amd64" -o /usr/local/bin/sliver-client \
    && chmod +x /usr/local/bin/sliver-client \
    && /usr/local/bin/sliver-client version

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .

# Create non-root user with home directory for sliver-client config
RUN useradd -m -u 1000 sliverui && \
    mkdir -p /app/data /home/sliverui/.sliver-client/configs && \
    chown -R sliverui:sliverui /app /home/sliverui

USER sliverui

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run with gunicorn for production
CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000"]
