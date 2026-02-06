"""
Implant tracking endpoints - CRUD for implant lifecycle management
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_permission
from app.models import User, AuditLog
from app.models.implant import TrackedImplant
from app.schemas.implant_tracking import (
    TrackedImplantCreate,
    TrackedImplantUpdate,
    TrackedImplantResponse,
    TrackedImplantList,
)
from app.schemas.common import MessageResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/", response_model=TrackedImplantList)
async def list_tracked_implants(
    status_filter: Optional[str] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(require_permission("implants", "read")),
    db: AsyncSession = Depends(get_db),
):
    """List all tracked implants with optional status filter"""
    query = select(TrackedImplant)

    if status_filter:
        query = query.where(TrackedImplant.status == status_filter)

    # Exclude soft-deleted unless explicitly requesting retired
    if status_filter != "retired":
        query = query.where(TrackedImplant.status != "retired")

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Fetch page
    query = query.order_by(TrackedImplant.updated_at.desc())
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    implants = result.scalars().all()

    return TrackedImplantList(
        implants=[TrackedImplantResponse.model_validate(i) for i in implants],
        total=total,
    )


@router.post("/", response_model=TrackedImplantResponse, status_code=201)
async def create_tracked_implant(
    data: TrackedImplantCreate,
    request: Request,
    user: User = Depends(require_permission("implants", "write")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new tracked implant entry"""
    # Check for duplicate name
    existing = await db.execute(
        select(TrackedImplant).where(TrackedImplant.name == data.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Implant with name '{data.name}' already exists",
        )

    implant = TrackedImplant(
        name=data.name,
        version=data.version,
        build_date=data.build_date,
        c2_domains=data.c2_domains,
        deployed_target=data.deployed_target,
        status=data.status,
        notes=data.notes,
        sha256_hash=data.sha256_hash,
    )
    db.add(implant)
    await db.commit()
    await db.refresh(implant)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="create",
        resource="implant_tracking",
        resource_id=str(implant.id),
        details={"name": data.name, "status": data.status},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)
    await db.commit()

    logger.info(f"Tracked implant created: {data.name} by user {user.id}")
    return TrackedImplantResponse.model_validate(implant)


@router.patch("/{implant_id}", response_model=TrackedImplantResponse)
async def update_tracked_implant(
    implant_id: int,
    data: TrackedImplantUpdate,
    request: Request,
    user: User = Depends(require_permission("implants", "write")),
    db: AsyncSession = Depends(get_db),
):
    """Update a tracked implant's status, notes, or other fields"""
    result = await db.execute(
        select(TrackedImplant).where(TrackedImplant.id == implant_id)
    )
    implant = result.scalar_one_or_none()

    if not implant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tracked implant not found",
        )

    # Apply updates
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(implant, field, value)

    await db.commit()
    await db.refresh(implant)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="update",
        resource="implant_tracking",
        resource_id=str(implant.id),
        details=update_data,
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)
    await db.commit()

    logger.info(f"Tracked implant updated: {implant.name} by user {user.id}")
    return TrackedImplantResponse.model_validate(implant)


@router.delete("/{implant_id}", response_model=MessageResponse)
async def delete_tracked_implant(
    implant_id: int,
    request: Request,
    user: User = Depends(require_permission("implants", "delete")),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete a tracked implant (set status to retired)"""
    result = await db.execute(
        select(TrackedImplant).where(TrackedImplant.id == implant_id)
    )
    implant = result.scalar_one_or_none()

    if not implant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tracked implant not found",
        )

    implant.status = "retired"
    await db.commit()

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="retire",
        resource="implant_tracking",
        resource_id=str(implant.id),
        details={"name": implant.name},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)
    await db.commit()

    logger.info(f"Tracked implant retired: {implant.name} by user {user.id}")
    return MessageResponse(message=f"Implant '{implant.name}' retired")
