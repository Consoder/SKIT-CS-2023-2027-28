"""
Sprint 3, Task 1 (base routing — due 05-09-2026), extended in Task 4 to
also mount the /analyze endpoint (due 20-11-2026).
"""

from fastapi import APIRouter

from app.api.v1.endpoints import analyze, auth, health

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(analyze.router)
api_router.include_router(auth.router)
