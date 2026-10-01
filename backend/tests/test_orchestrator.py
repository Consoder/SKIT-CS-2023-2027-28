"""
Sprint 3, Task 3 (Orchestration service — due 25-10-2026): proves
AnalysisOrchestrator genuinely wires the three stages together end to end,
not just that each stage is independently correct.
"""

import pytest

from app.schemas.url import URLAnalysisRequest
from app.services.orchestrator import (
    AnalysisOrchestrator,
    PlaceholderClassifier,
    PlaceholderFeatureExtractor,
    PlaceholderThreatIntelClient,
)


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
