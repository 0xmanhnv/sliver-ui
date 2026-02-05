"""Pydantic schemas for request/response validation"""

from .auth import (
    Token,
    TokenPayload,
    LoginRequest,
    RefreshRequest,
)
from .user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserList,
    RoleResponse,
)
from .session import (
    SessionResponse,
    SessionList,
    SessionInfo,
    ShellRequest,
    ShellResponse,
    ExecuteRequest,
    ExecuteResponse,
)
from .beacon import (
    BeaconResponse,
    BeaconList,
    BeaconTaskRequest,
    BeaconTaskResponse,
)
from .implant import (
    ImplantGenerateRequest,
    ImplantResponse,
    ImplantList,
    ImplantProfile,
)
from .listener import (
    ListenerResponse,
    ListenerList,
    MTLSListenerRequest,
    HTTPSListenerRequest,
    HTTPListenerRequest,
    DNSListenerRequest,
)
from .common import (
    MessageResponse,
    ErrorResponse,
    PaginatedResponse,
)

__all__ = [
    # Auth
    "Token",
    "TokenPayload",
    "LoginRequest",
    "RefreshRequest",
    # User
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "UserList",
    "RoleResponse",
    # Session
    "SessionResponse",
    "SessionList",
    "SessionInfo",
    "ShellRequest",
    "ShellResponse",
    "ExecuteRequest",
    "ExecuteResponse",
    # Beacon
    "BeaconResponse",
    "BeaconList",
    "BeaconTaskRequest",
    "BeaconTaskResponse",
    # Implant
    "ImplantGenerateRequest",
    "ImplantResponse",
    "ImplantList",
    "ImplantProfile",
    # Listener
    "ListenerResponse",
    "ListenerList",
    "MTLSListenerRequest",
    "HTTPSListenerRequest",
    "HTTPListenerRequest",
    "DNSListenerRequest",
    # Common
    "MessageResponse",
    "ErrorResponse",
    "PaginatedResponse",
]
