"""
Sprint 3, Task 1 (FastAPI skeleton, routing & config — due 05-09-2026):
liveness/health check for the base routing setup.
"""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
