"""
Implant generation endpoints
"""

import logging
import hashlib
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
import io

from app.api.deps import get_sliver, require_permission, get_db
from app.services.sliver_client import SliverManager
from app.models import User, AuditLog
from app.schemas.implant import ImplantGenerateRequest, ImplantResponse
from app.schemas.common import MessageResponse

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory cache for generated implants (in production, use Redis or file storage)
_implant_cache: dict = {}


@router.post("/generate", response_model=ImplantResponse)
async def generate_implant(
    config: ImplantGenerateRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    sliver: SliverManager = Depends(get_sliver),
    user: User = Depends(require_permission("implants", "write")),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a new implant

    This is a synchronous operation that may take some time depending on
    the implant configuration.
    """
    logger.info(f"Generating implant: {config.name} ({config.os}/{config.arch})")

    # Generate implant
    implant_data = await sliver.generate_implant(config.model_dump())

    # Calculate hashes
    md5_hash = hashlib.md5(implant_data).hexdigest()
    sha256_hash = hashlib.sha256(implant_data).hexdigest()

    # Determine filename
    ext_map = {
        "exe": ".exe",
        "dll": ".dll",
        "shellcode": ".bin",
        "shared": ".so" if config.os == "linux" else ".dylib",
        "service": ".exe",
    }
    ext = ext_map.get(config.format, "")
    filename = f"{config.name}{ext}"

    # Cache implant for download
    cache_key = f"{config.name}_{md5_hash[:8]}"
    _implant_cache[cache_key] = {
        "data": implant_data,
        "filename": filename,
        "generated_at": datetime.now(timezone.utc),
    }

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="generate",
        resource="implants",
        resource_id=config.name,
        details={
            "os": config.os,
            "arch": config.arch,
            "format": config.format,
            "size": len(implant_data),
            "md5": md5_hash,
        },
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    logger.info(f"Implant generated: {filename} ({len(implant_data)} bytes)")

    return ImplantResponse(
        name=config.name,
        filename=filename,
        os=config.os,
        arch=config.arch,
        format=config.format,
        size=len(implant_data),
        md5=md5_hash,
        sha256=sha256_hash,
        generated_at=datetime.now(timezone.utc),
        download_url=f"/api/v1/implants/{cache_key}/download",
    )


@router.get("/{implant_key}/download")
async def download_implant(
    implant_key: str,
    request: Request,
    user: User = Depends(require_permission("implants", "read")),
    db: AsyncSession = Depends(get_db),
):
    """
    Download a generated implant
    """
    if implant_key not in _implant_cache:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Implant not found or expired",
        )

    cached = _implant_cache[implant_key]

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="download",
        resource="implants",
        resource_id=implant_key,
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    return StreamingResponse(
        io.BytesIO(cached["data"]),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{cached["filename"]}"'
        },
    )


@router.delete("/{implant_key}", response_model=MessageResponse)
async def delete_implant(
    implant_key: str,
    user: User = Depends(require_permission("implants", "delete")),
):
    """
    Delete a cached implant
    """
    if implant_key in _implant_cache:
        del _implant_cache[implant_key]
        return MessageResponse(message=f"Implant {implant_key} deleted")

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Implant not found",
    )
