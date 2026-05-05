"""
This is just a simple health check endpoint. If you hit /health,
it'll tell you the server is up and running.
"""

from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
async def health_check():
    return {"status": "ok"}