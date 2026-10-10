import pytest

from app.schemas.analysis import URLAnalysisResponse
from app.services.cache import AnalysisCache


class FakeRedisClient:
    """In-memory stand-in for redis.asyncio.Redis - no real server needed to test caching logic."""

    def __init__(self) -> None:
        self.store: dict[str, str] = {}

    async def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        self.store[key] = value


class RaisingRedisClient:
    """Simulates a Redis outage - every call fails, to prove the cache degrades instead of crashing."""

    async def get(self, key: str) -> str | None:
        raise ConnectionError("redis is down")

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        raise ConnectionError("redis is down")


def _sample_response(url: str) -> URLAnalysisResponse:
    return URLAnalysisResponse(url=url, verdict="benign", risk_score=5.0, evidence={"features": {}})


@pytest.mark.asyncio
async def test_cache_miss_returns_none() -> None:
    cache = AnalysisCache(FakeRedisClient(), ttl_seconds=60)
    assert await cache.get("https://example.com") is None


@pytest.mark.asyncio
async def test_set_then_get_round_trips_correctly() -> None:
    cache = AnalysisCache(FakeRedisClient(), ttl_seconds=60)
    response = _sample_response("https://example.com")

    await cache.set("https://example.com", response)
    cached = await cache.get("https://example.com")

    assert cached is not None
    assert cached.url == response.url
    assert cached.verdict == response.verdict
    assert cached.risk_score == response.risk_score


@pytest.mark.asyncio
async def test_different_urls_are_cached_independently() -> None:
    cache = AnalysisCache(FakeRedisClient(), ttl_seconds=60)
    await cache.set("https://a.example", _sample_response("https://a.example"))

    assert await cache.get("https://a.example") is not None
    assert await cache.get("https://b.example") is None


@pytest.mark.asyncio
async def test_read_failure_degrades_to_cache_miss_without_raising() -> None:
    cache = AnalysisCache(RaisingRedisClient(), ttl_seconds=60)
    # must not raise, even though the backend is completely down
    assert await cache.get("https://example.com") is None


@pytest.mark.asyncio
async def test_write_failure_does_not_raise() -> None:
    cache = AnalysisCache(RaisingRedisClient(), ttl_seconds=60)
    # must not raise - a failed cache write should never fail the request it belongs to
    await cache.set("https://example.com", _sample_response("https://example.com"))


@pytest.mark.asyncio
async def test_corrupt_cached_payload_is_treated_as_a_miss() -> None:
    client = FakeRedisClient()
    client.store["url_analysis:https://example.com"] = "not valid json at all"
    cache = AnalysisCache(client, ttl_seconds=60)

    assert await cache.get("https://example.com") is None
