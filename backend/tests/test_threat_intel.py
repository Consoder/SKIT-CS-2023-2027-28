import asyncio

import httpx
import pytest

from app.services.threat_intel import VirusTotalAbuseIPDBClient


async def _fake_resolver(host: str) -> str:
    """Test-only resolver - real DNS has no place in a unit test."""
    return "93.184.216.34"


@pytest.mark.asyncio
async def test_no_api_keys_skips_calls_entirely() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("should never make a network call without an API key")

    client = VirusTotalAbuseIPDBClient(
        virustotal_api_key=None,
        abuseipdb_api_key=None,
        transport=httpx.MockTransport(handler),
    )
    result = await client.check("https://example.com")

    assert result["virustotal"]["available"] is False
    assert result["abuseipdb"]["available"] is False


@pytest.mark.asyncio
async def test_successful_responses_are_normalized() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if "virustotal.com" in str(request.url):
            return httpx.Response(
                200,
                json={"data": {"attributes": {"last_analysis_stats": {"malicious": 3, "suspicious": 1}}}},
            )
        return httpx.Response(200, json={"data": {"abuseConfidenceScore": 42}})

    client = VirusTotalAbuseIPDBClient(
        virustotal_api_key="fake-vt-key",
        abuseipdb_api_key="fake-abuse-key",
        transport=httpx.MockTransport(handler),
        resolver=_fake_resolver,
    )
    result = await client.check("https://suspicious-site.example/path")

    assert result["virustotal"]["available"] is True
    assert result["virustotal"]["malicious_votes"] == 3
    assert result["abuseipdb"]["available"] is True
    assert result["abuseipdb"]["abuse_confidence_score"] == 42


@pytest.mark.asyncio
async def test_rate_limit_then_success_retries_correctly() -> None:
    call_count = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        if "virustotal.com" not in str(request.url):
            return httpx.Response(200, json={"data": {"abuseConfidenceScore": 0}})

        call_count["n"] += 1
        if call_count["n"] == 1:
            return httpx.Response(429, headers={"Retry-After": "0"})
        return httpx.Response(200, json={"data": {"attributes": {"last_analysis_stats": {"malicious": 0}}}})

    client = VirusTotalAbuseIPDBClient(
        virustotal_api_key="fake-vt-key",
        abuseipdb_api_key="fake-abuse-key",
        transport=httpx.MockTransport(handler),
        resolver=_fake_resolver,
    )
    result = await client.check("https://example.com")

    assert call_count["n"] == 2  # first 429, then succeeded on retry
    assert result["virustotal"]["available"] is True


@pytest.mark.asyncio
async def test_abuseipdb_receives_resolved_ip_not_raw_domain() -> None:
    """
    Locks in a real bug found live 2026-09-13: AbuseIPDB's API requires an
    IP address, but the hostname was being sent directly, which returns
    422 Unprocessable Entity for every domain-based URL.
    """
    captured_params = {}

    def handler(request: httpx.Request) -> httpx.Response:
        if "abuseipdb.com" in str(request.url):
            captured_params["ipAddress"] = request.url.params.get("ipAddress")
            return httpx.Response(200, json={"data": {"abuseConfidenceScore": 0}})
        return httpx.Response(200, json={"data": {"attributes": {"last_analysis_stats": {}}}})

    client = VirusTotalAbuseIPDBClient(
        virustotal_api_key="fake-vt-key",
        abuseipdb_api_key="fake-abuse-key",
        transport=httpx.MockTransport(handler),
        resolver=_fake_resolver,
    )
    await client.check("https://google.com")

    assert captured_params["ipAddress"] == "93.184.216.34"  # resolved IP, not "google.com"


@pytest.mark.asyncio
async def test_abuseipdb_skipped_when_host_cannot_be_resolved() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("must not call AbuseIPDB when resolution fails")

    async def failing_resolver(host: str) -> None:
        return None

    client = VirusTotalAbuseIPDBClient(
        virustotal_api_key=None,
        abuseipdb_api_key="fake-abuse-key",
        transport=httpx.MockTransport(handler),
        resolver=failing_resolver,
    )
    result = await client.check("https://this-domain-does-not-resolve.invalid")

    assert result["abuseipdb"]["available"] is False


@pytest.mark.asyncio
async def test_slow_provider_does_not_discard_the_other_providers_real_data() -> None:
    """
    Real bug caught live via Swagger UI, 2026-09-14: VirusTotal genuinely
    got rate-limited (real 429) and retried past the old combined timeout,
    which discarded AbuseIPDB's already-successful result along with it.
    Each provider now times out independently - this proves a slow
    VirusTotal can no longer take AbuseIPDB's real data down with it.
    """

    async def handler(request: httpx.Request) -> httpx.Response:
        if "virustotal.com" in str(request.url):
            await asyncio.sleep(0.2)  # slower than the 0.05s timeout below
            return httpx.Response(200, json={"data": {"attributes": {"last_analysis_stats": {"malicious": 5}}}})
        return httpx.Response(200, json={"data": {"abuseConfidenceScore": 77}})

    client = VirusTotalAbuseIPDBClient(
        virustotal_api_key="fake-vt-key",
        abuseipdb_api_key="fake-abuse-key",
        transport=httpx.MockTransport(handler),
        resolver=_fake_resolver,
        provider_timeout_seconds=0.05,
    )
    result = await client.check("https://example.com")

    assert result["virustotal"]["available"] is False  # correctly timed out
    assert result["abuseipdb"]["available"] is True  # NOT discarded by VT's slowness
    assert result["abuseipdb"]["abuse_confidence_score"] == 77


@pytest.mark.asyncio
async def test_persistent_failure_degrades_gracefully_without_raising() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500)

    client = VirusTotalAbuseIPDBClient(
        virustotal_api_key="fake-vt-key",
        abuseipdb_api_key="fake-abuse-key",
        transport=httpx.MockTransport(handler),
        backoff_seconds=0.01,  # keep this test fast; production default is much more conservative
        resolver=_fake_resolver,
    )
    # must not raise, even though every single call fails
    result = await client.check("https://example.com")

    assert result["virustotal"]["available"] is False
    assert result["abuseipdb"]["available"] is False


@pytest.mark.asyncio
async def test_extremely_long_url_degrades_gracefully_without_crashing() -> None:
    """
    Real bug found via adversarial testing 2026-09-14: base64-encoding an
    extremely long URL for the VirusTotal request path produces a URL that
    exceeds httpx's own length limit, raising httpx.InvalidURL - which is
    NOT a subclass of httpx.RequestError, so the old handler never caught
    it. It crashed uncaught all the way up through the whole stack. Now
    caught explicitly and treated as an immediate, non-retryable failure.
    """

    def handler(request: httpx.Request) -> httpx.Response:
        if "virustotal.com" in str(request.url):
            raise AssertionError("VT should never reach the network - fails at request construction")
        return httpx.Response(200, json={"data": {"abuseConfidenceScore": 0}})

    client = VirusTotalAbuseIPDBClient(
        virustotal_api_key="fake-vt-key",
        abuseipdb_api_key="fake-abuse-key",
        transport=httpx.MockTransport(handler),
        resolver=_fake_resolver,
    )
    huge_url = "https://example.com/" + ("a" * 100_000)

    # must not raise, even though the VirusTotal request URL itself is invalid
    result = await client.check(huge_url)

    assert result["virustotal"]["available"] is False
    assert result["abuseipdb"]["available"] is True  # unaffected by VT's failure
