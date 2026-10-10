"""
Sprint 4 (ML integration, done ahead of schedule 2026-09-25):
AnalysisOrchestrator only has one threat_intel_client slot, already used
for real VirusTotal/AbuseIPDB - rather than change that protocol/slot,
this wraps both real threat-intel and DNS enrichment behind the same
single async check() call, running them concurrently. No orchestrator
changes needed; this is the "Option c" from the integration discussion -
real-time DNS lookup, but async + timeout-bound, matching the existing
threat-intel pattern exactly rather than inventing a new one.
"""

import asyncio

from app.services.dns_enrichment import DnsEnrichmentClient


class CompositeThreatIntelClient:
    def __init__(self, real_threat_intel_client, dns_client: DnsEnrichmentClient | None = None) -> None:
        self._real_client = real_threat_intel_client
        self._dns_client = dns_client or DnsEnrichmentClient()

    async def check(self, url: str) -> dict:
        real_result, dns_result = await asyncio.gather(
            self._real_client.check(url),
            self._dns_client.check(url),
        )
        # Flat dns keys (is_resolvable, has_a_record, ...) never collide
        # with the real client's own keys (source, virustotal, abuseipdb),
        # so a simple merge is safe.
        return {**real_result, **dns_result}
