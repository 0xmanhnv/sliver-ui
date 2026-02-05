"""
Listener schemas
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class ListenerResponse(BaseModel):
    """Listener response"""

    id: str = Field(..., description="Job/Listener ID")
    name: str = Field(..., description="Listener name")
    protocol: str = Field(..., description="Protocol: mtls, https, http, dns, wg")
    host: str = Field(..., description="Bind address")
    port: int = Field(..., description="Port number")
    started_at: datetime
    # Protocol-specific fields
    domain: Optional[str] = None  # For DNS
    website: Optional[str] = None  # For HTTP(S)
    cert_path: Optional[str] = None  # For HTTPS


class ListenerList(BaseModel):
    """List of listeners"""

    listeners: List[ListenerResponse]
    total: int


class MTLSListenerRequest(BaseModel):
    """Start mTLS listener request"""

    host: str = Field(default="0.0.0.0", description="Bind address")
    port: int = Field(default=31337, ge=1, le=65535)


class HTTPSListenerRequest(BaseModel):
    """Start HTTPS listener request"""

    host: str = Field(default="0.0.0.0", description="Bind address")
    port: int = Field(default=443, ge=1, le=65535)
    domain: Optional[str] = Field(default="", description="Domain for TLS certificate (optional)")
    website: Optional[str] = Field(None, description="Website content to serve")
    # Let's Encrypt options
    letsencrypt: bool = Field(default=False, description="Use Let's Encrypt")
    # Custom cert
    cert: Optional[str] = Field(None, description="Path to certificate")
    key: Optional[str] = Field(None, description="Path to private key")


class HTTPListenerRequest(BaseModel):
    """Start HTTP listener request"""

    host: str = Field(default="0.0.0.0", description="Bind address")
    port: int = Field(default=80, ge=1, le=65535)
    domain: Optional[str] = Field(None, description="Domain")
    website: Optional[str] = Field(None, description="Website content to serve")


class DNSListenerRequest(BaseModel):
    """Start DNS listener request"""

    domains: List[str] = Field(..., min_length=1, description="DNS domains")
    host: str = Field(default="0.0.0.0", description="Bind address")
    port: int = Field(default=53, ge=1, le=65535)
    canaries: bool = Field(default=True, description="Enable canary domains")


class WGListenerRequest(BaseModel):
    """Start WireGuard listener request"""

    host: str = Field(default="0.0.0.0", description="Bind address")
    port: int = Field(default=53, ge=1, le=65535)
    key_port: int = Field(default=1337, ge=1, le=65535, description="Key exchange port")
