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
from .browser_ops import (
    ExtractCookiesRequest,
    ExtractCookiesResponse,
    CookieItem,
    CookieListResponse,
    ExportCookiesRequest,
    ExportCookiesResponse,
    StartProxyRequest,
    StartProxyResponse,
    StopProxyRequest,
    StartCDPRequest,
    StartCDPResponse,
    StopCDPRequest,
    BrowserInfo,
    BrowserInfoResponse,
    DownloadProfileRequest,
    DownloadProfileResponse,
    ProfileFileInfo,
    InjectCookiesRequest,
    InjectCookiesResponse,
    CDPTarget,
    CDPTargetsResponse,
    StartAutomationRequest,
    StartAutomationResponse,
    NavigateRequest,
    NavigateResponse,
    ScreenshotRequest,
    ScreenshotResponse,
    ExecuteJSRequest,
    ExecuteJSResponse,
    AutomationCookiesResponse,
    StopAutomationRequest,
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
    # Browser Ops
    "ExtractCookiesRequest",
    "ExtractCookiesResponse",
    "CookieItem",
    "CookieListResponse",
    "ExportCookiesRequest",
    "ExportCookiesResponse",
    "StartProxyRequest",
    "StartProxyResponse",
    "StopProxyRequest",
    "StartCDPRequest",
    "StartCDPResponse",
    "StopCDPRequest",
    "BrowserInfo",
    "BrowserInfoResponse",
    "DownloadProfileRequest",
    "DownloadProfileResponse",
    "ProfileFileInfo",
    # CDP Cookie Injection
    "InjectCookiesRequest",
    "InjectCookiesResponse",
    "CDPTarget",
    "CDPTargetsResponse",
    # Playwright Automation
    "StartAutomationRequest",
    "StartAutomationResponse",
    "NavigateRequest",
    "NavigateResponse",
    "ScreenshotRequest",
    "ScreenshotResponse",
    "ExecuteJSRequest",
    "ExecuteJSResponse",
    "AutomationCookiesResponse",
    "StopAutomationRequest",
]
