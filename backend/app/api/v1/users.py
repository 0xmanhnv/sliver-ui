"""
User management endpoints (Admin only)
"""

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_admin_user, get_db
from app.core.security import get_password_hash
from app.models import User, Role, AuditLog
from app.schemas.user import UserCreate, UserUpdate, UserResponse, UserList, RoleResponse
from app.schemas.common import MessageResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=UserList)
async def list_users(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all users (Admin only)
    """
    result = await db.execute(
        select(User).options(selectinload(User.role))
    )
    users = result.scalars().all()

    return UserList(
        users=[UserResponse.model_validate(u) for u in users],
        total=len(users),
    )


@router.get("/roles", response_model=List[RoleResponse])
async def list_roles(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List available roles
    """
    result = await db.execute(select(Role))
    roles = result.scalars().all()
    return [RoleResponse.model_validate(r) for r in roles]


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    request: Request,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create new user (Admin only)
    """
    # Check if username exists
    result = await db.execute(
        select(User).where(User.username == user_data.username)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists",
        )

    # Check if email exists
    if user_data.email:
        result = await db.execute(
            select(User).where(User.email == user_data.email)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already exists",
            )

    # Verify role exists
    result = await db.execute(select(Role).where(Role.id == user_data.role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role ID",
        )

    # Create user
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        role_id=user_data.role_id,
        is_active=True,
    )
    db.add(new_user)
    await db.flush()

    # Audit log
    audit = AuditLog(
        user_id=admin.id,
        action="create",
        resource="users",
        resource_id=str(new_user.id),
        details={"username": user_data.username, "role": role.name},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    await db.commit()

    # Reload with role
    result = await db.execute(
        select(User)
        .options(selectinload(User.role))
        .where(User.id == new_user.id)
    )
    new_user = result.scalar_one()

    logger.info(f"User created: {user_data.username} by {admin.username}")
    return UserResponse.model_validate(new_user)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get user by ID (Admin only)
    """
    result = await db.execute(
        select(User)
        .options(selectinload(User.role))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserResponse.model_validate(user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    request: Request,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update user (Admin only)
    """
    result = await db.execute(
        select(User)
        .options(selectinload(User.role))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Prevent admin from deactivating themselves
    if user.id == admin.id and user_data.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account",
        )

    # Update fields
    update_data = user_data.model_dump(exclude_unset=True)

    if "username" in update_data:
        # Check uniqueness
        result = await db.execute(
            select(User).where(
                User.username == update_data["username"],
                User.id != user_id,
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists",
            )
        user.username = update_data["username"]

    if "email" in update_data and update_data["email"]:
        result = await db.execute(
            select(User).where(
                User.email == update_data["email"],
                User.id != user_id,
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already exists",
            )
        user.email = update_data["email"]

    if "password" in update_data:
        user.password_hash = get_password_hash(update_data["password"])

    if "role_id" in update_data:
        result = await db.execute(
            select(Role).where(Role.id == update_data["role_id"])
        )
        if not result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role ID",
            )
        user.role_id = update_data["role_id"]

    if "is_active" in update_data:
        user.is_active = update_data["is_active"]

    # Audit log
    audit = AuditLog(
        user_id=admin.id,
        action="update",
        resource="users",
        resource_id=str(user_id),
        details={"updated_fields": list(update_data.keys())},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    await db.commit()

    # Reload
    result = await db.execute(
        select(User)
        .options(selectinload(User.role))
        .where(User.id == user_id)
    )
    user = result.scalar_one()

    return UserResponse.model_validate(user)


@router.delete("/{user_id}", response_model=MessageResponse)
async def delete_user(
    user_id: int,
    request: Request,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete user (Admin only)
    """
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    username = user.username

    # Audit log before delete
    audit = AuditLog(
        user_id=admin.id,
        action="delete",
        resource="users",
        resource_id=str(user_id),
        details={"deleted_username": username},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    await db.delete(user)
    await db.commit()

    logger.info(f"User deleted: {username} by {admin.username}")
    return MessageResponse(message=f"User {username} deleted")
