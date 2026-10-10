"""
Sprint 3, Task 3 (Orchestration service — due 25-10-2026):
coordinates feature-extraction, threat-intelligence and ML detection into
one flow behind a single call. Built against small Protocols so the
placeholder implementations below can be swapped for the real trained
model (Sprint 4) without changing the orchestrator or its call sites.

Sprint 6, Task 1 (VirusTotal & AbuseIPDB integration — due 15-12-2026):
threat-intel is now a real, awaited external call (see threat_intel.py),
so analyze() is async - a slow/rate-limited provider no longer has any way
to block other requests on the same worker.

Sprint 6, Task 2 (Redis caching layer — due 15-01-2027):
analyze() checks the cache first and returns instantly on a hit, skipping
feature extraction, classification and both external API calls entirely.

Request coalescing (perf fix, found during stress testing 2026-09-14):
concurrent requests for the SAME url during a cache miss used to each
independently call the external APIs - under real load this multiplied
VirusTotal/AbuseIPDB traffic. Now only the first request for a given url
does the real work; concurrent duplicates await that same in-flight result
instead of starting their own. Per-process only - a multi-instance
deployment would need a distributed lock (e.g. Redis-based) for the same
effect cluster-wide, which is a deliberate scope boundary, not an oversight.
This alone did not fix the tail latency below - re-measured after
implementing it and the multi-second p95/p99 was still present, traced to
genuine third-party API response-time variance, not duplicate calls.

Threat-intel timeout (perf fix, stress testing 2026-09-14): a slow or
retry-backing-off external API used to hold up the entire response for as
long as it took to answer. Past THREAT_INTEL_TIMEOUT_SECONDS, the request
proceeds with threat-intel marked unavailable/timed-out instead of waiting
- a deliberate speed-over-completeness tradeoff. Timed-out results are
never cached, so the next lookup for that url gets a fresh, full-timeout
chance rather than being stuck with a degraded verdict for the cache TTL.

DB write retry + dead-letter (real gap found 2026-09-14, closed 2026-09-25):
a DB outage used to just silently drop the analysis after logging a
warning - no retry, no way to recover it later. Now retries a few times
with backoff first (covers the common case: a brief connection blip), and
if the DB is genuinely down, writes the full record to a local JSONL file
instead of just losing it - see scripts/replay_dead_letter.py to
re-persist those once the DB is back.
"""

import asyncio
import ipaddress
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol
from urllib.parse import urlparse

from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import get_settings
from app.schemas.analysis import URLAnalysisResponse, Verdict
from app.schemas.url import URLAnalysisRequest
from app.services.cache import AnalysisCache, get_default_cache
from app.services.threat_intel import VirusTotalAbuseIPDBClient

DB_RETRY_ATTEMPTS = 3
DB_RETRY_BACKOFF_SECONDS = 0.5
DEAD_LETTER_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "db_dead_letter.jsonl"

logger = logging.getLogger(__name__)


