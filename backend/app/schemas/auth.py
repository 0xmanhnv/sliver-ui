"""
Authentication schemas
"""

from typing import Optional

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    """Login request schema"""

    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)


class RefreshRequest(BaseModel):
    """Token refresh request"""

    refresh_token: str


class Token(BaseModel):
    """JWT token response"""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Token expiry in seconds")


class TokenPayload(BaseModel):
    """JWT token payload"""

    sub: str  # User ID
    exp: int  # Expiry timestamp
    iat: int  # Issued at timestamp
    type: str  # Token type (access/refresh)
    role: Optional[str] = None  # User role
