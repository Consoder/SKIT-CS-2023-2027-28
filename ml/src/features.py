"""
Sprint 1, Task 2 — extract lexical and host-based features from URLs.

Lexical features: URL structure (length, characters, format, entropy).
Host-based features: Domain characteristics (subdomains, TLD, IP-based URLs).

Usage:
    import pandas as pd
    from src.features import extract_features

    df = pd.read_csv("data/processed/urls_dataset.csv")
    df_with_features = extract_features(df)
    df_with_features.to_csv("data/processed/urls_with_features.csv", index=False)
"""

from __future__ import annotations

import re
from collections import Counter
from typing import NamedTuple
from urllib.parse import urlparse

import pandas as pd


class URLFeatures(NamedTuple):
    url_length: int
    domain_length: int
    path_length: int
    query_length: int
    fragment_length: int
    num_dots: int
    num_hyphens: int
    num_underscores: int
    num_slashes: int
    num_query_params: int
    num_subdomains: int
    has_ip_address: bool
    has_http: bool
    has_https: bool
    has_suspicious_chars: bool
    domain_entropy: float
    url_entropy: float
    tld: str


class HostFeatures(NamedTuple):
    is_ipv4: bool
    is_ipv6: bool
    second_level_domain: str
    top_level_domain: str
    subdomain_count: int
    has_numeric_domain: bool


def _entropy(value: str) -> float:
    if not value:
        return 0.0
    counter = Counter(value)
    total = len(value)
    return -sum((count / total) * (count / total) ** 0.5 for count in counter.values())


def _extract_ipv4(domain: str) -> bool:
    ipv4_pattern = r"^(\d{1,3}\.){3}\d{1,3}$"
    return bool(re.match(ipv4_pattern, domain))


def _extract_ipv6(domain: str) -> bool:
    ipv6_pattern = r"^(\[)?[0-9a-fA-F:]+(\])?$"
    return bool(re.match(ipv6_pattern, domain))


def _extract_tld(domain: str) -> str:
    parts = domain.split(".")
    if len(parts) >= 2:
        return parts[-1].lower()
    return ""


def extract_url_features(url: str) -> URLFeatures | None:
    if not url or not isinstance(url, str):
        return None

    try:
        parsed = urlparse(url if "://" in url else f"http://{url}")
    except Exception:
        return None

    if not parsed.netloc:
        return None

    domain = parsed.netloc.lower()
    path = parsed.path or ""
    query = parsed.query or ""
    fragment = parsed.fragment or ""

    num_query_params = len(query.split("&")) if query else 0
    num_subdomains = domain.count(".") - (1 if not _extract_ipv4(domain) else 0)

    suspicious_chars = r"[<>\"'%;()&+]"
    has_suspicious = bool(re.search(suspicious_chars, url))

    tld = _extract_tld(domain)

    return URLFeatures(
        url_length=len(url),
        domain_length=len(domain),
        path_length=len(path),
        query_length=len(query),
        fragment_length=len(fragment),
        num_dots=url.count("."),
        num_hyphens=url.count("-"),
        num_underscores=url.count("_"),
        num_slashes=url.count("/"),
        num_query_params=num_query_params,
        num_subdomains=max(0, num_subdomains),
        has_ip_address=_extract_ipv4(domain) or _extract_ipv6(domain),
        has_http=parsed.scheme == "http",
        has_https=parsed.scheme == "https",
        has_suspicious_chars=has_suspicious,
        domain_entropy=_entropy(domain),
        url_entropy=_entropy(url),
        tld=tld,
    )


def extract_host_features(url: str) -> HostFeatures | None:
    if not url or not isinstance(url, str):
        return None

    try:
        parsed = urlparse(url if "://" in url else f"http://{url}")
    except Exception:
        return None

    if not parsed.netloc:
        return None

    domain = parsed.netloc.lower()
    is_ipv4 = _extract_ipv4(domain)
    is_ipv6 = _extract_ipv6(domain)

    if is_ipv4 or is_ipv6:
        return HostFeatures(
            is_ipv4=is_ipv4,
            is_ipv6=is_ipv6,
            second_level_domain="",
            top_level_domain="",
            subdomain_count=0,
            has_numeric_domain=True,
        )

    parts = domain.split(".")
    tld = parts[-1] if parts else ""
    sld = parts[-2] if len(parts) >= 2 else ""
    subdomain_count = max(0, len(parts) - 2)

    has_numeric = any(char.isdigit() for char in domain)

    return HostFeatures(
        is_ipv4=False,
        is_ipv6=False,
        second_level_domain=sld,
        top_level_domain=tld,
        subdomain_count=subdomain_count,
        has_numeric_domain=has_numeric,
    )
