"""
Shared test fixtures for SliverUI backend tests.
"""

from unittest.mock import PropertyMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.security import create_access_token
from app.models import Base
from app.services.database import get_db, seed_data
from app.services.sliver_client import SliverManager

# ---------------------------------------------------------------------------
# Database fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture()
async def test_engine():
    """In-memory async SQLite engine, created fresh per test."""
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture()
async def test_session_maker(test_engine):
    """Session factory bound to the test engine."""
    return async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )


@pytest.fixture()
async def test_db(test_session_maker):
    """Yield a database session for direct use in tests."""
    async with test_session_maker() as session:
        yield session


# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------


@pytest.fixture()
async def seed_test_data(test_session_maker):
    """Run seed_data() to create roles, permissions, and the admin user."""
    async with test_session_maker() as session:
        await seed_data(session)


# ---------------------------------------------------------------------------
# FastAPI app with overridden DB dependency
# ---------------------------------------------------------------------------


@pytest.fixture()
async def test_app(test_session_maker, seed_test_data):
    """FastAPI application wired to the in-memory test database."""
    from app.main import app  # local import to avoid side-effects at collection time

    async def _override_get_db():
        async with test_session_maker() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    app.dependency_overrides[get_db] = _override_get_db

    # Mock sliver_manager.is_connected so health check doesn't need a real server.
    # Raise rate limits so tests aren't throttled.
    with (
        patch.object(
            SliverManager, "is_connected", new_callable=PropertyMock, return_value=False
        ),
        patch("app.middleware.rate_limit.RATE_LIMITS", {}),
        patch("app.middleware.rate_limit.DEFAULT_RATE_LIMIT", (10000, 60)),
    ):
        yield app

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# HTTP client
# ---------------------------------------------------------------------------


@pytest.fixture()
async def async_client(test_app):
    """httpx AsyncClient bound to the test app."""
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------


@pytest.fixture()
async def admin_token(seed_test_data, test_session_maker):
    """JWT access token for the seeded admin user."""
    from sqlalchemy import select
    from app.models import User

    async with test_session_maker() as session:
        result = await session.execute(
            select(User).where(User.username == settings.admin_username)
        )
        admin = result.scalar_one()
        return create_access_token(
            subject=str(admin.id), additional_claims={"role": "admin"}
        )


@pytest.fixture()
async def admin_headers(admin_token):
    """Authorization header dict for the admin user."""
    return {"Authorization": f"Bearer {admin_token}"}
