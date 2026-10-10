<<<<<<< HEAD
"""
Sprint 3, Task 3 (Orchestration service — due 25-10-2026): proves
AnalysisOrchestrator genuinely wires the three stages together end to end,
not just that each stage is independently correct.
"""

import pytest

from app.schemas.url import URLAnalysisRequest
=======
import asyncio

import pytest
import pytest_asyncio

from app.schemas.analysis import URLAnalysisResponse
from app.schemas.url import URLAnalysisRequest
from app.services.cache import AnalysisCache
>>>>>>> c21d9f7 (test: add backend tests and CI workflow)
from app.services.orchestrator import (
    AnalysisOrchestrator,
    PlaceholderClassifier,
    PlaceholderFeatureExtractor,
    PlaceholderThreatIntelClient,
)


<<<<<<< HEAD
class TestAnalysisOrchestrator:
    @pytest.mark.asyncio
    async def test_analyze_coordinates_all_three_stages(self):
        orchestrator = AnalysisOrchestrator(
            feature_extractor=PlaceholderFeatureExtractor(),
            threat_intel_client=PlaceholderThreatIntelClient(),
            classifier=PlaceholderClassifier(),
        )
        request = URLAnalysisRequest(url="http://google.com@evil.com/login")

        response = await orchestrator.analyze(request)

        assert response.url == request.url
        assert response.verdict == "phishing"
        assert response.risk_score == 85.0
        assert response.evidence["features"]["has_userinfo"] is True
        assert response.evidence["threat_intel"] == {"source": "none", "reputation": "unknown"}

    @pytest.mark.asyncio
    async def test_analyze_uses_injected_threat_intel_result(self):
        class FakeThreatIntelClient:
            async def check(self, url: str) -> dict:
                return {"virustotal": {"malicious_votes": 5}}

        orchestrator = AnalysisOrchestrator(
            feature_extractor=PlaceholderFeatureExtractor(),
            threat_intel_client=FakeThreatIntelClient(),
            classifier=PlaceholderClassifier(),
        )
        request = URLAnalysisRequest(url="https://example.com/clean-looking-link")

        response = await orchestrator.analyze(request)

        assert response.verdict == "phishing"
        assert response.evidence["threat_intel"]["virustotal"]["malicious_votes"] == 5

    @pytest.mark.asyncio
    async def test_benign_url_end_to_end(self):
        orchestrator = AnalysisOrchestrator(
            feature_extractor=PlaceholderFeatureExtractor(),
            threat_intel_client=PlaceholderThreatIntelClient(),
            classifier=PlaceholderClassifier(),
        )
        request = URLAnalysisRequest(url="https://example.com/about")

        response = await orchestrator.analyze(request)

        assert response.verdict == "benign"
        assert response.risk_score == 5.0
=======
class _FakeRedisClient:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}

    async def get(self, key: str):
        return self.store.get(key)

    async def set(self, key: str, value: str, ex=None):
        self.store[key] = value


def _build_placeholder_orchestrator() -> AnalysisOrchestrator:
    """
    Deliberately NOT get_default_orchestrator() - that wires in the real
    VirusTotal/AbuseIPDB client, which would make these tests hit the real
    internet (and depend on whichever API keys happen to be in a
    developer's local .env) the moment real keys are configured. These
    tests are about orchestration logic, not the real API integration -
    that has its own dedicated, hermetic tests in test_threat_intel.py.
    """
    return AnalysisOrchestrator(
        feature_extractor=PlaceholderFeatureExtractor(),
        threat_intel_client=PlaceholderThreatIntelClient(),
        classifier=PlaceholderClassifier(),
    )


@pytest.mark.asyncio
async def test_default_orchestrator_returns_valid_response() -> None:
    orchestrator = _build_placeholder_orchestrator()
    response = await orchestrator.analyze(URLAnalysisRequest(url="https://example.com"))

    assert response.url == "https://example.com"
    assert response.verdict in ("benign", "phishing", "malware", "suspicious")
    assert "features" in response.evidence
    assert "threat_intel" in response.evidence


@pytest.mark.asyncio
async def test_ip_based_url_flagged_suspicious() -> None:
    orchestrator = _build_placeholder_orchestrator()
    response = await orchestrator.analyze(URLAnalysisRequest(url="http://192.168.1.1/login"))

    assert response.verdict == "suspicious"
    assert response.evidence["features"]["has_ip_address"] is True


