"""
Tests for health-check and root endpoints.
"""

import pytest


@pytest.mark.asyncio
async def test_root_endpoint(async_client):
    """GET / returns welcome message and version."""
    resp = await async_client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert "Welcome to" in data["message"]
    assert "version" in data


@pytest.mark.asyncio
async def test_health_endpoint(async_client):
    """GET /health returns status fields."""
    resp = await async_client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("ok", "degraded")
    assert "version" in data
    assert "database" in data
    assert "sliver_connected" in data


@pytest.mark.asyncio
async def test_health_sliver_disconnected(async_client):
    """Health endpoint reports sliver_connected=False when mocked."""
    resp = await async_client.get("/health")
    data = resp.json()
    assert data["sliver_connected"] is False
