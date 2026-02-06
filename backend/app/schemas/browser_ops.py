"""
Browser operations schemas for cookie extraction, proxy, and CDP debugging
"""

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

# CDP connections are only allowed to the local machine to prevent SSRF
ALLOWED_CDP_HOSTS = {"127.0.0.1", "localhost", "::1"}

# ═══════════════════════════════════════════════════════════════════════════
# Cookie Extraction
# ═══════════════════════════════════════════════════════════════════════════


class ExtractCookiesRequest(BaseModel):
    """Request to extract cookies from target browser"""

    session_id: str = Field(..., description="Sliver session ID")
    browser: Literal["chrome", "edge", "firefox"] = Field(
        default="chrome", description="Target browser"
    )
    method: Literal[
        "sharp_chromium", "sharp_dpapi", "cookie_monster", "manual_shell"
    ] = Field(default="sharp_chromium", description="Extraction method")
    target_domain: Optional[str] = Field(None, description="Filter cookies by domain")
    assembly_path: Optional[str] = Field(
        None, description="Custom assembly path (overrides default)"
    )
    timeout: int = Field(default=300, ge=30, le=3600, description="Timeout in seconds")


class CookieItem(BaseModel):
    """Single browser cookie"""

    id: Optional[int] = None
    domain: str
    name: str
    value: str
    path: str = "/"
    expires: Optional[str] = None
    secure: bool = False
    http_only: bool = False
    same_site: Optional[str] = None


class ExtractCookiesResponse(BaseModel):
    """Response from cookie extraction"""

    cookies: List[CookieItem]
    raw_output: str
    browser: str
    method: str
    session_id: str
    hostname: str = ""
    extracted_at: str
    count: int


class CookieListResponse(BaseModel):
    """Response for cookie listing"""

    cookies: List[CookieItem]
    total: int


class ExportCookiesRequest(BaseModel):
    """Request to export cookies in a specific format"""

    cookie_ids: List[int] = Field(
        default=[], description="Specific cookie IDs to export (empty = all)"
    )
    session_id: Optional[str] = Field(None, description="Filter by session")
    domain_filter: Optional[str] = Field(None, description="Filter by domain")
    format: Literal["netscape", "json", "editthiscookie", "header"] = Field(
        default="netscape", description="Export format"
    )


class ExportCookiesResponse(BaseModel):
    """Exported cookie data"""

    content: str
    filename: str
    content_type: str
    format: str
    count: int


# ═══════════════════════════════════════════════════════════════════════════
# SOCKS Proxy
# ═══════════════════════════════════════════════════════════════════════════


class StartProxyRequest(BaseModel):
    """Request to start SOCKS5 proxy through session"""

    session_id: str = Field(..., description="Sliver session ID")
    port: int = Field(default=1080, ge=1024, le=65535, description="Local proxy port")


class StartProxyResponse(BaseModel):
    """Response with proxy details and browser configs"""

    tunnel_id: int
    host: str
    port: int
    proxy_pac: str = ""
    browser_launch_cmd: str = ""
    foxyproxy_config: str = ""
    curl_example: str = ""


class StopProxyRequest(BaseModel):
    """Request to stop SOCKS5 proxy"""

    session_id: str
    tunnel_id: int


# ═══════════════════════════════════════════════════════════════════════════
# CDP Remote Debugging
# ═══════════════════════════════════════════════════════════════════════════


class StartCDPRequest(BaseModel):
    """Request to set up CDP remote debugging port forward"""

    session_id: str = Field(..., description="Sliver session ID")
    remote_port: int = Field(
        default=9222, ge=1024, le=65535, description="Remote Chrome debug port"
    )
    local_port: int = Field(
        default=9222, ge=1024, le=65535, description="Local port to forward to"
    )


class StartCDPResponse(BaseModel):
    """Response with CDP connection details"""

    tunnel_id: int
    local_url: str
    devtools_frontend: str = ""
    ws_debug_url: str = ""
    json_url: str


class StopCDPRequest(BaseModel):
    """Request to stop CDP port forward"""

    session_id: str
    tunnel_id: int


# ═══════════════════════════════════════════════════════════════════════════
# Browser Detection & Profile
# ═══════════════════════════════════════════════════════════════════════════


class BrowserInfo(BaseModel):
    """Detected browser on target"""

    name: str
    browser_type: str
    version: Optional[str] = None
    exe_path: str = ""
    running: bool = False
    pid: Optional[int] = None
    profiles: List[str] = []
    cookie_path: str = ""


