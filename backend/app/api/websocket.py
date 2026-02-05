"""
WebSocket endpoint for real-time updates
"""

import asyncio
import json
import logging
from typing import Set, Dict, Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.core.security import verify_token
from app.services.sliver_client import sliver_manager

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    """Manage WebSocket connections"""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, client_id: str) -> None:
        await websocket.accept()
        async with self._lock:
            self.active_connections[client_id] = websocket
        logger.info(f"WebSocket connected: {client_id}")

    async def disconnect(self, client_id: str) -> None:
        async with self._lock:
            if client_id in self.active_connections:
                del self.active_connections[client_id]
        logger.info(f"WebSocket disconnected: {client_id}")

    async def broadcast(self, message: Dict[str, Any]) -> None:
        """Broadcast message to all connected clients"""
        async with self._lock:
            disconnected = []
            for client_id, connection in self.active_connections.items():
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending to {client_id}: {e}")
                    disconnected.append(client_id)

            for client_id in disconnected:
                del self.active_connections[client_id]

    async def send_personal(self, client_id: str, message: Dict[str, Any]) -> None:
        """Send message to specific client"""
        async with self._lock:
            if client_id in self.active_connections:
                try:
                    await self.active_connections[client_id].send_json(message)
                except Exception as e:
                    logger.error(f"Error sending to {client_id}: {e}")


manager = ConnectionManager()


async def sync_sliver_events():
    """
    Background task to sync Sliver events and broadcast to clients

    This would ideally use Sliver's event stream, but for now we poll.
    """
    previous_sessions = set()
    previous_beacons = set()

    while True:
        try:
            if sliver_manager.is_connected:
                # Check for new/lost sessions
                current_sessions = set()
                sessions = await sliver_manager.get_sessions()
                for session in sessions:
                    current_sessions.add(session["id"])

                # New sessions
                new_sessions = current_sessions - previous_sessions
                for session_id in new_sessions:
                    session = next(
                        (s for s in sessions if s["id"] == session_id), None
                    )
                    if session:
                        await manager.broadcast({
                            "event": "session.new",
                            "data": session,
                        })

                # Lost sessions
                lost_sessions = previous_sessions - current_sessions
                for session_id in lost_sessions:
                    await manager.broadcast({
                        "event": "session.lost",
                        "data": {"id": session_id},
                    })

                previous_sessions = current_sessions

                # Check for beacons
                current_beacons = set()
                beacons = await sliver_manager.get_beacons()
                for beacon in beacons:
                    current_beacons.add(beacon["id"])

                # New beacons
                new_beacons = current_beacons - previous_beacons
                for beacon_id in new_beacons:
                    beacon = next(
                        (b for b in beacons if b["id"] == beacon_id), None
                    )
                    if beacon:
                        await manager.broadcast({
                            "event": "beacon.new",
                            "data": beacon,
                        })

                previous_beacons = current_beacons

        except Exception as e:
            logger.error(f"Error in sync task: {e}")

        # Poll every 5 seconds
        await asyncio.sleep(5)


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(None),
):
    """
    WebSocket endpoint for real-time updates

    Connect with: ws://host/ws?token=<jwt_token>
    """
    # Authenticate
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    payload = verify_token(token, token_type="access")
    if not payload:
        await websocket.close(code=4001, reason="Invalid token")
        return

    user_id = payload.get("sub")
    client_id = f"user_{user_id}_{id(websocket)}"

    await manager.connect(websocket, client_id)

    try:
        # Send initial state
        await websocket.send_json({
            "event": "connected",
            "data": {
                "client_id": client_id,
                "sliver_connected": sliver_manager.is_connected,
            },
        })

        # Keep connection alive and handle client messages
        while True:
            try:
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=30.0,
                )

                message = json.loads(data)
                event_type = message.get("type")

                if event_type == "ping":
                    await websocket.send_json({"event": "pong"})

                elif event_type == "subscribe":
                    # Handle subscription requests
                    channels = message.get("channels", [])
                    await websocket.send_json({
                        "event": "subscribed",
                        "data": {"channels": channels},
                    })

            except asyncio.TimeoutError:
                # Send ping to keep alive
                await websocket.send_json({"event": "ping"})

            except json.JSONDecodeError:
                await websocket.send_json({
                    "event": "error",
                    "data": {"message": "Invalid JSON"},
                })

    except WebSocketDisconnect:
        await manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await manager.disconnect(client_id)


websocket_router = router
