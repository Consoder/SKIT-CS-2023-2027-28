"""
Sprint 3, Task 1 (base routing — due 05-09-2026).
"""

from fastapi import APIRouter

from app.api.v1.endpoints import health

api_router = APIRouter()
api_router.include_router(health.router)
