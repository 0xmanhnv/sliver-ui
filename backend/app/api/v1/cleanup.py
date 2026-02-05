"""
Cleanup API endpoints - Session/Beacon cleanup management
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from pydantic import BaseModel

from app.api.deps import get_current_user, require_role
from app.services.sliver_client import get_sliver_client, SliverManager
from app.core.exceptions import SliverCommandError

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# Schemas
# ═══════════════════════════════════════════════════════════════════════════════

class StaleSession(BaseModel):
    id: str
    name: str
    hostname: str
    username: str
    os: str
    stale_minutes: int


class DeadBeacon(BaseModel):
    id: str
    name: str
    hostname: str
    username: str
    os: str
    missed_checkins: int


class CleanupStatusResponse(BaseModel):
    stale_sessions: List[StaleSession]
    dead_beacons: List[DeadBeacon]
    total_sessions: int
    total_beacons: int
    total_jobs: int


class BulkKillRequest(BaseModel):
    ids: List[str]


class BulkKillResponse(BaseModel):
    success: List[str]
    failed: List[dict]


class KillAllResponse(BaseModel):
    sessions_killed: int
    beacons_killed: int
    jobs_killed: int
    failed: List[dict]


# ═══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/status", response_model=CleanupStatusResponse)
async def get_cleanup_status(
    stale_threshold_minutes: int = 1440,  # 24 hours default
    missed_checkins_threshold: int = 10,
    current_user=Depends(get_current_user),
    sliver: SliverManager = Depends(get_sliver_client),
):
    """Get cleanup status - stale sessions, dead beacons"""
    # Get all data
    sessions = await sliver.get_sessions()
    beacons = await sliver.get_beacons()
    jobs = await sliver.get_jobs()

    # Get stale/dead
    stale_sessions = await sliver.get_stale_sessions(stale_threshold_minutes)
    dead_beacons = await sliver.get_dead_beacons(missed_checkins_threshold)

    return CleanupStatusResponse(
        stale_sessions=[
            StaleSession(
                id=s["id"],
                name=s["name"],
                hostname=s["hostname"],
                username=s["username"],
                os=s["os"],
                stale_minutes=s.get("stale_minutes", 0),
            )
            for s in stale_sessions
        ],
        dead_beacons=[
            DeadBeacon(
                id=b["id"],
                name=b["name"],
                hostname=b["hostname"],
                username=b["username"],
                os=b["os"],
                missed_checkins=b.get("missed_checkins", 0),
            )
            for b in dead_beacons
        ],
        total_sessions=len(sessions),
        total_beacons=len(beacons),
        total_jobs=len(jobs),
    )


@router.post("/sessions/bulk-kill", response_model=BulkKillResponse)
async def bulk_kill_sessions(
    request: BulkKillRequest,
    current_user=Depends(require_role("admin", "operator")),
    sliver: SliverManager = Depends(get_sliver_client),
):
    """Kill multiple sessions at once"""
    try:
        result = await sliver.bulk_kill_sessions(request.ids)
        return BulkKillResponse(**result)
    except SliverCommandError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/beacons/bulk-kill", response_model=BulkKillResponse)
async def bulk_kill_beacons(
    request: BulkKillRequest,
    current_user=Depends(require_role("admin", "operator")),
    sliver: SliverManager = Depends(get_sliver_client),
):
    """Kill multiple beacons at once"""
    try:
        result = await sliver.bulk_kill_beacons(request.ids)
        return BulkKillResponse(**result)
    except SliverCommandError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/sessions/kill-all", response_model=BulkKillResponse)
async def kill_all_sessions(
    current_user=Depends(require_role("admin")),
    sliver: SliverManager = Depends(get_sliver_client),
):
    """Kill all sessions (admin only)"""
    try:
        result = await sliver.kill_all_sessions()
        return BulkKillResponse(**result)
    except SliverCommandError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/beacons/kill-all", response_model=BulkKillResponse)
async def kill_all_beacons(
    current_user=Depends(require_role("admin")),
    sliver: SliverManager = Depends(get_sliver_client),
):
    """Kill all beacons (admin only)"""
    try:
        result = await sliver.kill_all_beacons()
        return BulkKillResponse(**result)
    except SliverCommandError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/jobs/kill-all", response_model=BulkKillResponse)
async def kill_all_jobs(
    current_user=Depends(require_role("admin")),
    sliver: SliverManager = Depends(get_sliver_client),
):
    """Kill all jobs/listeners (admin only)"""
    try:
        result = await sliver.kill_all_jobs()
        return BulkKillResponse(**result)
    except SliverCommandError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/kill-everything")
async def kill_everything(
    current_user=Depends(require_role("admin")),
    sliver: SliverManager = Depends(get_sliver_client),
):
    """Kill all sessions, beacons, and jobs (admin only) - DANGEROUS"""
    try:
        sessions_result = await sliver.kill_all_sessions()
        beacons_result = await sliver.kill_all_beacons()
        jobs_result = await sliver.kill_all_jobs()

        return {
            "sessions_killed": len(sessions_result["success"]),
            "beacons_killed": len(beacons_result["success"]),
            "jobs_killed": len(jobs_result["success"]),
            "failed": (
                sessions_result["failed"] +
                beacons_result["failed"] +
                jobs_result["failed"]
            ),
        }
    except SliverCommandError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
