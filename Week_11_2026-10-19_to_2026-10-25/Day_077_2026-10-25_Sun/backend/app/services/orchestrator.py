"""
Sprint 3, Task 3 (Orchestration service — due 25-10-2026):
coordinates feature-extraction, threat-intelligence and ML detection into
one flow behind a single call. Built against small Protocols so the
placeholder implementations below can be swapped for the real trained
model (Sprint 4) without changing the orchestrator or its call sites.
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
    Real bug fixed (found via edge-case testing): the old naive
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
            # Real gap found via edge-case testing:
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
    ) -> None:
        self._feature_extractor = feature_extractor
        self._threat_intel_client = threat_intel_client
        self._classifier = classifier

    async def analyze(self, request: URLAnalysisRequest) -> URLAnalysisResponse:
        # Public entry point kept separate from the actual pipeline in
        # _compute() - caching / de-duplication (Sprint 6) wrap around this
        # one method later without touching the pipeline itself.
        return await self._compute(request)

    async def _compute(self, request: URLAnalysisRequest) -> URLAnalysisResponse:
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
    return AnalysisOrchestrator(
        feature_extractor=PlaceholderFeatureExtractor(),
        threat_intel_client=PlaceholderThreatIntelClient(),
        classifier=PlaceholderClassifier(),
    )