@pytest.mark.asyncio
async def test_userinfo_disguise_url_flagged_as_phishing() -> None:
    """
    Real bug found live via edge-case testing 2026-09-14: "http://real-looking-site.com@evil.com/"
    is a classic phishing disguise - everything before @ is fake dressing,
    the real host (evil.com) is after it. The old naive host-parsing
    treated the whole "fake@real" string as one host and never noticed.
    """
    orchestrator = _build_placeholder_orchestrator()
    response = await orchestrator.analyze(URLAnalysisRequest(url="http://google.com@evil.com/"))

    assert response.verdict == "phishing"
    assert response.evidence["features"]["has_userinfo"] is True


@pytest.mark.asyncio
async def test_punycode_homograph_domain_flagged_suspicious() -> None:
    """
    Real gap found via edge-case testing 2026-09-14: "xn--pple-43d.com" is
    the punycode encoding of a Cyrillic-lookalike "аpple.com" - a classic
    IDN homograph phishing technique - and used to get zero suspicion.
    """
    orchestrator = _build_placeholder_orchestrator()
    response = await orchestrator.analyze(URLAnalysisRequest(url="http://xn--pple-43d.com/"))

    assert response.verdict == "suspicious"
    assert response.evidence["features"]["is_punycode"] is True


@pytest.mark.asyncio
async def test_normal_url_flagged_benign() -> None:
    orchestrator = _build_placeholder_orchestrator()
    response = await orchestrator.analyze(URLAnalysisRequest(url="https://example.com/about"))

    assert response.verdict == "benign"


@pytest.mark.asyncio
async def test_orchestrator_is_swappable_for_real_implementations() -> None:
    """
    Proves the whole point of building this against Protocols: dropping in a
    fake feature extractor / threat intel client / classifier (standing in
    for the real ML model that lands in Sprint 4) requires zero changes to
    AnalysisOrchestrator itself.
    """

    class FakeFeatureExtractor:
        def extract(self, url: str) -> dict:
            return {"fake": True}

    class FakeThreatIntelClient:
        async def check(self, url: str) -> dict:
            return {"source": "fake-vt", "reputation": "malicious"}

    class FakeClassifier:
        def classify(self, features: dict, threat_intel: dict) -> tuple[str, float]:
            assert features == {"fake": True}
            assert threat_intel["source"] == "fake-vt"
            return "malware", 99.0

    orchestrator = AnalysisOrchestrator(
        feature_extractor=FakeFeatureExtractor(),
        threat_intel_client=FakeThreatIntelClient(),
        classifier=FakeClassifier(),
    )
    response = await orchestrator.analyze(URLAnalysisRequest(url="http://bad-site.example"))

    assert response.verdict == "malware"
    assert response.risk_score == 99.0
    assert response.evidence["features"] == {"fake": True}


@pytest.mark.asyncio
async def test_cache_hit_skips_the_pipeline_entirely() -> None:
    """
    Proves the cache is a real short-circuit, not decorative: on a cache
    hit, feature extraction, threat-intel and classification must never
    run at all - if any of them did, this test would fail immediately via
    the AssertionError below rather than quietly passing.
    """

    class ExplodingFeatureExtractor:
        def extract(self, url: str) -> dict:
            raise AssertionError("must not run on a cache hit")

    class ExplodingThreatIntelClient:
        async def check(self, url: str) -> dict:
            raise AssertionError("must not run on a cache hit")

    class ExplodingClassifier:
        def classify(self, features: dict, threat_intel: dict) -> tuple[str, float]:
            raise AssertionError("must not run on a cache hit")

    cache = AnalysisCache(_FakeRedisClient(), ttl_seconds=60)
    cached_response = URLAnalysisResponse(
        url="https://example.com", verdict="malware", risk_score=95.0, evidence={"cached": True}
    )
    await cache.set("https://example.com", cached_response)

    orchestrator = AnalysisOrchestrator(
        feature_extractor=ExplodingFeatureExtractor(),
        threat_intel_client=ExplodingThreatIntelClient(),
        classifier=ExplodingClassifier(),
        cache=cache,
    )
    response = await orchestrator.analyze(URLAnalysisRequest(url="https://example.com"))

    assert response.verdict == "malware"
    assert response.evidence == {"cached": True}


