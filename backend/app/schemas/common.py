"""
Common schemas used across the application
"""

from typing import Any, Generic, List, Optional, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class MessageResponse(BaseModel):
    """Simple message response"""

    message: str
    success: bool = True


class ErrorResponse(BaseModel):
    """Error response"""

    error: str
    detail: Optional[str] = None
    code: Optional[str] = None


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated response wrapper"""

    items: List[T]
    total: int
    page: int = 1
    page_size: int = 50
    pages: int = 1

    @classmethod
    def create(
        cls, items: List[T], total: int, page: int = 1, page_size: int = 50
    ) -> "PaginatedResponse[T]":
        pages = (total + page_size - 1) // page_size if page_size > 0 else 1
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
        )


class HealthResponse(BaseModel):
    """Health check response"""

    status: str = "ok"
    version: str
    sliver_connected: bool = False
    database: str = "ok"
    redis: str = "ok"
