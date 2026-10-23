"""Tests for runtime dependencies wired by get_default_orchestrator()."""

import socket

import pytest

from app.services.blockchain import BlockchainAuditLogger
from app.services.cache import AnalysisCache
from app.services.composite_threat_intel import CompositeThreatIntelClient
from app.services.dns_enrichment import DnsEnrichmentClient
from app.services.ml_classifier import MLClassifier, MODEL_DIR
from app.services.ml_features import MLFeatureExtractor
from app.services.orchestrator import (
    AnalysisOrchestrator,
    PlaceholderClassifier,
    PlaceholderFeatureExtractor,
    get_default_orchestrator,
)
from app.services.threat_intel import VirusTotalAbuseIPDBClient


class TestGetDefaultOrchestrator:
    def test_wires_runtime_dependencies_based_on_available_model(self):
        orchestrator = get_default_orchestrator()

        assert isinstance(orchestrator, AnalysisOrchestrator)
        assert orchestrator._cache is None or isinstance(orchestrator._cache, AnalysisCache)
        assert orchestrator._blockchain_logger is None or isinstance(
            orchestrator._blockchain_logger, BlockchainAuditLogger
        )
        assert orchestrator._db_session_factory is not None

        model_path = MODEL_DIR / "stacking_ensemble_4model.pkl"
        encoders_path = MODEL_DIR / "encoders_bundle.pkl"
        model_artifacts_available = model_path.is_file() and encoders_path.is_file()

        # DNS runs independently of whether the optional trained model files
        # are installed. Both ML artifacts are required to enable inference.
        assert isinstance(orchestrator._threat_intel_client, CompositeThreatIntelClient)
        assert isinstance(orchestrator._threat_intel_client._real_client, VirusTotalAbuseIPDBClient)
        assert isinstance(orchestrator._threat_intel_client._dns_client, DnsEnrichmentClient)

        if model_artifacts_available:
            assert isinstance(orchestrator._feature_extractor, MLFeatureExtractor)
            assert isinstance(orchestrator._classifier, MLClassifier)
        else:
            # CI/developer checkouts without either trained model artifact
            # use the documented heuristic fallback, while DNS and real
            # threat intelligence remain wired into the request pipeline.
            assert isinstance(orchestrator._feature_extractor, PlaceholderFeatureExtractor)
            assert isinstance(orchestrator._classifier, PlaceholderClassifier)


def test_partial_model_artifacts_fall_back_safely(monkeypatch, tmp_path, caplog):
    """One model artifact alone must not crash startup or disable DNS."""
    from app.services import ml_classifier

    monkeypatch.setattr(ml_classifier, "MODEL_DIR", tmp_path)
    (tmp_path / "stacking_ensemble_4model.pkl").touch()

    orchestrator = get_default_orchestrator()

    assert isinstance(orchestrator._feature_extractor, PlaceholderFeatureExtractor)
    assert isinstance(orchestrator._classifier, PlaceholderClassifier)
    assert isinstance(orchestrator._threat_intel_client, CompositeThreatIntelClient)
    assert isinstance(orchestrator._threat_intel_client._dns_client, DnsEnrichmentClient)
    assert "encoders_bundle.pkl" in caplog.text


@pytest.mark.asyncio
async def test_composite_threat_intel_merges_dns_and_provider_results(monkeypatch):
    """DNS fields remain available even when the trained ML model is absent."""
    from app.services import dns_enrichment
    from app.services.composite_threat_intel import CompositeThreatIntelClient

    class FakeThreatIntel:
        async def check(self, url: str) -> dict:
            return {
                "source": "virustotal+abuseipdb",
                "virustotal": {"available": True, "malicious_votes": 0},
                "abuseipdb": {"available": True, "abuse_confidence_score": 0},
            }

    def fake_resolve(domain: str):
        assert domain == "example.com"
        return [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("8.8.8.8", 443)),
            (socket.AF_INET6, socket.SOCK_STREAM, 6, "", ("2001:4860:4860::8888", 443, 0, 0)),
        ]

    monkeypatch.setattr(dns_enrichment, "_resolve", fake_resolve)
    result = await CompositeThreatIntelClient(FakeThreatIntel()).check(
        "https://example.com:8443/path"
    )

    assert result["source"] == "virustotal+abuseipdb"
    assert result["virustotal"]["available"] is True
    assert result["abuseipdb"]["available"] is True
    assert result["is_resolvable"] is True
    assert result["has_a_record"] is True
    assert result["has_aaaa_record"] is True
    assert result["resolves_to_private_ip"] is False