@pytest.mark.asyncio
async def test_slow_classification_does_not_block_other_requests() -> None:
    """
    Regression test for a real bug found via load testing 2026-09-25:
    classify() used to be called directly (not via asyncio.to_thread) inside
    an async method, so its CPU-bound work blocked the whole event loop -
    concurrent requests queued up behind it instead of running in parallel.
    Proven here with a classifier that does a blocking (non-async) sleep:
    if it still blocks the loop, N concurrent requests take N * sleep time;
    offloaded to a thread, they overlap and take roughly one sleep's worth.
    """
    import time

    SLEEP_SECONDS = 0.2
    CONCURRENT_REQUESTS = 5

    class SlowBlockingClassifier:
        def classify(self, features: dict, threat_intel: dict) -> tuple[str, float]:
            time.sleep(SLEEP_SECONDS)  # deliberately blocking, not asyncio.sleep
            return "benign", 1.0

    orchestrator = AnalysisOrchestrator(
        feature_extractor=PlaceholderFeatureExtractor(),
        threat_intel_client=PlaceholderThreatIntelClient(),
        classifier=SlowBlockingClassifier(),
    )

    start = asyncio.get_event_loop().time()
    await asyncio.gather(
        *[
            orchestrator.analyze(URLAnalysisRequest(url=f"https://example.com/{i}"))
            for i in range(CONCURRENT_REQUESTS)
        ]
    )
    elapsed = asyncio.get_event_loop().time() - start

    # Serialized (the bug): ~= CONCURRENT_REQUESTS * SLEEP_SECONDS (1.0s).
    # Offloaded to threads (the fix): ~= SLEEP_SECONDS, plus scheduling
    # overhead. A generous threshold well below the serialized time proves
    # the requests actually overlapped rather than queuing.
    assert elapsed < SLEEP_SECONDS * (CONCURRENT_REQUESTS / 2)


@pytest.mark.asyncio
async def test_cache_miss_populates_the_cache_for_next_time() -> None:
    cache = AnalysisCache(_FakeRedisClient(), ttl_seconds=60)
    orchestrator = AnalysisOrchestrator(
        feature_extractor=PlaceholderFeatureExtractor(),
        threat_intel_client=PlaceholderThreatIntelClient(),
        classifier=PlaceholderClassifier(),
        cache=cache,
    )

    first = await orchestrator.analyze(URLAnalysisRequest(url="https://example.com/first-time"))
    cached = await cache.get("https://example.com/first-time")

    assert cached is not None
    assert cached.verdict == first.verdict


@pytest.mark.asyncio
async def test_concurrent_requests_for_same_url_are_coalesced() -> None:
    """
    Real fix from stress-testing 2026-09-14: without coalescing, N
    concurrent requests for the same URL during a cache miss each
    independently called the external APIs, multiplying real API load and
    triggering rate-limit retries sooner than necessary. This proves the
    fix: 20 concurrent callers for the identical URL must result in the
    underlying threat-intel check running exactly once.
    """
    call_count = {"n": 0}

    class CountingThreatIntelClient:
        async def check(self, url: str) -> dict:
            call_count["n"] += 1
            await asyncio.sleep(0.05)  # simulates real external API latency
            return {"source": "none", "reputation": "unknown"}

    orchestrator = AnalysisOrchestrator(
        feature_extractor=PlaceholderFeatureExtractor(),
        threat_intel_client=CountingThreatIntelClient(),
        classifier=PlaceholderClassifier(),
    )

    request = URLAnalysisRequest(url="https://example.com/coalesce-test")
    responses = await asyncio.gather(*[orchestrator.analyze(request) for _ in range(20)])

    assert call_count["n"] == 1, f"expected exactly 1 real call, got {call_count['n']}"
    assert all(r.verdict == responses[0].verdict for r in responses)


@pytest.mark.asyncio
async def test_coalescing_does_not_leak_state_between_different_urls() -> None:
    call_count = {"n": 0}

    class CountingThreatIntelClient:
        async def check(self, url: str) -> dict:
            call_count["n"] += 1
            return {"source": "none", "reputation": "unknown"}

    orchestrator = AnalysisOrchestrator(
        feature_extractor=PlaceholderFeatureExtractor(),
        threat_intel_client=CountingThreatIntelClient(),
        classifier=PlaceholderClassifier(),
    )

    await asyncio.gather(
        orchestrator.analyze(URLAnalysisRequest(url="https://a.example")),
        orchestrator.analyze(URLAnalysisRequest(url="https://b.example")),
    )

    assert call_count["n"] == 2  # different URLs must NOT be coalesced together
    assert orchestrator._in_flight == {}  # no leftover entries after completion


