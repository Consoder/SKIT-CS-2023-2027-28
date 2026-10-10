"""
Sprint 4 (ML integration, done ahead of schedule 2026-09-25): DNS
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

import asyncio
import socket
from urllib.parse import urlparse

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


def _resolve(domain: str) -> list | None:
    """Blocking DNS resolution - always called via asyncio.to_thread."""
    try:
        return socket.getaddrinfo(domain, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
    except Exception:
        return None


class DnsEnrichmentClient:
    """
    Real DNS lookup, matching ml/'s training-time enrichment logic exactly
    (including has_mx_record always being False - the stdlib socket module
    can't query MX records specifically, and the model was trained on that
    same constant, so keeping it False here rather than "fixing" it keeps
    inference consistent with training).
    """

    async def check(self, url: str) -> dict:
        try:
            parsed = urlparse(url if "://" in url else f"http://{url}")
            domain = parsed.netloc.lower()
        except Exception:
            domain = ""

        if not domain:
            return {
                "is_resolvable": False,
                "has_a_record": False,
                "has_aaaa_record": False,
                "has_mx_record": False,
                "resolves_to_private_ip": False,
            }

        is_resolvable = False
        has_a_record = False
        has_aaaa_record = False
        resolves_to_private_ip = False

        try:
            result = await asyncio.wait_for(
                asyncio.to_thread(_resolve, domain),
                timeout=DNS_TIMEOUT_SECONDS + 0.2,
            )
        except (asyncio.TimeoutError, Exception):
            result = None

        if result:
            is_resolvable = True
            for family, _, _, _, sockaddr in result:
                if family == socket.AF_INET and not has_a_record:
                    has_a_record = True
                    resolves_to_private_ip = _is_private_ip(sockaddr[0])
                elif family == socket.AF_INET6:
                    has_aaaa_record = True

        return {
            "is_resolvable": is_resolvable,
            "has_a_record": has_a_record,
            "has_aaaa_record": has_aaaa_record,
            "has_mx_record": False,
            "resolves_to_private_ip": resolves_to_private_ip,
        }
