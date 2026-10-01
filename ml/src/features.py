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


# Real bug found 2026-09-24: _extract_tld() naively took the last
# dot-separated segment with no IP special-casing, so "192.168.1.1" got
# tld="1" - garbage. extract_host_features() below already special-cases
# IPs correctly; this brings _extract_tld() in line with that.
#
# Compound public-suffix TLDs (co.uk, com.au, etc.) are also not real
# single-label TLDs - without knowing this, "mail.google.co.uk" gets
# misparsed as tld="uk", sld="co", subdomains=["mail","google"], when the
# real registrable domain is "google.co.uk". Not exhaustive (a full public
# suffix list has thousands of entries), but covers the common ones well
# enough to stop the worst misparses.
_COMPOUND_TLDS = {
    "co.uk", "org.uk", "gov.uk", "ac.uk", "net.uk",
    "co.in", "org.in", "gov.in", "net.in", "firm.in",
    "com.au", "net.au", "org.au", "gov.au", "edu.au",
    "co.jp", "co.nz", "co.za", "com.br", "com.cn", "com.mx",
}


