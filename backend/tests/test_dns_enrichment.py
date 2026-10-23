"""Unit tests for the backend DNS enrichment signal."""

import socket
import time

import pytest

from app.services import dns_enrichment
from app.services.dns_enrichment import DnsEnrichmentClient, _is_private_ip


@pytest.mark.parametrize(
    "ip",
    [
        "10.0.0.1",
        "172.16.0.1",
        "172.31.255.254",
        "192.168.1.10",
        "127.0.0.1",
        "169.254.1.5",
        "fd00::1",
        "::1",
        "fe80::1",
    ],
)
def test_private_loopback_and_link_local_ips_are_detected(ip: str) -> None:
    assert _is_private_ip(ip) is True


@pytest.mark.parametrize("ip", ["8.8.8.8", "1.1.1.1", "2001:4860:4860::8888", "not-an-ip"])
def test_public_or_invalid_addresses_are_not_private(ip: str) -> None:
    assert _is_private_ip(ip) is False


@pytest.mark.asyncio
async def test_lookup_uses_hostname_not_url_credentials_or_port(monkeypatch) -> None:
    looked_up: list[str] = []

    def fake_resolve(domain: str):
        looked_up.append(domain)
        return [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("8.8.8.8", 443)),
        ]

    monkeypatch.setattr(dns_enrichment, "_resolve", fake_resolve)

    result = await DnsEnrichmentClient().check(
        "https://user:secret@example.com:8443/path?q=1"
    )

    assert looked_up == ["example.com"]
    assert result["is_resolvable"] is True
    assert result["has_a_record"] is True


@pytest.mark.asyncio
async def test_lookup_supports_url_without_scheme(monkeypatch) -> None:
    looked_up: list[str] = []

    def fake_resolve(domain: str):
        looked_up.append(domain)
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("8.8.8.8", 80))]

    monkeypatch.setattr(dns_enrichment, "_resolve", fake_resolve)

    await DnsEnrichmentClient().check("example.com:8080/path")

    assert looked_up == ["example.com"]


@pytest.mark.asyncio
async def test_malformed_url_returns_false_flags_without_resolving(monkeypatch) -> None:
    def unexpected_resolve(_domain: str):
        pytest.fail("Resolver should not be called for a malformed URL")

    monkeypatch.setattr(dns_enrichment, "_resolve", unexpected_resolve)

    result = await DnsEnrichmentClient().check("http://[malformed")

    assert result == {
        "is_resolvable": False,
        "has_a_record": False,
        "has_aaaa_record": False,
        "has_mx_record": False,
        "resolves_to_private_ip": False,
    }


@pytest.mark.asyncio
async def test_records_and_any_private_answer_are_reported(monkeypatch) -> None:
    def fake_resolve(_domain: str):
        # Public answer first is deliberate: a later private answer must not
        # be missed just because an earlier A record was public.
        return [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("8.8.8.8", 443)),
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("192.168.1.20", 443)),
            (socket.AF_INET6, socket.SOCK_STREAM, 6, "", ("2001:4860:4860::8888", 443, 0, 0)),
        ]

    monkeypatch.setattr(dns_enrichment, "_resolve", fake_resolve)

    result = await DnsEnrichmentClient().check("https://example.com")

    assert result == {
        "is_resolvable": True,
        "has_a_record": True,
        "has_aaaa_record": True,
        "has_mx_record": False,
        "resolves_to_private_ip": True,
    }


@pytest.mark.asyncio
async def test_private_ipv6_answer_is_reported(monkeypatch) -> None:
    def fake_resolve(_domain: str):
        return [
            (socket.AF_INET6, socket.SOCK_STREAM, 6, "", ("fd00::1234", 443, 0, 0)),
        ]

    monkeypatch.setattr(dns_enrichment, "_resolve", fake_resolve)

    result = await DnsEnrichmentClient().check("https://example.com")

    assert result["is_resolvable"] is True
    assert result["has_a_record"] is False
    assert result["has_aaaa_record"] is True
    assert result["resolves_to_private_ip"] is True


@pytest.mark.asyncio
async def test_unresolvable_domain_returns_false_flags(monkeypatch) -> None:
    monkeypatch.setattr(dns_enrichment, "_resolve", lambda _domain: None)

    result = await DnsEnrichmentClient().check("https://not-found.example")

    assert result == {
        "is_resolvable": False,
        "has_a_record": False,
        "has_aaaa_record": False,
        "has_mx_record": False,
        "resolves_to_private_ip": False,
    }


@pytest.mark.asyncio
async def test_slow_lookup_times_out_and_returns_safe_defaults(monkeypatch) -> None:
    def slow_resolve(_domain: str):
        time.sleep(0.5)
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("192.168.1.20", 443))]

    monkeypatch.setattr(dns_enrichment, "_resolve", slow_resolve)
    monkeypatch.setattr(dns_enrichment, "DNS_TIMEOUT_SECONDS", 0.001)

    result = await DnsEnrichmentClient().check("https://slow.example")

    assert result == {
        "is_resolvable": False,
        "has_a_record": False,
        "has_aaaa_record": False,
        "has_mx_record": False,
        "resolves_to_private_ip": False,
    }
