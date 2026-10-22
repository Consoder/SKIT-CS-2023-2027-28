import pytest

from app.schemas.url import URLAnalysisRequest
from app.services.orchestrator import (
    AnalysisOrchestrator,
    PlaceholderClassifier,
    PlaceholderFeatureExtractor,
    PlaceholderThreatIntelClient,
)


def _build_placeholder_orchestrator() -> AnalysisOrchestrator:
    """
    Deliberately NOT get_default_orchestrator() - these tests are about
    orchestration logic, so they pin the pipeline to the placeholder pieces
    explicitly instead of whatever the app wires in by default.
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
    Real bug found live via edge-case testing: "http://real-looking-site.com@evil.com/"
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
    Real gap found via edge-case testing: "xn--pple-43d.com" is
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
