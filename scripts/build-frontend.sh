#!/bin/bash
# Build frontend and extract static files for production deployment
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Building frontend..."
cd "$PROJECT_DIR"

# Build frontend Docker image
docker build -t sliverui-frontend-builder ./frontend

# Create temporary container and extract static files
docker create --name temp-frontend sliverui-frontend-builder
rm -rf "$PROJECT_DIR/static"
docker cp temp-frontend:/usr/share/nginx/html "$PROJECT_DIR/static"
docker rm temp-frontend

echo "Static files extracted to $PROJECT_DIR/static/"
ls -la "$PROJECT_DIR/static/"
