"""
Sprint 6, Task 3 (PostgreSQL schema & indexing — due 10-02-2027):
async engine/session factory. DATABASE_URL points at Postgres in
production (Sprint 6, Task 4 wires this into a real deployed instance);
tests use an in-memory SQLite engine instead so the schema itself can be
verified without a running Postgres server.
"""

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings


# Real gap found via extended DB-outage testing 2026-09-25: with no
# explicit timeout, a single failed connection attempt (Postgres down/
# unreachable) took ~7s here - not from any retry logic, just the
# underlying OS-level DNS-failure resolution being slow. Combined with
# orchestrator.py's own DB_RETRY_ATTEMPTS=3 + backoff, that pushed a single
# /analyze request past 20s during an outage - technically still graceful
# (falls back to the dead-letter log and returns 200), but slow enough to
# trip client-side timeouts and tie up a worker for a long time. An
# explicit, short connect timeout makes each attempt fail fast instead,
# keeping the existing retry+backoff design's total worst-case bounded.
DB_CONNECT_TIMEOUT_SECONDS = 3


def create_engine(database_url: str | None = None) -> AsyncEngine:
    url = database_url or get_settings().DATABASE_URL
    return create_async_engine(url, connect_args={"timeout": DB_CONNECT_TIMEOUT_SECONDS})


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)
