"""
Tests for user-management endpoints (/api/v1/users/*).
All endpoints require admin role.
"""

import pytest

from app.core.config import settings

USERS_PREFIX = "/api/v1/users"


# ---------------------------------------------------------------------------
# List users
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_users_as_admin(async_client, admin_headers):
    """Admin can list users; at least the seeded admin is present."""
    resp = await async_client.get(USERS_PREFIX, headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    usernames = [u["username"] for u in data["users"]]
    assert settings.admin_username in usernames


@pytest.mark.asyncio
async def test_list_users_unauthenticated(async_client):
    """Unauthenticated request to list users returns 401."""
    resp = await async_client.get(USERS_PREFIX)
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Create user
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_user(async_client, admin_headers):
    """Admin can create a new user."""
    resp = await async_client.post(
        USERS_PREFIX,
        headers=admin_headers,
        json={
            "username": "testoper",
            "password": "securepassword1",
            "email": "testoper@test.local",
            "role_id": 2,
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["username"] == "testoper"
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_create_duplicate_username(async_client, admin_headers):
    """Creating a user with an existing username returns 400."""
    payload = {
        "username": "dupuser",
        "password": "securepassword1",
        "role_id": 2,
    }
    resp1 = await async_client.post(USERS_PREFIX, headers=admin_headers, json=payload)
    assert resp1.status_code == 201

    resp2 = await async_client.post(USERS_PREFIX, headers=admin_headers, json=payload)
    assert resp2.status_code == 400
    assert "already exists" in resp2.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Get user by ID
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_user_by_id(async_client, admin_headers):
    """Admin can fetch a user by ID."""
    # Create a user first
    create_resp = await async_client.post(
        USERS_PREFIX,
        headers=admin_headers,
        json={
            "username": "fetchme",
            "password": "securepassword1",
            "role_id": 2,
        },
    )
    user_id = create_resp.json()["id"]

    resp = await async_client.get(f"{USERS_PREFIX}/{user_id}", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["username"] == "fetchme"


# ---------------------------------------------------------------------------
# Update user
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_user(async_client, admin_headers):
    """Admin can update a user's email."""
    create_resp = await async_client.post(
        USERS_PREFIX,
        headers=admin_headers,
        json={
            "username": "updateme",
            "password": "securepassword1",
            "role_id": 2,
        },
    )
    user_id = create_resp.json()["id"]

    resp = await async_client.put(
        f"{USERS_PREFIX}/{user_id}",
        headers=admin_headers,
        json={"email": "new@test.local"},
    )
    assert resp.status_code == 200
    assert resp.json()["email"] == "new@test.local"


# ---------------------------------------------------------------------------
# Delete user
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_user(async_client, admin_headers):
    """Admin can delete another user."""
    create_resp = await async_client.post(
        USERS_PREFIX,
        headers=admin_headers,
        json={
            "username": "deleteme",
            "password": "securepassword1",
            "role_id": 2,
        },
    )
    user_id = create_resp.json()["id"]

    resp = await async_client.delete(
        f"{USERS_PREFIX}/{user_id}", headers=admin_headers
    )
    assert resp.status_code == 200
    assert "deleted" in resp.json()["message"].lower()

    # Verify gone
    get_resp = await async_client.get(
        f"{USERS_PREFIX}/{user_id}", headers=admin_headers
    )
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_admin_cannot_delete_self(async_client, admin_headers):
    """Admin cannot delete their own account."""
    # Get admin user ID via /auth/me
    me_resp = await async_client.get("/api/v1/auth/me", headers=admin_headers)
    admin_id = me_resp.json()["id"]

    resp = await async_client.delete(
        f"{USERS_PREFIX}/{admin_id}", headers=admin_headers
    )
    assert resp.status_code == 400
    assert "cannot delete" in resp.json()["detail"].lower()