class BrowserInfoResponse(BaseModel):
    """Response with detected browsers"""

    browsers: List[BrowserInfo]
    os: str = ""
    hostname: str = ""


class DownloadProfileRequest(BaseModel):
    """Request to download browser profile files"""

    session_id: str = Field(..., description="Sliver session ID")
    browser: Literal["chrome", "edge", "firefox"] = "chrome"
    profile_name: str = Field(default="Default", description="Browser profile name")


class ProfileFileInfo(BaseModel):
    """Downloaded profile file info"""

    name: str
    size: int
    local_path: str


class DownloadProfileResponse(BaseModel):
    """Response with downloaded profile files"""

    files: List[ProfileFileInfo]
    browser: str
    profile_name: str
    session_id: str
    local_dir: str = ""
    zip_url: str = ""
    launch_commands: dict = {}


# ═══════════════════════════════════════════════════════════════════════════
# CDP Cookie Injection
# ═══════════════════════════════════════════════════════════════════════════


class InjectCookiesRequest(BaseModel):
    """Request to inject cookies into a local browser via CDP"""

    host: str = Field(default="127.0.0.1", description="CDP host (localhost only)")
    port: int = Field(default=9222, ge=1, le=65535, description="CDP port")
    cookie_ids: List[int] = Field(..., min_length=1, description="Cookie IDs to inject")
    url: Optional[str] = Field(None, description="Navigate to URL after injection")

    @field_validator("host")
    @classmethod
    def validate_host_is_local(cls, v: str) -> str:
        if v not in ALLOWED_CDP_HOSTS:
            raise ValueError(
                f"CDP host must be one of {sorted(ALLOWED_CDP_HOSTS)} to prevent SSRF"
            )
        return v


class InjectCookiesResponse(BaseModel):
    """Result of CDP cookie injection"""

    injected: int
    failed: int
    errors: List[str] = []
    navigate_url: Optional[str] = None


class CDPTarget(BaseModel):
    """A Chrome DevTools Protocol target (tab/page)"""

    id: str
    title: str = ""
    url: str = ""
    type: str = ""
    webSocketDebuggerUrl: str = ""


class CDPTargetsResponse(BaseModel):
    """Response listing CDP targets"""

    targets: List[CDPTarget]
    host: str
    port: int


# ═══════════════════════════════════════════════════════════════════════════
# Playwright Automation
# ═══════════════════════════════════════════════════════════════════════════


class StartAutomationRequest(BaseModel):
    """Request to start a headless browser automation session"""

    cookie_ids: List[int] = Field(..., min_length=1, description="Cookies to inject")
    url: Optional[str] = Field(None, description="Initial URL to navigate to")
    user_agent: Optional[str] = Field(None, description="Custom User-Agent")
    viewport_width: int = Field(default=1920, ge=800, le=3840)
    viewport_height: int = Field(default=1080, ge=600, le=2160)
    proxy: Optional[str] = Field(
        None, description="Proxy URL (e.g. socks5://127.0.0.1:1080)"
    )


class StartAutomationResponse(BaseModel):
    """Response from starting automation session"""

    automation_id: str
    screenshot: Optional[str] = None
    page_title: Optional[str] = None
    page_url: Optional[str] = None


class NavigateRequest(BaseModel):
    """Request to navigate in an automation session"""

    automation_id: str
    url: str
    wait_for: Literal["load", "networkidle", "domcontentloaded"] = "load"
    screenshot: bool = True


class NavigateResponse(BaseModel):
    """Response from navigation"""

    title: str = ""
    url: str = ""
    screenshot: Optional[str] = None


class ScreenshotRequest(BaseModel):
    """Request for a screenshot"""

    automation_id: str
    full_page: bool = False


class ScreenshotResponse(BaseModel):
    """Screenshot result"""

    screenshot: str
    width: int
    height: int


class ExecuteJSRequest(BaseModel):
    """Request to execute JavaScript in page context"""

    automation_id: str
    script: str = Field(..., max_length=10000, description="JavaScript to evaluate")


class ExecuteJSResponse(BaseModel):
    """JavaScript execution result"""

    result: Optional[str] = None
    error: Optional[str] = None


class AutomationCookiesResponse(BaseModel):
    """Cookies from automation browser context"""

    cookies: List[CookieItem]
    count: int


class StopAutomationRequest(BaseModel):
    """Request to stop an automation session"""

    automation_id: str