@pytest.mark.asyncio
async def test_placeholder_pieces_are_independently_usable() -> None:
    extractor = PlaceholderFeatureExtractor()
    intel = PlaceholderThreatIntelClient()
    classifier = PlaceholderClassifier()

    features = extractor.extract("https://sub.example.com")
    assert features["subdomain_count"] == 1

    assert (await intel.check("https://example.com"))["source"] == "none"

    verdict, score = classifier.classify({"url_length": 200}, {})
    assert verdict == "suspicious"
    assert score > 0


@pytest.mark.asyncio
async def test_slow_threat_intel_times_out_instead_of_blocking() -> None:
    """
    Perf fix from stress-testing 2026-09-14: a slow external API used to
    hold up the whole response. This proves analyze() returns quickly
    (well under the real API's delay) with a degraded-but-honest result
    once THREAT_INTEL_TIMEOUT_SECONDS elapses.
    """

    class SlowThreatIntelClient:
        async def check(self, url: str) -> dict:
            await asyncio.sleep(5.0)  # much slower than the timeout below
            return {"source": "none", "reputation": "unknown"}

    orchestrator = AnalysisOrchestrator(
        feature_extractor=PlaceholderFeatureExtractor(),
        threat_intel_client=SlowThreatIntelClient(),
        classifier=PlaceholderClassifier(),
        threat_intel_timeout_seconds=0.1,
    )

    start = asyncio.get_event_loop().time()
    response = await orchestrator.analyze(URLAnalysisRequest(url="https://example.com"))
    elapsed = asyncio.get_event_loop().time() - start

    assert elapsed < 1.0, f"should have timed out around 0.1s, took {elapsed:.2f}s"
    assert response.evidence["threat_intel"]["timed_out"] is True
    assert response.verdict == "benign"  # classifier still runs on features alone


@pytest.mark.asyncio
async def test_timed_out_result_is_not_cached() -> None:
    class SlowThreatIntelClient:
        async def check(self, url: str) -> dict:
            await asyncio.sleep(5.0)
            return {"source": "none", "reputation": "unknown"}

    cache = AnalysisCache(_FakeRedisClient(), ttl_seconds=60)
    orchestrator = AnalysisOrchestrator(
        feature_extractor=PlaceholderFeatureExtractor(),
        threat_intel_client=SlowThreatIntelClient(),
        classifier=PlaceholderClassifier(),
        cache=cache,
        threat_intel_timeout_seconds=0.1,
    )

    await orchestrator.analyze(URLAnalysisRequest(url="https://example.com"))

    # a timed-out result must not be cached - the next request should get a
    # fresh, full-timeout attempt rather than being stuck with this one
    assert await cache.get("https://example.com") is None


@pytest_asyncio.fixture
async def db_session_factory():
    # In-memory SQLite, same pattern as test_db_models.py - proves the
    # persistence wiring itself, not a real Postgres deployment.
    from app.db.models import Base
    from app.db.session import create_engine, create_session_factory

    engine = create_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield create_session_factory(engine)
    await engine.dispose()


@pytest.mark.asyncio
async def test_analyze_persists_to_db_when_a_session_factory_is_configured(db_session_factory) -> None:
    """
    Real gap found 2026-09-14, closed 2026-09-25: the DB schema existed
    but nothing ever actually wrote to it. Proves a real row lands in
    url_analysis + threat_intelligence after a single analyze() call.
    """
    from sqlalchemy import select

    from app.db.models import ThreatIntelligence, URLAnalysis

    orchestrator = AnalysisOrchestrator(
        feature_extractor=PlaceholderFeatureExtractor(),
        threat_intel_client=PlaceholderThreatIntelClient(),
        classifier=PlaceholderClassifier(),
        db_session_factory=db_session_factory,
    )

    response = await orchestrator.analyze(URLAnalysisRequest(url="https://example.com/persist-test"))

    async with db_session_factory() as session:
        row = (
            await session.execute(select(URLAnalysis).where(URLAnalysis.url == "https://example.com/persist-test"))
        ).scalar_one()
        assert row.verdict == response.verdict
        assert row.risk_score == response.risk_score

        ti_row = (
            await session.execute(select(ThreatIntelligence).where(ThreatIntelligence.analysis_id == row.id))
        ).scalar_one()
        assert ti_row.source == "none"


@pytest.mark.asyncio
async def test_db_outage_does_not_break_the_response() -> None:
    """A DB failure must degrade gracefully, same as cache/threat-intel -
    the caller still gets a real verdict even if persistence fails."""

    class ExplodingSessionFactory:
        def __call__(self):
            raise ConnectionError("db unreachable")

    orchestrator = AnalysisOrchestrator(
        feature_extractor=PlaceholderFeatureExtractor(),
        threat_intel_client=PlaceholderThreatIntelClient(),
        classifier=PlaceholderClassifier(),
        db_session_factory=ExplodingSessionFactory(),
    )

    response = await orchestrator.analyze(URLAnalysisRequest(url="https://example.com"))
    assert response.verdict in ("benign", "phishing", "malware", "suspicious")


