"""Tests for the runtime dependencies wired by get_default_orchestrator()."""

from app.services.blockchain import get_default_blockchain_logger
from app.services.cache import get_default_cache
from app.services.composite_threat_intel import CompositeThreatIntelClient
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
        assert orchestrator._cache is get_default_cache()
        assert orchestrator._blockchain_logger is get_default_blockchain_logger()
        assert orchestrator._db_session_factory is not None

        model_path = MODEL_DIR / "stacking_ensemble_4model.pkl"
        if model_path.exists():
            assert isinstance(orchestrator._feature_extractor, MLFeatureExtractor)
            assert isinstance(orchestrator._classifier, MLClassifier)
            assert isinstance(orchestrator._threat_intel_client, CompositeThreatIntelClient)
        else:
            # CI and developer checkouts without trained model weights use
            # the documented heuristic fallbacks, but still query the real
            # threat-intel client (which degrades safely without API keys).
            assert isinstance(orchestrator._feature_extractor, PlaceholderFeatureExtractor)
            assert isinstance(orchestrator._classifier, PlaceholderClassifier)
            assert isinstance(orchestrator._threat_intel_client, VirusTotalAbuseIPDBClient)
