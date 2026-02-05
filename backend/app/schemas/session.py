"""
Session schemas for Sliver sessions
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class SessionResponse(BaseModel):
    """Sliver session response"""

    id: str = Field(..., description="Session ID")
    name: str = Field(..., description="Session name")
    hostname: str = Field(..., description="Target hostname")
    username: str = Field(..., description="Target username")
    uid: str = Field(..., description="User ID on target")
    gid: str = Field(..., description="Group ID on target")
    os: str = Field(..., description="Operating system")
    arch: str = Field(..., description="Architecture")
    transport: str = Field(..., description="Transport protocol")
    remote_address: str = Field(..., description="Remote IP:Port")
    pid: int = Field(..., description="Process ID")
    filename: str = Field(..., description="Implant filename")
    last_checkin: Optional[datetime] = Field(None, description="Last checkin time")
    active_c2: str = Field(..., description="Active C2 URL")
    reconnect_interval: int = Field(..., description="Reconnect interval in seconds")
    proxy_url: Optional[str] = Field(None, description="Proxy URL if configured")


class SessionList(BaseModel):
    """Session list response"""

    sessions: List[SessionResponse]
    total: int


class SessionInfo(BaseModel):
    """Extended session information"""

    session: SessionResponse
    # Additional system info
    version: Optional[str] = None
    build: Optional[str] = None
    burned: bool = False


class ShellRequest(BaseModel):
    """Shell command execution request"""

    command: str = Field(..., min_length=1, max_length=10000)
    timeout: int = Field(default=60, ge=1, le=3600, description="Timeout in seconds")


class ShellResponse(BaseModel):
    """Shell command response"""

    output: str
    stderr: Optional[str] = None
    exit_code: int = 0
    executed_at: datetime


class ExecuteRequest(BaseModel):
    """Execute binary request"""

    exe: str = Field(..., description="Path to executable")
    args: List[str] = Field(default=[], description="Arguments")
    output: bool = Field(default=True, description="Capture output")


class ExecuteResponse(BaseModel):
    """Execute response"""

    stdout: str = ""
    stderr: str = ""
    status: int = 0
    pid: int = 0


class ProcessInfo(BaseModel):
    """Process information"""

    pid: int
    ppid: int
    executable: str
    owner: str
    architecture: str
    session_id: Optional[int] = None


class ProcessList(BaseModel):
    """Process list response"""

    processes: List[ProcessInfo]
    total: int


class NetworkConnection(BaseModel):
    """Network connection info"""

    local_address: str
    remote_address: str
    state: str
    pid: int
    protocol: str


class NetworkInfo(BaseModel):
    """Network information response"""

    interfaces: List[dict]
    connections: List[NetworkConnection]


class FileInfo(BaseModel):
    """File information"""

    name: str
    is_dir: bool
    size: int
    mode: str
    mod_time: datetime


class DirectoryListing(BaseModel):
    """Directory listing response"""

    path: str
    files: List[FileInfo]
