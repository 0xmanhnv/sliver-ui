"""
Session management endpoints
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
import io

from app.api.deps import get_sliver, require_permission, get_db, get_current_user
from app.services.sliver_client import SliverManager
from app.models import User, AuditLog
from app.schemas.session import (
    SessionResponse,
    SessionList,
    ShellRequest,
    ShellResponse,
    ProcessList,
    DirectoryListing,
)
from app.schemas.common import MessageResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=SessionList)
async def list_sessions(
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("sessions", "read")),
):
    """
    List all active sessions
    """
    sessions = await sliver.get_sessions()
    return SessionList(
        sessions=[SessionResponse(**s) for s in sessions],
        total=len(sessions),
    )


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("sessions", "read")),
):
    """
    Get session details
    """
    session = await sliver.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )
    return SessionResponse(**session)


@router.delete("/{session_id}", response_model=MessageResponse)
async def kill_session(
    session_id: str,
    request: Request,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("sessions", "delete")),
    db: AsyncSession = Depends(get_db),
):
    """
    Kill a session
    """
    session = await sliver.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )

    await sliver.kill_session(session_id)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="kill",
        resource="sessions",
        resource_id=session_id,
        details={"hostname": session.get("hostname")},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    return MessageResponse(message=f"Session {session_id} killed")


@router.post("/{session_id}/shell", response_model=ShellResponse)
async def execute_shell(
    session_id: str,
    shell_request: ShellRequest,
    request: Request,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("sessions", "execute")),
    db: AsyncSession = Depends(get_db),
):
    """
    Execute shell command on session
    """
    session = await sliver.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )

    result = await sliver.session_shell(
        session_id,
        shell_request.command,
        timeout=shell_request.timeout,
    )

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="shell",
        resource="sessions",
        resource_id=session_id,
        details={
            "command": shell_request.command[:500],  # Truncate for safety
            "hostname": session.get("hostname"),
        },
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    return ShellResponse(
        output=result.get("output", ""),
        stderr=result.get("stderr"),
        exit_code=result.get("exit_code", 0),
        executed_at=datetime.now(timezone.utc),
    )


@router.get("/{session_id}/processes", response_model=ProcessList)
async def list_processes(
    session_id: str,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("sessions", "read")),
):
    """
    List processes on session
    """
    session = await sliver.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )

    processes = await sliver.session_ps(session_id)
    return ProcessList(processes=processes, total=len(processes))


@router.post("/{session_id}/processes/{pid}/kill", response_model=MessageResponse)
async def kill_process(
    session_id: str,
    pid: int,
    request: Request,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("sessions", "execute")),
    db: AsyncSession = Depends(get_db),
):
    """
    Kill a process on session
    """
    session = await sliver.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )

    # Execute kill command
    os_type = session.get("os", "").lower()
    if os_type == "windows":
        command = f"taskkill /F /PID {pid}"
    else:
        command = f"kill -9 {pid}"

    await sliver.session_shell(session_id, command)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="kill_process",
        resource="sessions",
        resource_id=session_id,
        details={"pid": pid},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    return MessageResponse(message=f"Process {pid} killed")


@router.get("/{session_id}/files", response_model=DirectoryListing)
async def list_files(
    session_id: str,
    path: str = Query(..., description="Directory path"),
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("files", "read")),
):
    """
    List files in directory
    """
    session = await sliver.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )

    result = await sliver.session_ls(session_id, path)
    return DirectoryListing(**result)


@router.get("/{session_id}/files/download")
async def download_file(
    session_id: str,
    path: str = Query(..., description="File path to download"),
    request: Request = None,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("files", "read")),
    db: AsyncSession = Depends(get_db),
):
    """
    Download file from session
    """
    session = await sliver.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )

    data = await sliver.session_download(session_id, path)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="download",
        resource="files",
        resource_id=session_id,
        details={"path": path, "size": len(data)},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    # Get filename from path
    filename = path.split("/")[-1].split("\\")[-1]

    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ═══════════════════════════════════════════════════════════════════════════
# Pivoting Operations
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/{session_id}/pivots")
async def list_pivots(
    session_id: str,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("sessions", "read")),
):
    """
    List all active pivots (SOCKS and port forwards) for a session
    """
    session = await sliver.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )

    pivots = await sliver.list_pivots(session_id)
    return {"pivots": pivots, "total": len(pivots)}


@router.post("/{session_id}/socks")
async def start_socks_proxy(
    session_id: str,
    request: Request,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("sessions", "execute")),
    db: AsyncSession = Depends(get_db),
):
    """
    Start SOCKS5 proxy through session
    """
    session = await sliver.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )

    body = await request.json()
    host = body.get("host", "127.0.0.1")
    port = body.get("port", 1080)

    result = await sliver.start_socks_proxy(session_id, host, port)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="start_socks",
        resource="sessions",
        resource_id=session_id,
        details={"host": host, "port": port},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    return result


@router.delete("/{session_id}/socks/{tunnel_id}")
async def stop_socks_proxy(
    session_id: str,
    tunnel_id: int,
    request: Request,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("sessions", "execute")),
    db: AsyncSession = Depends(get_db),
):
    """
    Stop SOCKS5 proxy
    """
    session = await sliver.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )

    await sliver.stop_socks_proxy(session_id, tunnel_id)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="stop_socks",
        resource="sessions",
        resource_id=session_id,
        details={"tunnel_id": tunnel_id},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    return MessageResponse(message=f"SOCKS proxy {tunnel_id} stopped")


@router.post("/{session_id}/portfwd")
async def start_port_forward(
    session_id: str,
    request: Request,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("sessions", "execute")),
    db: AsyncSession = Depends(get_db),
):
    """
    Start port forwarding through session
    """
    session = await sliver.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )

    body = await request.json()
    remote_host = body.get("remote_host")
    remote_port = body.get("remote_port")
    local_host = body.get("local_host", "127.0.0.1")
    local_port = body.get("local_port", 0)

    if not remote_host or not remote_port:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="remote_host and remote_port are required",
        )

    result = await sliver.start_portfwd(
        session_id, remote_host, remote_port, local_host, local_port
    )

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="start_portfwd",
        resource="sessions",
        resource_id=session_id,
        details={
            "local": f"{local_host}:{local_port}",
            "remote": f"{remote_host}:{remote_port}",
        },
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    return result


@router.delete("/{session_id}/portfwd/{tunnel_id}")
async def stop_port_forward(
    session_id: str,
    tunnel_id: int,
    request: Request,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("sessions", "execute")),
    db: AsyncSession = Depends(get_db),
):
    """
    Stop port forwarding
    """
    session = await sliver.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )

    await sliver.stop_portfwd(session_id, tunnel_id)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="stop_portfwd",
        resource="sessions",
        resource_id=session_id,
        details={"tunnel_id": tunnel_id},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    return MessageResponse(message=f"Port forward {tunnel_id} stopped")


# ═══════════════════════════════════════════════════════════════════════════
# File Operations
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/{session_id}/files/upload")
async def upload_file(
    session_id: str,
    remote_path: str = Query(..., description="Remote path to upload to"),
    request: Request = None,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("files", "write")),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload file to session
    """
    session = await sliver.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )

    # Read file data from request body
    body = await request.body()
    if not body:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file data provided",
        )

    await sliver.session_upload(session_id, remote_path, body)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="upload",
        resource="files",
        resource_id=session_id,
        details={"path": remote_path, "size": len(body)},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    return MessageResponse(message=f"File uploaded to {remote_path}")