@pytest.mark.asyncio
async def test_successful_blockchain_anchor_creates_an_audit_log_row(db_session_factory) -> None:
    from sqlalchemy import select

    from app.db.models import AuditLog, URLAnalysis

    class FakeBlockchainLogger:
        def anchor(self, payload: dict) -> dict:
            return {"tx_hash": "0xabc123", "content_hash": "deadbeef", "block_number": 1}

    orchestrator = AnalysisOrchestrator(
        feature_extractor=PlaceholderFeatureExtractor(),
        threat_intel_client=PlaceholderThreatIntelClient(),
        classifier=PlaceholderClassifier(),
        db_session_factory=db_session_factory,
        blockchain_logger=FakeBlockchainLogger(),
    )

    await orchestrator.analyze(URLAnalysisRequest(url="https://example.com/anchor-test"))

    async with db_session_factory() as session:
        analysis = (
            await session.execute(select(URLAnalysis).where(URLAnalysis.url == "https://example.com/anchor-test"))
        ).scalar_one()
        audit_row = (
            await session.execute(select(AuditLog).where(AuditLog.analysis_id == analysis.id))
        ).scalar_one()
        assert audit_row.tx_hash == "0xabc123"
        assert audit_row.content_hash == "deadbeef"


@pytest.mark.asyncio
async def test_db_write_retries_before_giving_up(db_session_factory) -> None:
    """
    Real fix 2026-09-25: a transient DB blip (fails twice, works the third
    time) must not lose the analysis - the old behavior gave up after the
    very first failure.
    """
    from sqlalchemy import select

    from app.db.models import URLAnalysis

    call_count = {"n": 0}

    class FlakySessionFactory:
        def __call__(self):
            call_count["n"] += 1
            if call_count["n"] < 3:
                raise ConnectionError("transient db blip")
            return db_session_factory()

    orchestrator = AnalysisOrchestrator(
        feature_extractor=PlaceholderFeatureExtractor(),
        threat_intel_client=PlaceholderThreatIntelClient(),
        classifier=PlaceholderClassifier(),
        db_session_factory=FlakySessionFactory(),
    )

    await orchestrator.analyze(URLAnalysisRequest(url="https://example.com/flaky-test"))

    assert call_count["n"] == 3, "should have retried twice before the 3rd attempt succeeded"
    async with db_session_factory() as session:
        row = (
            await session.execute(select(URLAnalysis).where(URLAnalysis.url == "https://example.com/flaky-test"))
        ).scalar_one()
        assert row.url == "https://example.com/flaky-test"


@pytest.mark.asyncio
async def test_persistent_db_outage_writes_to_dead_letter_file(tmp_path, monkeypatch) -> None:
    """
    Real gap found 2026-09-14, closed 2026-09-25: a DB outage used to just
    silently drop the analysis. Now, after exhausting retries, the full
    record lands in a local file instead of being lost.
    """
    import app.services.orchestrator as orchestrator_module

    dead_letter_path = tmp_path / "db_dead_letter.jsonl"
    monkeypatch.setattr(orchestrator_module, "DEAD_LETTER_PATH", dead_letter_path)
    monkeypatch.setattr(orchestrator_module, "DB_RETRY_BACKOFF_SECONDS", 0.0)  # don't actually wait in tests

    class AlwaysExplodingSessionFactory:
        def __call__(self):
            raise ConnectionError("db is fully down")

    orchestrator = AnalysisOrchestrator(
        feature_extractor=PlaceholderFeatureExtractor(),
        threat_intel_client=PlaceholderThreatIntelClient(),
        classifier=PlaceholderClassifier(),
        db_session_factory=AlwaysExplodingSessionFactory(),
    )

    response = await orchestrator.analyze(URLAnalysisRequest(url="https://example.com/dead-letter-test"))

    assert response.verdict in ("benign", "phishing", "malware", "suspicious")  # response still returned
    assert dead_letter_path.exists()

    import json

    record = json.loads(dead_letter_path.read_text().strip())
    assert record["url"] == "https://example.com/dead-letter-test"
    assert record["verdict"] == response.verdict
>>>>>>> c21d9f7 (test: add backend tests and CI workflow)
