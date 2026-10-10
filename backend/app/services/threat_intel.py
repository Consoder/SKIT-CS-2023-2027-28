"""
Sprint 6, Task 1 (VirusTotal & AbuseIPDB integration — due 15-12-2026):
real external threat-intelligence client, replacing the Sprint 3
placeholder. Normalizes both APIs' very different response shapes into one
consistent structure, retries transient failures, backs off on rate limits
instead of hammering the API, and degrades to "unavailable" per provider
rather than ever crashing the request when an external API is down.

Persistent client (real bug found stress testing 2026-09-14): check() used
to open a brand-new httpx.AsyncClient - and therefore a brand-new TCP+TLS
connection - on every single call. Under concurrent load this caused a
connection-establishment storm (measured: 30 concurrent distinct URLs
taking 10+ seconds EACH, completely unmoved by increasing the DNS thread
pool, which ruled that out as the cause). The client is now created once
and reused, letting httpx pool and keep-alive real connections like it's
designed to.

Per-provider timeout (real bug caught live via Swagger UI, 2026-09-14):
the orchestrator's overall timeout used to wrap check() as one unit, so
when VirusTotal got rate-limited (real 429, confirmed in logs) and
retried past the timeout, the request lost AbuseIPDB's result too - even
though AbuseIPDB had already answered successfully. Each provider now
times out independently, so one slow/rate-limited provider can no longer
discard the other's real, already-available data.
"""

import asyncio
import base64
import logging
import re
import socket
from typing import Awaitable, Callable

import httpx

logger = logging.getLogger(__name__)

VIRUSTOTAL_BASE_URL = "https://www.virustotal.com/api/v3"
ABUSEIPDB_BASE_URL = "https://api.abuseipdb.com/api/v2"

MAX_RETRIES = 3
BASE_BACKOFF_SECONDS = 1.0

_IPV4_RE = re.compile(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$")

Resolver = Callable[[str], Awaitable["str | None"]]


async def resolve_host_to_ip(host: str) -> str | None:
    """
    AbuseIPDB checks IP reputation, not domains - most URLs are domains, so
    this resolves the host first. Real bug this fixes: passing a hostname
    like "google.com" straight to AbuseIPDB returns 422 Unprocessable Entity
    (caught live, 2026-09-13) and silently degraded to "unavailable" for
    every domain-based URL.
    """
    if _IPV4_RE.match(host):
        return host
    try:
        return await asyncio.to_thread(socket.gethostbyname, host)
    except socket.gaierror:
        logger.info("could not resolve host %r to an IP for AbuseIPDB lookup", host)
        return None


async def _request_with_retries(
    client: httpx.AsyncClient, method: str, url: str, *, backoff_seconds: float, **kwargs
) -> httpx.Response | None:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = await client.request(method, url, **kwargs)
        except httpx.InvalidURL as exc:
            # Real bug found via adversarial testing 2026-09-14: an
            # extremely long submitted URL, once base64-encoded into the
            # VirusTotal request path, exceeds httpx's own URL length
            # limit. InvalidURL is a request-construction-time failure -
            # not a subclass of RequestError, so the handler below never
            # caught it, and it crashed uncaught up through the whole
            # stack. It's also not retryable: the same input fails the
            # same way every time, so return immediately instead of
            # burning through MAX_RETRIES for nothing.
            logger.warning("threat-intel request URL invalid, not retrying: %s", exc)
            return None
        except httpx.RequestError as exc:
            logger.warning("threat-intel request error (attempt %d/%d): %s", attempt, MAX_RETRIES, exc)
            response = None
        else:
            if response.status_code == 429:
                retry_after = float(response.headers.get("Retry-After", backoff_seconds * attempt))
                logger.warning("threat-intel rate-limited, backing off %.1fs", retry_after)
                await asyncio.sleep(retry_after)
                continue
            if response.status_code < 500:
                return response
            logger.warning("threat-intel server error %d (attempt %d/%d)", response.status_code, attempt, MAX_RETRIES)

        if attempt < MAX_RETRIES:
            await asyncio.sleep(backoff_seconds * attempt)

    return None


class VirusTotalAbuseIPDBClient:
    """Real threat-intel client. Never raises - unreachable/unconfigured providers just report unavailable."""

    def __init__(
        self,
        virustotal_api_key: str | None,
        abuseipdb_api_key: str | None,
        timeout: float = 10.0,
        transport: httpx.BaseTransport | None = None,
        backoff_seconds: float = BASE_BACKOFF_SECONDS,
        resolver: Resolver = resolve_host_to_ip,
        provider_timeout_seconds: float = 2.0,
    ) -> None:
        self._vt_key = virustotal_api_key
        self._abuse_key = abuseipdb_api_key
        self._timeout = timeout
        self._transport = transport  # test-only hook; None uses real network in production
        self._backoff_seconds = backoff_seconds
        self._resolver = resolver  # test-only hook; avoids real DNS lookups in tests
        self._provider_timeout_seconds = provider_timeout_seconds
        # Created once, reused for every check() call - see module docstring.
        self._client = httpx.AsyncClient(timeout=self._timeout, transport=self._transport)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _with_provider_timeout(self, coro) -> dict | None:
        try:
            return await asyncio.wait_for(coro, timeout=self._provider_timeout_seconds)
        except asyncio.TimeoutError:
            logger.warning("threat-intel provider timed out after %.1fs", self._provider_timeout_seconds)
            return None

    async def check(self, url: str) -> dict:
        vt_result, abuse_result = await asyncio.gather(
            self._with_provider_timeout(self._check_virustotal(self._client, url)),
            self._with_provider_timeout(self._check_abuseipdb(self._client, url)),
        )
        return self._normalize(vt_result, abuse_result)

    async def _check_virustotal(self, client: httpx.AsyncClient, url: str) -> dict | None:
        if not self._vt_key:
            return None
        url_id = base64.urlsafe_b64encode(url.encode()).decode().strip("=")
        response = await _request_with_retries(
            client,
            "GET",
            f"{VIRUSTOTAL_BASE_URL}/urls/{url_id}",
            backoff_seconds=self._backoff_seconds,
            headers={"x-apikey": self._vt_key},
        )
        if response is None or response.status_code != 200:
            return None
        return response.json()

    async def _check_abuseipdb(self, client: httpx.AsyncClient, url: str) -> dict | None:
        if not self._abuse_key:
            return None
        host = url.split("://", 1)[-1].split("/", 1)[0].split(":", 1)[0]
        ip_address = await self._resolver(host)
        if ip_address is None:
            return None
        response = await _request_with_retries(
            client,
            "GET",
            f"{ABUSEIPDB_BASE_URL}/check",
            backoff_seconds=self._backoff_seconds,
            headers={"Key": self._abuse_key, "Accept": "application/json"},
            params={"ipAddress": ip_address, "maxAgeInDays": 90},
        )
        if response is None or response.status_code != 200:
            return None
        return response.json()

    def _normalize(self, vt_result: dict | None, abuse_result: dict | None) -> dict:
        vt_stats = {}
        if vt_result:
            vt_stats = vt_result.get("data", {}).get("attributes", {}).get("last_analysis_stats", {})

        abuse_data = abuse_result.get("data", {}) if abuse_result else {}

        return {
            "source": "virustotal+abuseipdb",
            "virustotal": {
                "available": vt_result is not None,
                "malicious_votes": vt_stats.get("malicious", 0),
                "suspicious_votes": vt_stats.get("suspicious", 0),
            },
            "abuseipdb": {
                "available": abuse_result is not None,
                "abuse_confidence_score": abuse_data.get("abuseConfidenceScore", 0),
            },
        }
