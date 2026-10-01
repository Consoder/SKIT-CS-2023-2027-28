"""
Sprint 3, Task 3 (Orchestration service — due 25-10-2026): coverage for
PlaceholderThreatIntelClient, used until the real VirusTotal/AbuseIPDB
client (Sprint 6, Task 1) replaces it.
"""

import pytest

from app.services.orchestrator import PlaceholderThreatIntelClient


class TestPlaceholderThreatIntelClient:
    @pytest.mark.asyncio
    async def test_returns_unknown_reputation(self):
        result = await PlaceholderThreatIntelClient().check("https://example.com")
        assert result == {"source": "none", "reputation": "unknown"}
