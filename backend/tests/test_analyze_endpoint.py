import pytest
from fastapi.testclient import TestClient

from app.api.v1.endpoints.analyze import get_orchestrator
from app.core.rate_limit import limiter
from app.main import app
from app.services.orchestrator import (
    AnalysisOrchestrator,
    PlaceholderClassifier,
    PlaceholderFeatureExtractor,
    PlaceholderThreatIntelClient,
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def _use_placeholder_orchestrator():
    """
    Without this, these tests hit the real /analyze endpoint's real,
    settings-driven orchestrator - meaning they'd start making real
    VirusTotal/AbuseIPDB network calls the moment real API keys land in a
    developer's local .env (confirmed: this made the suite go from ~4s to
    ~11s once real keys were added, 2026-09-13). Endpoint tests should stay
    fast and hermetic regardless of local environment state.
    """
    app.dependency_overrides[get_orchestrator] = lambda: AnalysisOrchestrator(
        feature_extractor=PlaceholderFeatureExtractor(),
        threat_intel_client=PlaceholderThreatIntelClient(),
        classifier=PlaceholderClassifier(),
    )
    yield
    app.dependency_overrides.pop(get_orchestrator, None)


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """
    All requests in this file share one TestClient, which slowapi sees as
    one client (same key). Without resetting between tests, a test that
    deliberately exceeds the limit would leave every test that runs after
    it incorrectly getting 429 too - a real cross-test pollution risk, not
    a hypothetical one.
    """
    limiter.reset()
    yield
    limiter.reset()


def test_analyze_valid_url_returns_verdict() -> None:
    response = client.post("/api/v1/analyze", json={"url": "https://example.com"})
    assert response.status_code == 200

    body = response.json()
    assert body["url"] == "https://example.com"
    assert body["verdict"] in ("benign", "phishing", "malware", "suspicious")
    assert 0 <= body["risk_score"] <= 100
    assert "features" in body["evidence"]


def test_analyze_ip_url_flagged_suspicious() -> None:
    response = client.post("/api/v1/analyze", json={"url": "http://192.168.1.1/login"})
    assert response.status_code == 200
    assert response.json()["verdict"] == "suspicious"


def test_analyze_rejects_malformed_url_with_structured_error() -> None:
    response = client.post("/api/v1/analyze", json={"url": "   "})
    assert response.status_code == 422

    body = response.json()
    assert body["error"]["code"] == "validation_error"


def test_analyze_rejects_missing_url_field() -> None:
    response = client.post("/api/v1/analyze", json={})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_analyze_endpoint_uses_dependency_injected_orchestrator() -> None:
    """
    End-to-end proof that a real client hitting the real endpoint gets served
    by whatever orchestrator is wired in via dependency override - this is
    exactly the mechanism that swaps in the real ML model / VirusTotal
    client in later sprints without touching this endpoint's code.
    """

    class StubOrchestrator:
        async def analyze(self, request, user_id=None):
            from app.schemas.analysis import URLAnalysisResponse

            return URLAnalysisResponse(
                url=request.url,
                verdict="malware",
                risk_score=100.0,
                evidence={"stub": True},
            )

    app.dependency_overrides[get_orchestrator] = lambda: StubOrchestrator()
    try:
        response = client.post("/api/v1/analyze", json={"url": "https://example.com"})
        assert response.status_code == 200
        body = response.json()
        assert body["verdict"] == "malware"
        assert body["evidence"] == {"stub": True}
    finally:
        app.dependency_overrides.clear()


def test_rate_limit_blocks_excess_requests_with_structured_error() -> None:
    """
    Real gap found 2026-09-14, not part of any sprint task: /analyze had
    no rate limiting at all - we exhausted VirusTotal's real quota on
    ourselves during stress testing. This proves the fix: requests past
    the configured limit get a real 429 in our own error format, not a
    generic one.
    """
    from app.core.config import get_settings

    limit = int(get_settings().ANALYZE_RATE_LIMIT.split("/")[0])

    for _ in range(limit):
        response = client.post("/api/v1/analyze", json={"url": "https://example.com"})
        assert response.status_code == 200

    blocked = client.post("/api/v1/analyze", json={"url": "https://example.com"})
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "rate_limit_exceeded"


def test_analyze_survives_rate_limit_storage_outage() -> None:
    """
    Real gap found via extended-outage testing 2026-09-25: stopping the
    Redis container (simulating a real runtime outage, not just "Redis
    unconfigured") made every /analyze request fail with an uncaught
    redis.exceptions.ConnectionError -> 500, contradicting this rate
    limiter's own docstring claim of graceful degradation. Fixed by
    enabling slowapi's built-in in_memory_fallback_enabled. Reproduced here
    by making the limiter's storage backend raise on every call (same
    failure shape as a dead Redis connection) and asserting the request
    still succeeds instead of 500ing.
    """

    class _ExplodingStorage:
        def __getattr__(self, name):
            def _raise(*args, **kwargs):
                raise ConnectionError("simulated Redis outage")

            return _raise

    original_storage = limiter._storage
    original_dead_flag = limiter._storage_dead
    limiter._storage = _ExplodingStorage()
    limiter._storage_dead = False
    try:
        response = client.post("/api/v1/analyze", json={"url": "https://example.com"})
        assert response.status_code == 200
    finally:
        limiter._storage = original_storage
        limiter._storage_dead = original_dead_flag


def test_analyze_rejects_missing_api_key_when_configured() -> None:
    """
    Real gap found 2026-09-14, not part of any sprint task: /analyze was
    fully open, no authentication at all. When an API_KEY is configured,
    a request with no key at all must be rejected, not silently allowed.
    """
    from app.core.config import get_settings

    settings = get_settings()
    original = settings.API_KEY
    settings.API_KEY = "test-secret-key"
    try:
        response = client.post("/api/v1/analyze", json={"url": "https://example.com"})
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "unauthorized"
    finally:
        settings.API_KEY = original


def test_analyze_rejects_wrong_api_key_when_configured() -> None:
    from app.core.config import get_settings

    settings = get_settings()
    original = settings.API_KEY
    settings.API_KEY = "test-secret-key"
    try:
        response = client.post(
            "/api/v1/analyze",
            json={"url": "https://example.com"},
            headers={"X-API-Key": "wrong-key"},
        )
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "unauthorized"
    finally:
        settings.API_KEY = original


def test_analyze_accepts_correct_api_key_when_configured() -> None:
    from app.core.config import get_settings

    settings = get_settings()
    original = settings.API_KEY
    settings.API_KEY = "test-secret-key"
    try:
        response = client.post(
            "/api/v1/analyze",
            json={"url": "https://example.com"},
            headers={"X-API-Key": "test-secret-key"},
        )
        assert response.status_code == 200
    finally:
        settings.API_KEY = original


def test_analyze_allows_missing_api_key_when_not_configured() -> None:
    """
    Default state (no API_KEY set): auth is a no-op, matching every other
    optional setting in config.py - local dev and the rest of this test
    file must keep working unauthenticated.
    """
    from app.core.config import get_settings

    assert get_settings().API_KEY is None
    response = client.post("/api/v1/analyze", json={"url": "https://example.com"})
    assert response.status_code == 200
