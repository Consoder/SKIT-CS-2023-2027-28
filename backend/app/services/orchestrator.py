"""
Sprint 3, Task 3 (Orchestration service — due 25-10-2026):
coordinates feature-extraction, threat-intelligence and ML detection into
one flow behind a single call. Built against small Protocols so these
placeholder implementations can be swapped for the real trained model
(Sprint 4) and the real VirusTotal/AbuseIPDB client (Sprint 6, Task 1)
later without changing the orchestrator or its call sites.
"""

import ipaddress
from typing import Protocol
from urllib.parse import urlparse

from app.schemas.analysis import URLAnalysisResponse, Verdict
from app.schemas.url import URLAnalysisRequest


def _is_ip_address(host: str) -> bool:
    """IPv4 or IPv6 literal host - a raw-IP URL is a real suspicious signal either way."""
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        return False


def _extract_host(url: str) -> str:
    """
    Real bug found via edge-case testing 2026-09-14: a naive string-split
    version treated everything before the first "/" as the host, including
    embedded userinfo. For "http://google.com@evil.com/" - a classic
    phishing pattern where the real host (evil.com, after the @) is
    disguised behind a fake-looking domain before it - that returned
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
    """Minimal lexical checks. Replaced by the real feature pipeline in a later sprint."""

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
    """
    Used until the real VirusTotal/AbuseIPDB client (Sprint 6, Task 1)
    replaces it, and in isolated unit tests.
    """

    async def check(self, url: str) -> dict:
        return {"source": "none", "reputation": "unknown"}


class PlaceholderClassifier:
    """
    Heuristic stand-in. Replaced by the trained model (Sprint 4). Already
    reads the threat-intel keys the real client (Sprint 6, Task 1) will
    populate, so swapping PlaceholderThreatIntelClient for the real one
    later needs no change here.
    """

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
    """
    Coordinates the three pieces above behind one call. Deliberately no
    caching, persistence or external-call timeout handling yet - those are
    their own later sprint tasks (6.2 Redis cache, 6.3 DB persistence, and
    the per-provider timeout that ships with the real threat-intel client
    in 6.1) and would be premature here against placeholder dependencies
    that can't actually hang or need caching.
    """

    def __init__(
        self,
        feature_extractor: FeatureExtractor,
        threat_intel_client: ThreatIntelClient,
        classifier: Classifier,
    ) -> None:
        self._feature_extractor = feature_extractor
        self._threat_intel_client = threat_intel_client
        self._classifier = classifier

    async def analyze(self, request: URLAnalysisRequest) -> URLAnalysisResponse:
        features = self._feature_extractor.extract(request.url)
        threat_intel = await self._threat_intel_client.check(request.url)
        verdict, risk_score = self._classifier.classify(features, threat_intel)

        return URLAnalysisResponse(
            url=request.url,
            verdict=verdict,
            risk_score=risk_score,
            evidence={"features": features, "threat_intel": threat_intel},
        )


def get_default_orchestrator() -> AnalysisOrchestrator:
    """
    Default wiring - placeholder-only for now. Later sprints swap in the
    real trained classifier (Sprint 4) and real VirusTotal/AbuseIPDB
    client (Sprint 6, Task 1) here without changing analyze()'s call sites,
    the same graceful-degradation pattern used elsewhere in this project.
    """
    return AnalysisOrchestrator(
        feature_extractor=PlaceholderFeatureExtractor(),
        threat_intel_client=PlaceholderThreatIntelClient(),
        classifier=PlaceholderClassifier(),
    )
