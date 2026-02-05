"""
User schemas
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class RoleResponse(BaseModel):
    """Role response schema"""

    id: int
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class UserBase(BaseModel):
    """Base user schema"""

    username: str = Field(..., min_length=3, max_length=50)
    # Use str instead of EmailStr to allow .local domains for internal deployments
    email: Optional[str] = None


class UserCreate(UserBase):
    """Create user schema"""

    password: str = Field(..., min_length=8, max_length=100)
    role_id: int = Field(default=2, description="Role ID (1=admin, 2=operator, 3=viewer)")


class UserUpdate(BaseModel):
    """Update user schema"""

    username: Optional[str] = Field(None, min_length=3, max_length=50)
    # Use str to allow .local domains for internal deployments
    email: Optional[str] = None
    password: Optional[str] = Field(None, min_length=8, max_length=100)
    role_id: Optional[int] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    """User response schema"""

    id: int
    role: RoleResponse
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserList(BaseModel):
    """User list response"""

    users: List[UserResponse]
    total: int


class CurrentUser(BaseModel):
    """Current user info for /auth/me"""

    id: int
    username: str
    email: Optional[str] = None
    role: str
    permissions: List[str] = []

    class Config:
        from_attributes = True
