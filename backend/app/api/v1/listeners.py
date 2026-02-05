"""
Listener management endpoints
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_sliver, require_permission, get_db
from app.services.sliver_client import SliverManager
from app.models import User, AuditLog
from app.schemas.listener import (
    ListenerResponse,
    ListenerList,
    MTLSListenerRequest,
    HTTPSListenerRequest,
    HTTPListenerRequest,
    DNSListenerRequest,
)
from app.schemas.common import MessageResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=ListenerList)
async def list_listeners(
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("listeners", "read")),
):
    """
    List all active listeners (jobs)
    """
    jobs = await sliver.get_jobs()

    listeners = []
    for job in jobs:
        # Get host - default to 0.0.0.0 if empty
        host = job.get("host", "") or "0.0.0.0"

        # Get domain from job data
        domain = job.get("domain")
        if not domain and job.get("domains"):
            domain = job["domains"][0] if job["domains"] else None

        listeners.append(
            ListenerResponse(
                id=job["id"],
                name=job.get("name", ""),
                protocol=job.get("protocol", "unknown"),
                host=host,
                port=job.get("port", 0),
                domain=domain,
                started_at=datetime.now(timezone.utc),  # Jobs don't have timestamp
            )
        )

    return ListenerList(listeners=listeners, total=len(listeners))


@router.post("/mtls", response_model=ListenerResponse)
async def start_mtls_listener(
    listener_config: MTLSListenerRequest,
    request: Request,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("listeners", "write")),
    db: AsyncSession = Depends(get_db),
):
    """
    Start mTLS listener
    """
    job = await sliver.start_mtls_listener(
        host=listener_config.host,
        port=listener_config.port,
    )

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="start",
        resource="listeners",
        resource_id=job["id"],
        details={
            "protocol": "mtls",
            "host": listener_config.host,
            "port": listener_config.port,
        },
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    return ListenerResponse(
        id=job["id"],
        name=job.get("name", f"mtls-{listener_config.port}"),
        protocol="mtls",
        host=listener_config.host,
        port=listener_config.port,
        started_at=datetime.now(timezone.utc),
    )


@router.post("/https", response_model=ListenerResponse)
async def start_https_listener(
    listener_config: HTTPSListenerRequest,
    request: Request,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("listeners", "write")),
    db: AsyncSession = Depends(get_db),
):
    """
    Start HTTPS listener
    """
    # Note: letsencrypt parameter is not supported by SliverPy library
    # It's kept in the schema for future compatibility but not passed to the client
    job = await sliver.start_https_listener(
        host=listener_config.host,
        port=listener_config.port,
        domain=listener_config.domain or "",
        website=listener_config.website or "",
    )

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="start",
        resource="listeners",
        resource_id=job["id"],
        details={
            "protocol": "https",
            "domain": listener_config.domain,
            "port": listener_config.port,
        },
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    return ListenerResponse(
        id=job["id"],
        name=job.get("name", f"https-{listener_config.port}"),
        protocol="https",
        host=listener_config.host,
        port=listener_config.port,
        domain=listener_config.domain,
        started_at=datetime.now(timezone.utc),
    )


@router.post("/http", response_model=ListenerResponse)
async def start_http_listener(
    listener_config: HTTPListenerRequest,
    request: Request,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("listeners", "write")),
    db: AsyncSession = Depends(get_db),
):
    """
    Start HTTP listener
    """
    job = await sliver.start_http_listener(
        host=listener_config.host,
        port=listener_config.port,
        domain=listener_config.domain or "",
        website=listener_config.website or "",
    )

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="start",
        resource="listeners",
        resource_id=job["id"],
        details={
            "protocol": "http",
            "port": listener_config.port,
        },
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    return ListenerResponse(
        id=job["id"],
        name=job.get("name", f"http-{listener_config.port}"),
        protocol="http",
        host=listener_config.host,
        port=listener_config.port,
        started_at=datetime.now(timezone.utc),
    )


@router.post("/dns", response_model=ListenerResponse)
async def start_dns_listener(
    listener_config: DNSListenerRequest,
    request: Request,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("listeners", "write")),
    db: AsyncSession = Depends(get_db),
):
    """
    Start DNS listener
    """
    job = await sliver.start_dns_listener(
        domains=listener_config.domains,
        host=listener_config.host,
        port=listener_config.port,
        canaries=listener_config.canaries,
    )

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="start",
        resource="listeners",
        resource_id=job["id"],
        details={
            "protocol": "dns",
            "domains": listener_config.domains,
            "port": listener_config.port,
        },
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    return ListenerResponse(
        id=job["id"],
        name=job.get("name", f"dns-{listener_config.port}"),
        protocol="dns",
        host=listener_config.host,
        port=listener_config.port,
        started_at=datetime.now(timezone.utc),
    )


@router.delete("/{job_id}", response_model=MessageResponse)
async def stop_listener(
    job_id: str,
    request: Request,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("listeners", "delete")),
    db: AsyncSession = Depends(get_db),
):
    """
    Stop a listener (kill job)
    """
    await sliver.kill_job(int(job_id))

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="stop",
        resource="listeners",
        resource_id=job_id,
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    return MessageResponse(message=f"Listener {job_id} stopped")
