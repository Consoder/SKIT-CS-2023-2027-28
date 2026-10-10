"""
Sprint 6, Task 2 (Redis caching layer — due 15-01-2027):
caches analysis results per URL so repeat lookups return instantly instead
of re-running feature extraction, classification and external threat-intel
calls every time. Built against a small Protocol (not the concrete redis
client) so tests never need a real Redis server. A cache backend failure -
connection refused, corrupt payload, whatever - degrades to a plain cache
miss; it never breaks the request, the same resilience pattern used for
the threat-intel client in Sprint 6 Task 1.
"""

import logging
from typing import Protocol

from app.core.config import get_settings
from app.schemas.analysis import URLAnalysisResponse

logger = logging.getLogger(__name__)

CACHE_KEY_PREFIX = "url_analysis:"


class RedisLike(Protocol):
    async def get(self, key: str) -> str | bytes | None: ...
    async def set(self, key: str, value: str, ex: int | None = None) -> object: ...


class AnalysisCache:
    def __init__(self, client: RedisLike, ttl_seconds: int) -> None:
        self._client = client
        self._ttl_seconds = ttl_seconds

    @staticmethod
    def _key(url: str) -> str:
        return f"{CACHE_KEY_PREFIX}{url}"

    async def get(self, url: str) -> URLAnalysisResponse | None:
        try:
            raw = await self._client.get(self._key(url))
        except Exception as exc:  # noqa: BLE001 - any backend failure is just a cache miss, never a crashed request
            logger.warning("cache read failed, treating as miss: %s", exc)
            return None

        if raw is None:
            return None

        try:
            return URLAnalysisResponse.model_validate_json(raw)
        except ValueError:
            logger.warning("cache hit but payload was invalid, treating as miss")
            return None

    async def set(self, url: str, response: URLAnalysisResponse) -> None:
        try:
            await self._client.set(self._key(url), response.model_dump_json(), ex=self._ttl_seconds)
        except Exception as exc:  # noqa: BLE001 - see get() above
            logger.warning("cache write failed, continuing without caching this result: %s", exc)


def get_default_cache() -> AnalysisCache | None:
    """None means caching is disabled - callers must handle that, never crash app startup for a missing optional dependency."""
    settings = get_settings()
    if not settings.REDIS_URL:
        return None

    import redis.asyncio as redis

    client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return AnalysisCache(client, ttl_seconds=settings.CACHE_TTL_SECONDS)
