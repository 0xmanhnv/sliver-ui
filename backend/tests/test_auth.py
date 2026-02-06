"""
Tests for authentication endpoints (/api/v1/auth/*).
"""

import pytest

from app.core.config import settings

AUTH_PREFIX = "/api/v1/auth"


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_login_success(async_client):
    """Valid admin creds return access & refresh tokens."""
    resp = await async_client.post(
        f"{AUTH_PREFIX}/login",
        json={
            "username": settings.admin_username,
            "password": settings.admin_password,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in"] > 0


@pytest.mark.asyncio
async def test_login_wrong_password(async_client):
    """Wrong password returns 401."""
    resp = await async_client.post(
        f"{AUTH_PREFIX}/login",
        json={
            "username": settings.admin_username,
            "password": "wrong-password-here",
        },
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user(async_client):
    """Non-existent user returns 401."""
    resp = await async_client.post(
        f"{AUTH_PREFIX}/login",
        json={"username": "nouser", "password": "doesntmatter1"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_short_password_validation(async_client):
    """Password shorter than 8 chars is rejected with 422."""
    resp = await async_client.post(
        f"{AUTH_PREFIX}/login",
        json={"username": settings.admin_username, "password": "short"},
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Token refresh
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_refresh_token_success(async_client):
    """Valid refresh token returns a new token pair."""
    # First, login to get tokens
    login_resp = await async_client.post(
        f"{AUTH_PREFIX}/login",
        json={
            "username": settings.admin_username,
            "password": settings.admin_password,
        },
    )
    refresh_tok = login_resp.json()["refresh_token"]

    resp = await async_client.post(
        f"{AUTH_PREFIX}/refresh",
        json={"refresh_token": refresh_tok},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_refresh_token_invalid(async_client):
    """Invalid refresh token returns 401."""
    resp = await async_client.post(
        f"{AUTH_PREFIX}/refresh",
        json={"refresh_token": "not.a.valid.token"},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# /auth/me
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_me_authenticated(async_client, admin_headers):
    """GET /auth/me with valid token returns user info."""
    resp = await async_client.get(f"{AUTH_PREFIX}/me", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == settings.admin_username
    assert data["role"] == "admin"
    assert isinstance(data["permissions"], list)
    assert len(data["permissions"]) > 0


@pytest.mark.asyncio
async def test_me_unauthenticated(async_client):
    """GET /auth/me without token returns 401."""
    resp = await async_client.get(f"{AUTH_PREFIX}/me")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_logout_success(async_client, admin_headers):
    """POST /auth/logout with valid token returns success."""
    resp = await async_client.post(f"{AUTH_PREFIX}/logout", headers=admin_headers)
    assert resp.status_code == 200
    assert "logged out" in resp.json()["message"].lower()


# ---------------------------------------------------------------------------
# Account lockout
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_account_lockout_after_failed_attempts(async_client):
    """5 failed logins lock the account (403)."""
    for _ in range(5):
        await async_client.post(
            f"{AUTH_PREFIX}/login",
            json={
                "username": settings.admin_username,
                "password": "wrongpass1234",
            },
        )

    # 6th attempt should hit the lockout
    resp = await async_client.post(
        f"{AUTH_PREFIX}/login",
        json={
            "username": settings.admin_username,
            "password": "wrongpass1234",
        },
    )
    assert resp.status_code == 403
    assert "locked" in resp.json()["detail"].lower()
