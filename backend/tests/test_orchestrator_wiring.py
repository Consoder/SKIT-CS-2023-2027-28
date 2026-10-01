"""
Sprint 3, Task 3 (Orchestration service — due 25-10-2026): confirms
get_default_orchestrator() wires placeholder dependencies today - later
sprints swap in the real ones here without changing analyze()'s call sites.
"""

from app.services.orchestrator import (
    AnalysisOrchestrator,
    PlaceholderClassifier,
    PlaceholderFeatureExtractor,
    PlaceholderThreatIntelClient,
    get_default_orchestrator,
)


class TestGetDefaultOrchestrator:
    def test_wires_placeholder_dependencies_by_default(self):
        orchestrator = get_default_orchestrator()
        assert isinstance(orchestrator, AnalysisOrchestrator)
        assert isinstance(orchestrator._feature_extractor, PlaceholderFeatureExtractor)
        assert isinstance(orchestrator._threat_intel_client, PlaceholderThreatIntelClient)
        assert isinstance(orchestrator._classifier, PlaceholderClassifier)
