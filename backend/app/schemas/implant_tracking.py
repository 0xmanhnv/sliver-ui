"""
Implant tracking schemas
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class TrackedImplantCreate(BaseModel):
    """Create a new tracked implant"""

    name: str = Field(..., min_length=1, max_length=100, pattern="^[a-zA-Z0-9_.-]+$")
    version: str = Field(default="1.0", max_length=32)
    build_date: Optional[datetime] = None
    c2_domains: Optional[List[str]] = None
    deployed_target: Optional[str] = Field(None, max_length=255)
    status: str = Field(
        default="built",
        pattern="^(built|deployed|active|compromised|retired)$",
    )
    notes: Optional[str] = None
    sha256_hash: Optional[str] = Field(None, max_length=64)


class TrackedImplantUpdate(BaseModel):
    """Update a tracked implant"""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    version: Optional[str] = Field(None, max_length=32)
    build_date: Optional[datetime] = None
    c2_domains: Optional[List[str]] = None
    deployed_target: Optional[str] = Field(None, max_length=255)
    status: Optional[str] = Field(
        None,
        pattern="^(built|deployed|active|compromised|retired)$",
    )
    notes: Optional[str] = None
    sha256_hash: Optional[str] = Field(None, max_length=64)


class TrackedImplantResponse(BaseModel):
    """Tracked implant response"""

    id: int
    name: str
    version: str
    build_date: Optional[datetime] = None
    c2_domains: Optional[List[str]] = None
    deployed_target: Optional[str] = None
    status: str
    notes: Optional[str] = None
    sha256_hash: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TrackedImplantList(BaseModel):
    """List of tracked implants"""

    implants: List[TrackedImplantResponse]
    total: int
