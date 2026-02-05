"""
Armory API endpoints - Extension management
"""

import os
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from pydantic import BaseModel

from app.api.deps import get_current_user, require_role
from app.services.sliver_client import get_sliver_client, SliverManager
from app.core.exceptions import SliverCommandError
from app.core.config import settings

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# Schemas
# ═══════════════════════════════════════════════════════════════════════════════

class ArmoryPackage(BaseModel):
    name: str
    command_name: str
    version: str
    installed: bool
    type: str
    repo_url: str


class ArmoryListResponse(BaseModel):
    packages: List[ArmoryPackage]
    total: int
    installed_count: int


class ArmoryInstallRequest(BaseModel):
    package_name: str


class ArmoryActionResponse(BaseModel):
    success: bool
    package: str
    message: str


class GitHubTokenRequest(BaseModel):
    token: str


class GitHubTokenStatus(BaseModel):
    configured: bool
    token_preview: Optional[str] = None  # Shows first/last 4 chars only


# ═══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("", response_model=ArmoryListResponse)
async def list_armory_packages(
    installed_only: bool = False,
    search: Optional[str] = None,
    current_user=Depends(get_current_user),
    sliver: SliverManager = Depends(get_sliver_client),
):
    """Get list of available armory packages"""
    packages = await sliver.get_armory()

    # Filter by installed if requested
    if installed_only:
        packages = [p for p in packages if p["installed"]]

    # Search filter
    if search:
        search_lower = search.lower()
        packages = [
            p for p in packages
            if search_lower in p["name"].lower() or search_lower in p.get("command_name", "").lower()
        ]

    installed_count = sum(1 for p in packages if p["installed"])

    return ArmoryListResponse(
        packages=[ArmoryPackage(**p) for p in packages],
        total=len(packages),
        installed_count=installed_count,
    )


@router.post("/install", response_model=ArmoryActionResponse)
async def install_package(
    request: ArmoryInstallRequest,
    current_user=Depends(require_role("admin", "operator")),
    sliver: SliverManager = Depends(get_sliver_client),
):
    """Install an armory package"""
    try:
        result = await sliver.install_armory_package(request.package_name)
        return ArmoryActionResponse(**result)
    except SliverCommandError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/uninstall", response_model=ArmoryActionResponse)
async def uninstall_package(
    request: ArmoryInstallRequest,
    current_user=Depends(require_role("admin", "operator")),
    sliver: SliverManager = Depends(get_sliver_client),
):
    """Uninstall an armory package"""
    try:
        result = await sliver.uninstall_armory_package(request.package_name)
        return ArmoryActionResponse(**result)
    except SliverCommandError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/github-token", response_model=GitHubTokenStatus)
async def get_github_token_status(
    current_user=Depends(require_role("admin")),
):
    """Check if GitHub token is configured"""
    token = settings.github_token
    if token:
        # Show preview: ghp_xxxx...xxxx
        if len(token) > 8:
            preview = f"{token[:8]}...{token[-4:]}"
        else:
            preview = "****"
        return GitHubTokenStatus(configured=True, token_preview=preview)
    return GitHubTokenStatus(configured=False)


@router.post("/github-token", response_model=GitHubTokenStatus)
async def set_github_token(
    request: GitHubTokenRequest,
    current_user=Depends(require_role("admin")),
):
    """
    Set GitHub token for armory operations.
    Note: This sets the token in memory only. For persistence, set GITHUB_TOKEN env var.
    """
    # Validate token format (GitHub PATs start with ghp_, github_pat_, or are classic tokens)
    token = request.token.strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token cannot be empty"
        )

    # Set in settings (runtime only - not persisted)
    # We need to modify the settings object directly since it's cached
    object.__setattr__(settings, 'github_token', token)

    # Also set in environment for subprocess calls
    os.environ['GITHUB_TOKEN'] = token

    if len(token) > 8:
        preview = f"{token[:8]}...{token[-4:]}"
    else:
        preview = "****"

    return GitHubTokenStatus(configured=True, token_preview=preview)


@router.delete("/github-token")
async def remove_github_token(
    current_user=Depends(require_role("admin")),
):
    """Remove GitHub token"""
    object.__setattr__(settings, 'github_token', None)
    if 'GITHUB_TOKEN' in os.environ:
        del os.environ['GITHUB_TOKEN']
    return {"success": True, "message": "GitHub token removed"}
