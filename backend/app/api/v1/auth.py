"""
Authentication endpoints
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_token,
)
from app.core.config import settings
from app.services.database import get_db
from app.models import User, AuditLog
from app.schemas.auth import LoginRequest, RefreshRequest, Token
from app.schemas.user import CurrentUser
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticate user and return JWT tokens
    """
    # Find user
    result = await db.execute(
        select(User)
        .options(selectinload(User.role))
        .where(User.username == login_data.username)
    )
    user = result.scalar_one_or_none()

    # Check credentials
    if not user or not verify_password(login_data.password, user.password_hash):
        # Log failed attempt
        if user:
            user.failed_login_attempts += 1
            await db.commit()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    # Check if account is locked
    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is temporarily locked",
        )

    # Reset failed attempts
    user.failed_login_attempts = 0
    user.last_login = datetime.now(timezone.utc)

    # Create tokens
    access_token = create_access_token(
        subject=str(user.id),
        additional_claims={"role": user.role.name},
    )
    refresh_token = create_refresh_token(subject=str(user.id))

    # Log successful login
    audit_log = AuditLog(
        user_id=user.id,
        action="login",
        resource="auth",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(audit_log)
    await db.commit()

    logger.info(f"User {user.username} logged in from {request.client.host if request.client else 'unknown'}")

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.jwt_expire_minutes * 60,
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    refresh_data: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Refresh access token using refresh token
    """
    payload = verify_token(refresh_data.refresh_token, token_type="refresh")

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = payload.get("sub")

    # Verify user still exists and is active
    result = await db.execute(
        select(User)
        .options(selectinload(User.role))
        .where(User.id == int(user_id))
    )
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    # Create new tokens
    access_token = create_access_token(
        subject=str(user.id),
        additional_claims={"role": user.role.name},
    )
    new_refresh_token = create_refresh_token(subject=str(user.id))

    return Token(
        access_token=access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        expires_in=settings.jwt_expire_minutes * 60,
    )


@router.post("/logout")
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Logout user (invalidate token - client should discard)
    """
    # Log logout
    audit_log = AuditLog(
        user_id=current_user.id,
        action="logout",
        resource="auth",
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit_log)
    await db.commit()

    return {"message": "Successfully logged out"}


@router.get("/me", response_model=CurrentUser)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
):
    """
    Get current user information
    """
    permissions = []
    if current_user.role:
        permissions = [
            f"{p.resource}.{p.action}" for p in current_user.role.permissions
        ]

    return CurrentUser(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        role=current_user.role.name if current_user.role else "unknown",
        permissions=permissions,
    )
