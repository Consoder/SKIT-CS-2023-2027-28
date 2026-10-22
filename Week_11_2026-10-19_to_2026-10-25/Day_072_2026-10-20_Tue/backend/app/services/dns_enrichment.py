"""
Sprint 4 (ML integration): DNS
enrichment signal for the real trained model - malicious URLs in the
training data resolved only 4.4% of the time vs benign 28% (verified,
ml/README's enrichment analysis), a genuinely useful signal.

Ported from ml/src/enrichment.py's logic, adapted to this backend's own
async patterns (asyncio.to_thread + socket, same as threat_intel.py's
resolve_host_to_ip) rather than imported - separate environments, and
this one only needs one lookup per request, not a batch pipeline.

Implements the same ThreatIntelClient protocol (async check(url) -> dict)
so it plugs into AnalysisOrchestrator's existing timeout/cache/coalescing
machinery without any orchestrator changes.
"""

DNS_TIMEOUT_SECONDS = 0.8


def _is_private_ip(ip: str) -> bool:
    try:
        parts = [int(p) for p in ip.split(".")]
        if len(parts) != 4:
            return False
        if parts[0] == 10:
            return True
        if parts[0] == 172 and 16 <= parts[1] <= 31:
            return True
        if parts[0] == 192 and parts[1] == 168:
            return True
        if parts[0] == 127:
            return True
        if parts[0] == 169 and parts[1] == 254:
            return True
        return False
    except Exception:
        return False