def _write_dead_letter(
    request: URLAnalysisRequest,
    response: URLAnalysisResponse,
    threat_intel: dict,
    anchor_result: dict | None,
    user_id: uuid.UUID | None = None,
) -> None:
    """
    Last resort when every DB retry has failed - append the full record to
    a local file instead of losing it. Appending is deliberately the only
    operation here (no read-modify-write), so two requests failing at the
    same moment can't corrupt each other's records the way a shared
    in-memory list or non-atomic file rewrite could.
    """
    try:
        DEAD_LETTER_PATH.parent.mkdir(parents=True, exist_ok=True)
        record = {
            "url": request.url,
            "verdict": response.verdict,
            "risk_score": response.risk_score,
            "features": response.evidence.get("features", {}),
            "threat_intel": threat_intel,
            "anchor_result": anchor_result,
            "user_id": str(user_id) if user_id is not None else None,
            "failed_at": datetime.now(timezone.utc).isoformat(),
        }
        with open(DEAD_LETTER_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")
    except Exception as exc:  # noqa: BLE001 - this is already the last-resort path
        logger.error("dead-letter write also failed - this analysis is genuinely unrecoverable: %s", exc)


def _is_ip_address(host: str) -> bool:
    """IPv4 or IPv6 literal host - a raw-IP URL is a real suspicious signal either way."""
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        return False


def _extract_host(url: str) -> str:
    """
    Real bug fixed 2026-09-14 (found via edge-case testing): the old naive
    string-splitting version treated everything before the first "/" as the
    host, including embedded userinfo. For "http://google.com@evil.com/" -
    a classic phishing pattern where the real host (evil.com, after the @)
    is disguised behind a fake-looking domain before it - this returned
    "google.com@evil.com" as one string instead of the real host. urlparse
    already handles userinfo correctly; there was no reason to hand-roll it.
    """
    return urlparse(url).hostname or ""


def _has_userinfo(url: str) -> bool:
    """Detects the "http://realsite.com@evil.com/" disguise pattern directly."""
    return urlparse(url).username is not None


class FeatureExtractor(Protocol):
    def extract(self, url: str) -> dict: ...


class ThreatIntelClient(Protocol):
    async def check(self, url: str) -> dict: ...


class Classifier(Protocol):
    def classify(self, features: dict, threat_intel: dict) -> tuple[Verdict, float]: ...


class PlaceholderFeatureExtractor:
    """Minimal lexical checks. Replaced by the real feature pipeline in Sprint 4."""

    def extract(self, url: str) -> dict:
        host = _extract_host(url)
        return {
            "url_length": len(url),
            "has_ip_address": _is_ip_address(host),
            "subdomain_count": max(host.count(".") - 1, 0),
            "has_userinfo": _has_userinfo(url),
            # Real gap found via edge-case testing 2026-09-14:
            # "xn--pple-43d.com" is the punycode encoding of a
            # Cyrillic-lookalike "аpple.com" - a classic IDN homograph
            # phishing technique - and had zero signal before this.
            "is_punycode": any(label.startswith("xn--") for label in host.split(".")),
        }


class PlaceholderThreatIntelClient:
    """Used only when no real client is supplied (e.g. isolated unit tests)."""

    async def check(self, url: str) -> dict:
        return {"source": "none", "reputation": "unknown"}


class PlaceholderClassifier:
    """Heuristic stand-in. Replaced by the trained XGBoost model in Sprint 4."""

    def classify(self, features: dict, threat_intel: dict) -> tuple[Verdict, float]:
        if features.get("has_userinfo"):
            # "http://realsite.com@evil.com/" - the part before @ is fake
            # dressing, the real host is after it. Classic phishing disguise.
            return "phishing", 85.0
        if features.get("has_ip_address"):
            return "suspicious", 60.0
        if features.get("is_punycode"):
            # Not automatically phishing - legitimate internationalized
            # domains use punycode too - but it's a real homograph-attack
            # signal worth surfacing, not silently ignoring.
            return "suspicious", 50.0
        if features.get("url_length", 0) > 100:
            return "suspicious", 55.0

        vt = threat_intel.get("virustotal", {})
        abuse = threat_intel.get("abuseipdb", {})
        if vt.get("malicious_votes", 0) > 0 or abuse.get("abuse_confidence_score", 0) >= 50:
            return "phishing", 80.0

        return "benign", 5.0


class AnalysisOrchestrator:
    def __init__(
        self,
        feature_extractor: FeatureExtractor,
        threat_intel_client: ThreatIntelClient,
        classifier: Classifier,
        cache: AnalysisCache | None = None,
        threat_intel_timeout_seconds: float = 2.0,
        db_session_factory: async_sessionmaker | None = None,
        blockchain_logger=None,
    ) -> None:
        self._feature_extractor = feature_extractor
        self._threat_intel_client = threat_intel_client
        self._classifier = classifier
        self._cache = cache
        self._threat_intel_timeout_seconds = threat_intel_timeout_seconds
        self._db_session_factory = db_session_factory
        self._blockchain_logger = blockchain_logger
        self._in_flight: dict[str, asyncio.Future] = {}

    async def analyze(
        self, request: URLAnalysisRequest, user_id: uuid.UUID | None = None
    ) -> URLAnalysisResponse:
        if self._cache is not None:
            cached = await self._cache.get(request.url)
            if cached is not None:
                # Known limitation, not fixed here (out of scope for the
                # auth work that added user_id): a cache hit returns
                # instantly without persisting, same as before user
                # attribution existed. If user B requests a URL user A
                # already caused to be cached, user B gets the correct
                # answer but no row is written for user B specifically -
                # it won't show up in a future "my scan history" for user
                # B. Fixing this would mean writing a DB row on every
                # request regardless of cache status, which changes the
                # cache's performance characteristics and is a bigger,
                # separate design decision.
                return cached

        # Same limitation applies to in-flight coalescing just below: if
        # two different users request the same not-yet-cached URL at the
        # same moment, only the first one's user_id gets persisted - the
        # second awaits that same in-flight result rather than triggering
        # its own _compute() call.
        existing = self._in_flight.get(request.url)
        if existing is not None:
            return await existing

        future: asyncio.Future[URLAnalysisResponse] = asyncio.get_running_loop().create_future()
        self._in_flight[request.url] = future
        try:
            response = await self._compute(request, user_id)
            future.set_result(response)
            return response
        except BaseException as exc:
            future.set_exception(exc)
            raise
        finally:
            del self._in_flight[request.url]

    async def _compute(
        self, request: URLAnalysisRequest, user_id: uuid.UUID | None = None
    ) -> URLAnalysisResponse:
        features = self._feature_extractor.extract(request.url)

        timed_out = False
        try:
            threat_intel = await asyncio.wait_for(
                self._threat_intel_client.check(request.url),
                timeout=self._threat_intel_timeout_seconds,
            )
        except asyncio.TimeoutError:
            timed_out = True
            threat_intel = {"source": "none", "reputation": "unknown", "timed_out": True}

        # Real bottleneck found via load testing 2026-09-25: the trained
        # classifier's predict_proba() (a 4-model stacking ensemble) is
        # synchronous CPU work. Calling it directly here blocked the whole
        # event loop for its duration, serializing every other in-flight
        # request (DNS lookups, cache/DB I/O) behind it on that worker -
        # throughput plateaued at ~15 req/s under concurrent load regardless
        # of worker count. Offloading it to a thread lets the event loop
        # keep servicing other requests' I/O while this one's CPU work runs.
        verdict, risk_score = await asyncio.to_thread(
            self._classifier.classify, features, threat_intel
        )

        response = URLAnalysisResponse(
            url=request.url,
            verdict=verdict,
            risk_score=risk_score,
            evidence={"features": features, "threat_intel": threat_intel},
        )

        # Never cache a timed-out (incomplete) result - the next lookup
        # should get a fresh, full-timeout chance rather than being stuck
        # with a degraded verdict for the whole cache TTL.
        if self._cache is not None and not timed_out:
            await self._cache.set(request.url, response)

        # Real gap found 2026-09-14, closed 2026-09-25: the DB schema
        # existed (Sprint 6, Task 3) but was never actually wired into the
        # live request flow - nothing was ever persisted. Same resilience
        # pattern as cache/threat-intel/blockchain: a DB outage must never
        # break the response the caller is waiting on, it just means this
        # one analysis doesn't get recorded.
        if self._db_session_factory is not None:
            await self._persist(request, response, threat_intel, user_id)

        return response

    async def _persist(
        self,
        request: URLAnalysisRequest,
        response: URLAnalysisResponse,
        threat_intel: dict,
        user_id: uuid.UUID | None = None,
    ) -> None:
        from app.db.models import AuditLog, ThreatIntelligence, URLAnalysis

        anchor_result = None
        if self._blockchain_logger is not None:
            # Anchoring is independent of DB health - do it once up front,
            # not inside the DB retry loop below, so a slow/flaky DB never
            # causes the same content to get anchored on-chain more than
            # once. blockchain.py's anchor() is a blocking web3.py call, so
            # this runs off the event loop rather than stalling every other
            # request on this worker for however long the chain takes.
            anchor_result = await asyncio.to_thread(
                self._blockchain_logger.anchor,
                {"url": request.url, "verdict": response.verdict, "risk_score": response.risk_score},
            )

        last_exc: Exception | None = None
        for attempt in range(DB_RETRY_ATTEMPTS):
            try:
                async with self._db_session_factory() as session:
                    analysis = URLAnalysis(
                        url=request.url,
                        user_id=user_id,
                        verdict=response.verdict,
                        risk_score=response.risk_score,
                        features=response.evidence.get("features", {}),
                    )
                    session.add(analysis)
                    await session.flush()  # assigns analysis.id for the FK rows below

                    session.add(
                        ThreatIntelligence(
                            analysis_id=analysis.id,
                            source=threat_intel.get("source", "none"),
                            raw_response=threat_intel,
                        )
                    )

                    if anchor_result is not None:
                        session.add(
                            AuditLog(
                                analysis_id=analysis.id,
                                tx_hash=anchor_result["tx_hash"],
                                content_hash=anchor_result["content_hash"],
                            )
                        )

                    await session.commit()
                return  # success - no dead-letter needed
            except Exception as exc:  # noqa: BLE001 - a DB outage must never break the response
                last_exc = exc
                if attempt < DB_RETRY_ATTEMPTS - 1:
                    # Exponential backoff: 0.5s, 1s - a transient blip
                    # (brief connection drop, pool exhaustion) often clears
                    # on its own within a second; a real outage still ends
                    # up in the dead-letter file below either way.
                    await asyncio.sleep(DB_RETRY_BACKOFF_SECONDS * (2**attempt))

        logger.warning(
            "failed to persist analysis for %s after %d attempts, writing to dead-letter log: %s",
            request.url,
            DB_RETRY_ATTEMPTS,
            last_exc,
        )
        _write_dead_letter(request, response, threat_intel, anchor_result, user_id)


def get_default_orchestrator() -> AnalysisOrchestrator:
    settings = get_settings()

    real_threat_intel = VirusTotalAbuseIPDBClient(
        virustotal_api_key=settings.VIRUSTOTAL_API_KEY,
        abuseipdb_api_key=settings.ABUSEIPDB_API_KEY,
        # Per-provider timeout - see threat_intel.py docstring. This is
        # the one that actually matters now; a slow VirusTotal can no
        # longer discard a fast AbuseIPDB result.
        provider_timeout_seconds=settings.THREAT_INTEL_TIMEOUT_SECONDS,
    )

    # ML integration (Sprint 4, done ahead of schedule 2026-09-25): use the
    # real trained model when its files are present, same graceful-
    # degradation pattern as VIRUSTOTAL_API_KEY etc. - falls back to the
    # heuristic placeholders (e.g. a dev checkout without the ~120MB model
    # files) rather than failing to start.
    from app.services.blockchain import get_default_blockchain_logger
    from app.services.composite_threat_intel import CompositeThreatIntelClient
    from app.services.ml_classifier import MLClassifier, MODEL_DIR
    from app.services.ml_features import MLFeatureExtractor

    if (MODEL_DIR / "stacking_ensemble_4model.pkl").exists():
        feature_extractor: FeatureExtractor = MLFeatureExtractor()
        classifier: Classifier = MLClassifier()
        threat_intel_client: ThreatIntelClient = CompositeThreatIntelClient(real_threat_intel)
    else:
        feature_extractor = PlaceholderFeatureExtractor()
        classifier = PlaceholderClassifier()
        threat_intel_client = real_threat_intel

    # DB persistence (Sprint 6, Task 3 wiring, closed 2026-09-25): the
    # engine is created lazily (SQLAlchemy doesn't actually connect until
    # first use), so this is safe to wire in unconditionally - a Postgres
    # outage surfaces inside _persist()'s own try/except, not here.
    from app.db.session import create_engine, create_session_factory

    db_session_factory = create_session_factory(create_engine(settings.DATABASE_URL))

    return AnalysisOrchestrator(
        feature_extractor=feature_extractor,
        threat_intel_client=threat_intel_client,
        classifier=classifier,
        cache=get_default_cache(),
        # Generous outer safety net (+1s buffer) so it never races the real
        # client's own per-provider timeout above - it only matters now for
        # a generic/placeholder ThreatIntelClient that might hang.
        threat_intel_timeout_seconds=settings.THREAT_INTEL_TIMEOUT_SECONDS + 1.0,
        db_session_factory=db_session_factory,
        blockchain_logger=get_default_blockchain_logger(),
    )
