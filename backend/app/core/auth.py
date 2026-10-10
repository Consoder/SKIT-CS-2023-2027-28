"""
Real gap found 2026-09-14, not in any sprint task: /analyze was fully open,
no authentication at all - anyone who found the URL could call it, which is
also exactly what makes the rate limiting in rate_limit.py only a partial
fix (it slows down abuse from one client, it doesn't stop unauthorized use).

Kept intentionally simple - a single shared API key checked via a constant-
time comparison, not a full user/token system. That's proportionate to what
this project needs: one deployed service with a small number of trusted
callers (our own frontend, our own tests), not a multi-tenant product.

Same optional-by-default pattern as everything else in config.py: if
API_KEY isn't set, auth is disabled (open), so local dev and the existing
test suite keep working unchanged. Set API_KEY to actually lock it down.
"""

import secrets

from fastapi import Header

from app.core.config import get_settings
from app.core.errors import AppError


async def verify_api_key(x_api_key: str | None = Header(default=None)) -> None:
    settings = get_settings()
    if settings.API_KEY is None:
        return

    if x_api_key is None or not secrets.compare_digest(x_api_key, settings.API_KEY):
        raise AppError("Missing or invalid API key", status_code=401, error_code="unauthorized")
