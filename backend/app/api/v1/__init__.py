"""API v1 router"""

from fastapi import APIRouter

from .auth import router as auth_router
from .sessions import router as sessions_router
from .beacons import router as beacons_router
from .listeners import router as listeners_router
from .implants import router as implants_router
from .users import router as users_router
from .notes import router as notes_router
from .armory import router as armory_router
from .cleanup import router as cleanup_router

api_router = APIRouter()

# Include all routers
api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(sessions_router, prefix="/sessions", tags=["Sessions"])
api_router.include_router(beacons_router, prefix="/beacons", tags=["Beacons"])
api_router.include_router(listeners_router, prefix="/listeners", tags=["Listeners"])
api_router.include_router(implants_router, prefix="/implants", tags=["Implants"])
api_router.include_router(users_router, prefix="/users", tags=["Users"])
api_router.include_router(notes_router, prefix="/notes", tags=["Notes & Tags"])
api_router.include_router(armory_router, prefix="/armory", tags=["Armory"])
api_router.include_router(cleanup_router, prefix="/cleanup", tags=["Cleanup"])
