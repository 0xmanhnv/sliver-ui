"""
Beacon management endpoints
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_sliver, require_permission, get_db
from app.services.sliver_client import SliverManager
from app.models import User, AuditLog
from app.schemas.beacon import BeaconResponse, BeaconList
from app.schemas.common import MessageResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=BeaconList)
async def list_beacons(
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("beacons", "read")),
):
    """
    List all beacons
    """
    beacons = await sliver.get_beacons()
    return BeaconList(
        beacons=[BeaconResponse(**b) for b in beacons],
        total=len(beacons),
    )


@router.get("/{beacon_id}", response_model=BeaconResponse)
async def get_beacon(
    beacon_id: str,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("beacons", "read")),
):
    """
    Get beacon details
    """
    beacon = await sliver.get_beacon(beacon_id)
    if not beacon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Beacon {beacon_id} not found",
        )
    return BeaconResponse(**beacon)


@router.delete("/{beacon_id}", response_model=MessageResponse)
async def kill_beacon(
    beacon_id: str,
    request: Request,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("beacons", "delete")),
    db: AsyncSession = Depends(get_db),
):
    """
    Kill a beacon
    """
    beacon = await sliver.get_beacon(beacon_id)
    if not beacon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Beacon {beacon_id} not found",
        )

    await sliver.kill_beacon(beacon_id)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="kill",
        resource="beacons",
        resource_id=beacon_id,
        details={"hostname": beacon.get("hostname")},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    return MessageResponse(message=f"Beacon {beacon_id} killed")


# ═══════════════════════════════════════════════════════════════════════════
# Beacon Task Operations
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/{beacon_id}/tasks")
async def list_beacon_tasks(
    beacon_id: str,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("beacons", "read")),
):
    """
    List tasks for a beacon
    """
    beacon = await sliver.get_beacon(beacon_id)
    if not beacon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Beacon {beacon_id} not found",
        )

    tasks = await sliver.get_beacon_tasks(beacon_id)
    return {"tasks": tasks, "total": len(tasks)}


@router.post("/{beacon_id}/tasks/shell")
async def queue_shell_task(
    beacon_id: str,
    request: Request,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("beacons", "execute")),
    db: AsyncSession = Depends(get_db),
):
    """
    Queue a shell command on beacon
    """
    beacon = await sliver.get_beacon(beacon_id)
    if not beacon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Beacon {beacon_id} not found",
        )

    body = await request.json()
    command = body.get("command")
    if not command:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Command is required",
        )

    result = await sliver.beacon_shell(beacon_id, command)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="beacon_shell",
        resource="beacons",
        resource_id=beacon_id,
        details={"command": command[:500], "task_id": result.get("task_id")},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    return result


@router.post("/{beacon_id}/tasks/ps")
async def queue_ps_task(
    beacon_id: str,
    request: Request,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("beacons", "read")),
    db: AsyncSession = Depends(get_db),
):
    """
    Queue process list task on beacon
    """
    beacon = await sliver.get_beacon(beacon_id)
    if not beacon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Beacon {beacon_id} not found",
        )

    result = await sliver.beacon_ps(beacon_id)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="beacon_ps",
        resource="beacons",
        resource_id=beacon_id,
        details={"task_id": result.get("task_id")},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    return result


@router.post("/{beacon_id}/tasks/screenshot")
async def queue_screenshot_task(
    beacon_id: str,
    request: Request,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("beacons", "read")),
    db: AsyncSession = Depends(get_db),
):
    """
    Queue screenshot task on beacon
    """
    beacon = await sliver.get_beacon(beacon_id)
    if not beacon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Beacon {beacon_id} not found",
        )

    result = await sliver.beacon_screenshot(beacon_id)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="beacon_screenshot",
        resource="beacons",
        resource_id=beacon_id,
        details={"task_id": result.get("task_id")},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    return result


@router.post("/{beacon_id}/tasks/download")
async def queue_download_task(
    beacon_id: str,
    request: Request,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("files", "read")),
    db: AsyncSession = Depends(get_db),
):
    """
    Queue file download task on beacon
    """
    beacon = await sliver.get_beacon(beacon_id)
    if not beacon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Beacon {beacon_id} not found",
        )

    body = await request.json()
    remote_path = body.get("remote_path")
    if not remote_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="remote_path is required",
        )

    result = await sliver.beacon_download(beacon_id, remote_path)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="beacon_download",
        resource="beacons",
        resource_id=beacon_id,
        details={"path": remote_path, "task_id": result.get("task_id")},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    return result


@router.get("/{beacon_id}/tasks/{task_id}")
async def get_task_result(
    beacon_id: str,
    task_id: str,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("beacons", "read")),
):
    """
    Get result of a specific beacon task
    """
    beacon = await sliver.get_beacon(beacon_id)
    if not beacon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Beacon {beacon_id} not found",
        )

    result = await sliver.get_task_result(beacon_id, task_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found",
        )

    return result


# ═══════════════════════════════════════════════════════════════════════════
# Execute-Assembly Operations
# ═══════════════════════════════════════════════════════════════════════════

from pydantic import BaseModel

class ExecuteAssemblyRequest(BaseModel):
    assembly_path: str
    arguments: str = ""


class ExecuteAssemblyTaskResponse(BaseModel):
    task_id: str
    beacon_id: str
    assembly: str
    arguments: str


@router.post("/{beacon_id}/tasks/execute-assembly", response_model=ExecuteAssemblyTaskResponse)
async def queue_execute_assembly_task(
    beacon_id: str,
    request_data: ExecuteAssemblyRequest,
    request: Request,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("beacons", "execute")),
    db: AsyncSession = Depends(get_db),
):
    """
    Queue execute-assembly task on beacon
    """
    beacon = await sliver.get_beacon(beacon_id)
    if not beacon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Beacon {beacon_id} not found",
        )

    result = await sliver.beacon_execute_assembly(
        beacon_id,
        request_data.assembly_path,
        request_data.arguments,
    )

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="beacon_execute_assembly",
        resource="beacons",
        resource_id=beacon_id,
        details={
            "assembly": request_data.assembly_path,
            "arguments": request_data.arguments[:200],
            "task_id": result.get("task_id"),
        },
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    return ExecuteAssemblyTaskResponse(
        task_id=result.get("task_id", ""),
        beacon_id=beacon_id,
        assembly=request_data.assembly_path,
        arguments=request_data.arguments,
    )
