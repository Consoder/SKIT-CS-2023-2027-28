"""
Shared FastAPI dependencies for the API layer. Added 2026-09-25 alongside
real per-user auth (app/core/security.py) - orchestrator.py already had its
own DB session factory wired in for persistence, but no endpoint had a way
to get a DB session directly (register/login need one to read/write users).
"""

import logging
from collections.abc import AsyncIterator
from functools import lru_cache

from fastapi import Header
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.errors import AppError
from app.core.security import InvalidTokenError, decode_access_token
from app.db.session import create_engine, create_session_factory

logger = logging.getLogger(__name__)


@lru_cache
def _get_session_factory() -> async_sessionmaker[AsyncSession]:
    # Cached so the engine (and its connection pool) is created once per
    # process, not per request - same reasoning as get_orchestrator() in
    # analyze.py.
    return create_session_factory(create_engine())


async def get_db_session() -> AsyncIterator[AsyncSession]:
    session_factory = _get_session_factory()
    async with session_factory() as session:
        yield session


async def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    """
    Required auth: raises AppError (401) if missing/invalid. Used by
    endpoints that need a real logged-in user, not just an optional one.
    """
    if authorization is None or not authorization.startswith("Bearer "):
        raise AppError("Missing or invalid bearer token", status_code=401, error_code="unauthorized")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        return decode_access_token(token)
    except InvalidTokenError as exc:
        # Real gap found via live testing 2026-09-25: this used to include
        # str(exc) in the client-facing message - for a malformed token
        # that leaked the underlying jwt library's raw decode error
        # ("'utf-8' codec can't decode byte 0x81...") straight to the
        # client, the same class of internal-detail leak the DEBUG=False
        # fix (see README.md "Security notes") exists to prevent elsewhere.
        # The real reason is logged server-side; the client gets a generic
        # message either way.
        logger.info("rejected invalid/expired token: %s", exc)
        raise AppError("Invalid or expired token", status_code=401, error_code="unauthorized") from exc


async def get_current_user_optional(authorization: str | None = Header(default=None)) -> dict | None:
    """
    Optional auth for /analyze: attributes the analysis to a logged-in user
    when a valid Bearer token is supplied, but doesn't require one - same
    optional-by-default philosophy as API_KEY (core/auth.py), so anonymous/
    service access via the existing shared key keeps working unchanged. A
    token that IS supplied but invalid/expired still fails loudly (401)
    rather than being silently treated as anonymous - a caller presenting a
    bad token almost certainly expected to be authenticated, and silently
    downgrading that to "anonymous" would hide the failure instead of
    surfacing it.
    """
    if authorization is None:
        return None
    return await get_current_user(authorization)
