"""
Implant generation schemas
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class C2Config(BaseModel):
    """C2 configuration for implant"""

    protocol: str = Field(..., pattern="^(mtls|https|http|dns|wg)$")
    host: str = Field(..., min_length=1)
    port: int = Field(..., ge=1, le=65535)


class ImplantGenerateRequest(BaseModel):
    """Request to generate an implant"""

    # Basic config
    name: str = Field(..., min_length=1, max_length=100, pattern="^[a-zA-Z0-9_-]+$")
    os: str = Field(..., pattern="^(windows|linux|darwin)$")
    arch: str = Field(..., pattern="^(amd64|386|arm|arm64)$")
    format: str = Field(
        default="exe",
        pattern="^(exe|dll|shellcode|shared|service)$",
    )

    # C2 config
    c2: List[C2Config] = Field(..., min_length=1, max_length=5)

    # Beacon config (optional, if not set creates session implant)
    beacon: bool = Field(default=False, description="Generate beacon instead of session")
    interval: int = Field(default=60, ge=1, le=86400, description="Beacon interval in seconds")
    jitter: int = Field(default=30, ge=0, le=100, description="Jitter percentage")

    # Evasion options
    debug: bool = Field(default=False, description="Include debug info")
    evasion: bool = Field(default=True, description="Enable evasion features")
    skip_symbols: bool = Field(default=False, description="Skip symbol obfuscation")
    disable_sgn: bool = Field(default=False, description="Disable SGN encoding")

    # Limits (optional)
    limit_domain: Optional[str] = Field(None, description="Limit to domain")
    limit_hostname: Optional[str] = Field(None, description="Limit to hostname")
    limit_username: Optional[str] = Field(None, description="Limit to username")
    limit_datetime: Optional[str] = Field(None, description="Limit execution after datetime")
    limit_file_exists: Optional[str] = Field(None, description="Only run if file exists")

    # Max errors before exit
    max_errors: int = Field(default=10, ge=1, le=1000)

    # Reconnect interval
    reconnect_interval: int = Field(default=60, ge=1, le=86400)


class ImplantResponse(BaseModel):
    """Generated implant response"""

    name: str
    filename: str
    os: str
    arch: str
    format: str
    size: int = Field(..., description="File size in bytes")
    md5: str
    sha256: str
    generated_at: datetime
    download_url: str


class ImplantList(BaseModel):
    """List of implants"""

    implants: List[ImplantResponse]
    total: int


class ImplantProfile(BaseModel):
    """Saved implant generation profile"""

    name: str
    description: Optional[str] = None
    config: ImplantGenerateRequest
    created_at: datetime
    updated_at: datetime


class ImplantProfileList(BaseModel):
    """List of implant profiles"""

    profiles: List[ImplantProfile]
    total: int
