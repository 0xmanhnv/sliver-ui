"""
Simple in-memory rate limiter middleware for sensitive endpoints
"""

import time
import logging
from collections import defaultdict
from typing import Dict, Tuple

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# Rate limit config per path prefix
RATE_LIMITS: Dict[str, Tuple[int, int]] = {
    "/api/v1/auth/login": (5, 60),      # 5 requests per 60s
    "/api/v1/auth/refresh": (10, 60),    # 10 requests per 60s
}

# Default rate limit for all other API endpoints
DEFAULT_RATE_LIMIT = (60, 60)  # 60 requests per 60s


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Token bucket rate limiter keyed by client IP + path"""

    def __init__(self, app):
        super().__init__(app)
        # {(ip, path_key): [timestamps]}
        self._requests: Dict[str, list] = defaultdict(list)
        self._last_cleanup = time.monotonic()

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _get_rate_limit(self, path: str) -> Tuple[int, int]:
        for prefix, limit in RATE_LIMITS.items():
            if path.startswith(prefix):
                return limit
        if path.startswith("/api/"):
            return DEFAULT_RATE_LIMIT
        return (0, 0)  # No limit for non-API paths

    def _cleanup(self):
        """Remove expired entries every 5 minutes"""
        now = time.monotonic()
        if now - self._last_cleanup < 300:
            return
        self._last_cleanup = now
        expired_keys = [
            k for k, v in self._requests.items()
            if not v or v[-1] < now - 120
        ]
        for k in expired_keys:
            del self._requests[k]

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        max_requests, window = self._get_rate_limit(path)

        if max_requests == 0:
            return await call_next(request)

        client_ip = self._get_client_ip(request)
        key = f"{client_ip}:{path}"
        now = time.monotonic()

        # Clean old timestamps
        self._requests[key] = [
            t for t in self._requests[key] if t > now - window
        ]

        if len(self._requests[key]) >= max_requests:
            logger.warning(f"Rate limit exceeded: {client_ip} on {path}")
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded",
                    "detail": f"Too many requests. Try again in {window}s",
                },
                headers={"Retry-After": str(window)},
            )

        self._requests[key].append(now)

        # Periodic cleanup
        self._cleanup()

        return await call_next(request)
