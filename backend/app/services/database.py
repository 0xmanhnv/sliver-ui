"""
Database service - SQLAlchemy async setup
"""

import logging
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.models import Base, Role, Permission, User
from app.core.security import get_password_hash

logger = logging.getLogger(__name__)

# Convert sqlite URL to async
database_url = settings.database_url
if database_url.startswith("sqlite:///"):
    database_url = database_url.replace("sqlite:///", "sqlite+aiosqlite:///")

# Create async engine
engine = create_async_engine(
    database_url,
    echo=settings.debug,
    connect_args={"check_same_thread": False} if "sqlite" in database_url else {},
    poolclass=StaticPool if "sqlite" in database_url else None,
)

# Session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get database session"""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database - create tables and seed data"""
    try:
        async with engine.begin() as conn:
            # Create tables (if not exist)
            await conn.run_sync(Base.metadata.create_all)

        # Seed initial data
        async with async_session_maker() as session:
            await seed_data(session)
    except Exception as e:
        # Tables may already exist from another worker
        if "already exists" not in str(e):
            logger.error(f"Database init error: {e}")
            raise
        logger.info("Database tables already exist, skipping init")


async def close_db() -> None:
    """Close database connections"""
    await engine.dispose()


async def seed_data(session: AsyncSession) -> None:
    """Seed initial roles, permissions, and admin user"""
    from sqlalchemy import select, insert

    # Check if roles exist
    result = await session.execute(select(Role).limit(1))
    if result.scalar_one_or_none():
        return  # Already seeded

    logger.info("Seeding initial data...")

    # Create roles
    admin_role = Role(name="admin", description="Full system access")
    operator_role = Role(name="operator", description="Can manage sessions and execute commands")
    viewer_role = Role(name="viewer", description="Read-only access")

    session.add_all([admin_role, operator_role, viewer_role])
    await session.flush()

    # Create permissions
    resources = ["sessions", "beacons", "implants", "listeners", "files", "users", "audit"]
    actions = ["read", "write", "execute", "delete"]

    permissions = []
    for resource in resources:
        for action in actions:
            perm = Permission(
                name=f"{resource}.{action}",
                resource=resource,
                action=action,
            )
            permissions.append(perm)
            session.add(perm)

    await session.flush()

    # Import the association table
    from app.models.user import role_permissions

    # Assign permissions to roles using direct insert to association table
    # This avoids lazy-loading issues with async SQLAlchemy

    # Admin gets all permissions
    admin_perm_records = [
        {"role_id": admin_role.id, "permission_id": p.id} for p in permissions
    ]
    if admin_perm_records:
        await session.execute(insert(role_permissions), admin_perm_records)

    # Operator gets all except user management
    operator_perm_records = [
        {"role_id": operator_role.id, "permission_id": p.id}
        for p in permissions if p.resource not in ["users", "audit"]
    ]
    if operator_perm_records:
        await session.execute(insert(role_permissions), operator_perm_records)

    # Viewer gets read-only
    viewer_perm_records = [
        {"role_id": viewer_role.id, "permission_id": p.id}
        for p in permissions if p.action == "read"
    ]
    if viewer_perm_records:
        await session.execute(insert(role_permissions), viewer_perm_records)

    await session.flush()

    # Create default admin user
    admin_user = User(
        username="admin",
        email="admin@sliverui.local",
        password_hash=get_password_hash("changeme123"),  # Default password
        role_id=admin_role.id,
        is_active=True,
    )
    session.add(admin_user)

    await session.commit()
    logger.info("Initial data seeded successfully")
    logger.warning("Default admin password is 'changeme123' - please change it!")
