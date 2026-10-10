"""
Real gap identified 2026-09-14, not part of any sprint task: /analyze had
no rate limiting at all. We proved the real risk on ourselves during
stress testing by exhausting VirusTotal's actual free-tier quota.

Backed by Redis when configured, not in-memory - a single process's
in-memory counter would NOT work correctly once deployed across multiple
worker processes (Docker now defaults to 4 workers, see Dockerfile). Each
process would keep its own separate counter, letting a client get roughly
4x the intended limit by chance of which worker handled which request.
Falls back to in-memory when Redis isn't configured (dev), and to a
per-process in-memory limiter if a *configured* Redis becomes unreachable
at runtime - same graceful-degradation pattern as caching and threat-intel
elsewhere in this app.

Real gap found via extended-outage testing 2026-09-25: that second case
("Redis is configured but currently down") was NOT actually handled before
this fix, despite this docstring already claiming it was - slowapi's
Limiter only falls back to in-memory storage when `in_memory_fallback` /
`in_memory_fallback_enabled` is explicitly set, and it wasn't. A stopped
Redis container caused every single `/analyze` request to fail with an
uncaught `redis.exceptions.ConnectionError` -> 500 (no internals leaked,
per the earlier security work, but every request still failed). Fixed by
passing `in_memory_fallback_enabled=True`, which is slowapi's own built-in
mechanism for exactly this: it catches storage errors, marks the Redis
backend dead, and switches to an in-memory limiter (still correctly
enforcing ANALYZE_RATE_LIMIT, just per-process instead of shared) for the
rest of that process's lifetime. Verified live: stopped the Redis
container, confirmed requests kept succeeding instead of 500ing, restarted
Redis, confirmed shared rate limiting resumed.
"""

from fastapi import Request, status
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import get_settings
from app.core.errors import build_error_body


def _storage_uri() -> str:
    settings = get_settings()
    return settings.REDIS_URL or "memory://"


limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=_storage_uri(),
    in_memory_fallback_enabled=True,
)


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content=build_error_body("rate_limit_exceeded", f"Rate limit exceeded: {exc.detail}"),
    )