@router.post("/{session_id}/mkdir")
async def create_directory(
    session_id: str,
    path: str = Query(..., description="Directory path to create"),
    request: Request = None,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("files", "write")),
    db: AsyncSession = Depends(get_db),
):
    """
    Create directory on session
    """
    session = await sliver.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )

    # Execute mkdir command
    os_type = session.get("os", "").lower()
    if os_type == "windows":
        command = f'mkdir "{path}"'
    else:
        command = f'mkdir -p "{path}"'

    await sliver.session_shell(session_id, command)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="mkdir",
        resource="files",
        resource_id=session_id,
        details={"path": path},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    return MessageResponse(message=f"Directory created: {path}")


@router.delete("/{session_id}/files")
async def delete_file(
    session_id: str,
    path: str = Query(..., description="File/directory path to delete"),
    request: Request = None,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("files", "delete")),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete file or directory on session
    """
    session = await sliver.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )

    # Execute delete command
    os_type = session.get("os", "").lower()
    if os_type == "windows":
        command = f'del /F /Q "{path}" 2>nul || rmdir /S /Q "{path}"'
    else:
        command = f'rm -rf "{path}"'

    await sliver.session_shell(session_id, command)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="delete",
        resource="files",
        resource_id=session_id,
        details={"path": path},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    return MessageResponse(message=f"Deleted: {path}")


@router.get("/{session_id}/screenshot")
async def take_screenshot(
    session_id: str,
    request: Request,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("sessions", "read")),
    db: AsyncSession = Depends(get_db),
):
    """
    Take screenshot from session
    """
    session = await sliver.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )

    data = await sliver.session_screenshot(session_id)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="screenshot",
        resource="sessions",
        resource_id=session_id,
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    return StreamingResponse(
        io.BytesIO(data),
        media_type="image/png",
    )


# ═══════════════════════════════════════════════════════════════════════════
# Execute-Assembly Operations
# ═══════════════════════════════════════════════════════════════════════════

from pydantic import BaseModel

class ExecuteAssemblyRequest(BaseModel):
    assembly_path: str
    arguments: str = ""
    timeout: int = 300


class ExecuteAssemblyResponse(BaseModel):
    output: str
    error: str = ""


@router.post("/{session_id}/execute-assembly", response_model=ExecuteAssemblyResponse)
async def execute_assembly(
    session_id: str,
    request_data: ExecuteAssemblyRequest,
    request: Request,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("sessions", "execute")),
    db: AsyncSession = Depends(get_db),
):
    """
    Execute .NET assembly on session
    """
    session = await sliver.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )

    result = await sliver.session_execute_assembly(
        session_id,
        request_data.assembly_path,
        request_data.arguments,
        request_data.timeout,
    )

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="execute_assembly",
        resource="sessions",
        resource_id=session_id,
        details={
            "assembly": request_data.assembly_path,
            "arguments": request_data.arguments[:200],
            "hostname": session.get("hostname"),
        },
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    return ExecuteAssemblyResponse(
        output=result.get("output", ""),
        error=result.get("error", ""),
    )
