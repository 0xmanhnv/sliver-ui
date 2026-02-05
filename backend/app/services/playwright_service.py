"""
Playwright Automation Service

Manages headless browser sessions for session replay/hijacking.
Runs headless Chromium inside the Docker container with injected cookies.
"""

import base64
import json
import logging
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class AutomationSession:
    """Tracks a running Playwright browser automation session"""

    session_id: str
    browser: Any = None  # playwright Browser
    context: Any = None  # playwright BrowserContext
    page: Any = None  # playwright Page
    cookies_injected: int = 0
    created_at: str = ""


class PlaywrightService:
    """Manages headless browser automation sessions for session replay"""

    def __init__(self):
        self._sessions: Dict[str, AutomationSession] = {}
        self._playwright: Any = None

    async def _ensure_playwright(self):
        """Lazy-init Playwright instance"""
        if self._playwright is None:
            from playwright.async_api import async_playwright

            pw = await async_playwright().start()
            self._playwright = pw
        return self._playwright

    async def start_session(
        self,
        cookies: List[dict],
        user_agent: Optional[str] = None,
        viewport_width: int = 1920,
        viewport_height: int = 1080,
        proxy: Optional[str] = None,
    ) -> str:
        """
        Start a headless Chromium session with injected cookies.
        Returns an automation_id for subsequent operations.
        """
        pw = await self._ensure_playwright()

        launch_args = ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
        launch_kwargs: dict = {"headless": True, "args": launch_args}

        if proxy:
            launch_kwargs["proxy"] = {"server": proxy}

        browser = await pw.chromium.launch(**launch_kwargs)

        context_kwargs: dict = {
            "viewport": {"width": viewport_width, "height": viewport_height},
            "ignore_https_errors": True,
        }
        if user_agent:
            context_kwargs["user_agent"] = user_agent

        context = await browser.new_context(**context_kwargs)

        # Inject cookies
        pw_cookies = []
        for c in cookies:
            domain = c.get("domain", "")
            clean_domain = domain.lstrip(".")
            scheme = "https" if c.get("secure", False) else "http"

            pw_cookie = {
                "name": c.get("name", ""),
                "value": c.get("value", ""),
                "domain": domain,
                "path": c.get("path", "/"),
                "secure": c.get("secure", False),
                "httpOnly": c.get("http_only", False),
                "url": f"{scheme}://{clean_domain}{c.get('path', '/')}",
            }

            if c.get("same_site"):
                ss = c["same_site"].capitalize()
                if ss in ("Strict", "Lax", "None"):
                    pw_cookie["sameSite"] = ss

            if c.get("expires"):
                try:
                    if str(c["expires"]).isdigit():
                        pw_cookie["expires"] = int(c["expires"])
                    else:
                        from datetime import datetime
                        dt = datetime.fromisoformat(
                            str(c["expires"]).replace("Z", "+00:00")
                        )
                        pw_cookie["expires"] = int(dt.timestamp())
                except (ValueError, AttributeError):
                    pass

            pw_cookies.append(pw_cookie)

        if pw_cookies:
            await context.add_cookies(pw_cookies)

        page = await context.new_page()

        automation_id = str(uuid.uuid4())[:12]
        from datetime import datetime, timezone

        self._sessions[automation_id] = AutomationSession(
            session_id=automation_id,
            browser=browser,
            context=context,
            page=page,
            cookies_injected=len(pw_cookies),
            created_at=datetime.now(timezone.utc).isoformat(),
        )

        logger.info(
            f"Automation session {automation_id} started with "
            f"{len(pw_cookies)} cookies"
        )
        return automation_id

    def _get_session(self, automation_id: str) -> AutomationSession:
        """Get a session by ID, raise if not found"""
        session = self._sessions.get(automation_id)
        if not session:
            raise ValueError(f"Automation session {automation_id} not found")
        return session

    async def navigate(
        self,
        automation_id: str,
        url: str,
        wait_for: str = "load",
        take_screenshot: bool = True,
    ) -> dict:
        """Navigate to a URL, optionally take a screenshot"""
        session = self._get_session(automation_id)

        await session.page.goto(url, wait_until=wait_for, timeout=30000)
        title = await session.page.title()
        current_url = session.page.url

        result = {"title": title, "url": current_url, "screenshot": None}

        if take_screenshot:
            screenshot_bytes = await session.page.screenshot(type="png")
            result["screenshot"] = base64.b64encode(screenshot_bytes).decode()

        return result

    async def screenshot(
        self,
        automation_id: str,
        full_page: bool = False,
    ) -> dict:
        """Take a screenshot of the current page"""
        session = self._get_session(automation_id)

        screenshot_bytes = await session.page.screenshot(
            type="png",
            full_page=full_page,
        )

        viewport = session.page.viewport_size or {"width": 1920, "height": 1080}

        return {
            "screenshot": base64.b64encode(screenshot_bytes).decode(),
            "width": viewport["width"],
            "height": viewport["height"],
        }

    async def execute_js(
        self,
        automation_id: str,
        script: str,
    ) -> dict:
        """Execute JavaScript in the page context"""
        session = self._get_session(automation_id)

        try:
            result = await session.page.evaluate(script)
            return {
                "result": json.dumps(result) if not isinstance(result, str) else result,
                "error": None,
            }
        except Exception as e:
            return {"result": None, "error": str(e)}

    async def get_cookies(self, automation_id: str) -> List[dict]:
        """Get all cookies from the browser context"""
        session = self._get_session(automation_id)

        pw_cookies = await session.context.cookies()
        cookies = []
        for c in pw_cookies:
            cookies.append({
                "domain": c.get("domain", ""),
                "name": c.get("name", ""),
                "value": c.get("value", ""),
                "path": c.get("path", "/"),
                "expires": str(int(c.get("expires", 0))) if c.get("expires") else None,
                "secure": c.get("secure", False),
                "http_only": c.get("httpOnly", False),
                "same_site": c.get("sameSite"),
            })

        return cookies

    async def get_page_content(self, automation_id: str) -> dict:
        """Get the current page content"""
        session = self._get_session(automation_id)

        html = await session.page.content()
        title = await session.page.title()
        url = session.page.url

        return {"html": html, "title": title, "url": url}

    async def stop_session(self, automation_id: str) -> None:
        """Stop and cleanup an automation session"""
        session = self._sessions.pop(automation_id, None)
        if not session:
            return

        try:
            if session.page:
                await session.page.close()
            if session.context:
                await session.context.close()
            if session.browser:
                await session.browser.close()
        except Exception as e:
            logger.warning(f"Error closing automation session {automation_id}: {e}")

        logger.info(f"Automation session {automation_id} stopped")

    async def shutdown(self) -> None:
        """Shutdown all sessions and the Playwright instance"""
        for session_id in list(self._sessions.keys()):
            await self.stop_session(session_id)

        if self._playwright:
            await self._playwright.stop()
            self._playwright = None

    @property
    def active_sessions(self) -> List[str]:
        """List active automation session IDs"""
        return list(self._sessions.keys())


# Singleton instance
_playwright_service: Optional[PlaywrightService] = None


def get_playwright_service() -> PlaywrightService:
    """Get or create the singleton PlaywrightService instance"""
    global _playwright_service
    if _playwright_service is None:
        _playwright_service = PlaywrightService()
    return _playwright_service
