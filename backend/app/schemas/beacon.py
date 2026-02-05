"""
Beacon schemas for Sliver beacons
"""

from datetime import datetime
from typing import List, Optional, Any

from pydantic import BaseModel, Field


class BeaconResponse(BaseModel):
    """Sliver beacon response"""

    id: str = Field(..., description="Beacon ID")
    name: str = Field(..., description="Beacon name")
    hostname: str = Field(..., description="Target hostname")
    username: str = Field(..., description="Target username")
    uid: str = Field(..., description="User ID")
    gid: str = Field(..., description="Group ID")
    os: str = Field(..., description="Operating system")
    arch: str = Field(..., description="Architecture")
    transport: str = Field(..., description="Transport protocol")
    remote_address: str = Field(..., description="Remote address")
    pid: int = Field(..., description="Process ID")
    filename: str = Field(..., description="Implant filename")
    last_checkin: Optional[datetime] = Field(None, description="Last checkin")
    next_checkin: Optional[datetime] = Field(None, description="Expected next checkin")
    interval: int = Field(..., description="Checkin interval in seconds")
    jitter: int = Field(..., description="Jitter percentage")
    active_c2: str = Field(..., description="Active C2 URL")
    tasks_count: int = Field(default=0, description="Pending tasks count")
    tasks_count_completed: int = Field(default=0, description="Completed tasks")


class BeaconList(BaseModel):
    """Beacon list response"""

    beacons: List[BeaconResponse]
    total: int


class BeaconTaskRequest(BaseModel):
    """Request to queue a task for a beacon"""

    task_type: str = Field(..., description="Task type: shell, execute, download, upload, etc.")
    # Shell task
    command: Optional[str] = Field(None, description="Shell command")
    # Execute task
    exe: Optional[str] = Field(None, description="Executable path")
    args: Optional[List[str]] = Field(None, description="Arguments")
    # File tasks
    remote_path: Optional[str] = Field(None, description="Remote file path")
    local_path: Optional[str] = Field(None, description="Local file path")
    # Generic
    timeout: int = Field(default=60, ge=1, le=3600)


class BeaconTaskResponse(BaseModel):
    """Beacon task response"""

    id: str = Field(..., description="Task ID")
    beacon_id: str = Field(..., description="Beacon ID")
    task_type: str = Field(..., description="Task type")
    state: str = Field(..., description="Task state: pending, sent, completed, failed")
    created_at: datetime
    sent_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    request: Optional[dict] = None
    response: Optional[dict] = None
    error: Optional[str] = None


class BeaconTaskList(BaseModel):
    """List of beacon tasks"""

    tasks: List[BeaconTaskResponse]
    total: int
