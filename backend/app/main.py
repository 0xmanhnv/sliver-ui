"""
SliverUI - Main FastAPI Application
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.core.config import settings
from app.core.exceptions import (
    SliverUIException,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    RateLimitError,
)
from app.api.v1 import api_router
from app.api.websocket import websocket_router
from app.services.database import init_db, close_db
from app.services.sliver_client import sliver_manager

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """Application lifespan manager"""
    # Startup
    logger.info(f"Starting {settings.app_name} v{__version__}")

    # Initialize database
    await init_db()
    logger.info("Database initialized")

    # Connect to Sliver (if config provided)
    if settings.sliver_config:
        try:
            await sliver_manager.connect()
            logger.info("Connected to Sliver server")
        except Exception as e:
            logger.warning(f"Failed to connect to Sliver: {e}")

    yield

    # Shutdown
    logger.info("Shutting down...")

    # Disconnect from Sliver
    await sliver_manager.disconnect()

    # Close database
    await close_db()


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    description="Web GUI for Sliver C2 Framework",
    version=__version__,
    docs_url="/api/docs" if settings.debug else None,
    redoc_url="/api/redoc" if settings.debug else None,
    openapi_url="/api/openapi.json" if settings.debug else None,
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handlers
@app.exception_handler(AuthenticationError)
async def authentication_error_handler(request: Request, exc: AuthenticationError):
    return JSONResponse(
        status_code=401,
        content={"error": "Authentication failed", "detail": exc.message},
    )


@app.exception_handler(AuthorizationError)
async def authorization_error_handler(request: Request, exc: AuthorizationError):
    return JSONResponse(
        status_code=403,
        content={"error": "Access denied", "detail": exc.message},
    )


@app.exception_handler(NotFoundError)
async def not_found_error_handler(request: Request, exc: NotFoundError):
    return JSONResponse(
        status_code=404,
        content={"error": "Not found", "detail": exc.message},
    )


@app.exception_handler(RateLimitError)
async def rate_limit_error_handler(request: Request, exc: RateLimitError):
    return JSONResponse(
        status_code=429,
        content={"error": "Rate limit exceeded", "detail": exc.message},
    )


@app.exception_handler(SliverUIException)
async def sliverui_error_handler(request: Request, exc: SliverUIException):
    return JSONResponse(
        status_code=500,
        content={"error": "Internal error", "detail": exc.message},
    )


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "version": __version__,
        "sliver_connected": sliver_manager.is_connected,
    }


# Include routers
app.include_router(api_router, prefix=settings.api_v1_prefix)
app.include_router(websocket_router)


# Root redirect
@app.get("/")
async def root():
    return {"message": f"Welcome to {settings.app_name}", "version": __version__}
