"""
Sprint 4 (ML integration, done ahead of schedule 2026-09-25): lexical and
host-based feature extraction for the real trained model. Ported from
ml/src/features.py rather than imported - backend and ml/ are separate
Python environments (ml/ needs pandas/sklearn/xgboost for training, the
backend only needs enough to build one feature vector per request), and
this keeps the backend's dependency footprint small. Logic is kept
byte-for-byte identical to what the model was actually trained on -
verified live against ml/'s own test suite's expected values.
"""

import ipaddress
import re
from collections import Counter
from urllib.parse import urlparse

_SUSPICIOUS_CHARS_RE = re.compile(r"[<>\"'%;()&+]")

# Same compound-TLD list as ml/src/features.py - see that file's docstring
# for why: without it, "mail.google.co.uk" misparses as tld="uk" instead
# of the real registrable domain "google.co.uk".
_COMPOUND_TLDS = {
    "co.uk", "org.uk", "gov.uk", "ac.uk", "net.uk",
    "co.in", "org.in", "gov.in", "net.in", "firm.in",
    "com.au", "net.au", "org.au", "gov.au", "edu.au",
    "co.jp", "co.nz", "co.za", "com.br", "com.cn", "com.mx",
}


def _entropy(value: str) -> float:
    if not value:
        return 0.0
    counter = Counter(value)
    total = len(value)
    return -sum((count / total) * (count / total) ** 0.5 for count in counter.values())


def _is_ipv4(domain: str) -> bool:
    try:
        return isinstance(ipaddress.ip_address(domain), ipaddress.IPv4Address)
    except ValueError:
        return False


def _is_ipv6(domain: str) -> bool:
    stripped = domain.strip("[]")
    try:
        return isinstance(ipaddress.ip_address(stripped), ipaddress.IPv6Address)
    except ValueError:
        return False


def extract_ml_features(url: str) -> dict | None:
    """
    Returns the 23 lexical + host-based features the trained model expects,
    plus a couple of extra derived signals (has_userinfo, is_punycode) used
    only for verdict sub-categorization in ml_classifier.py, not fed to the
    model itself.
    """
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

    is_ipv4 = _is_ipv4(domain)
    is_ipv6 = _is_ipv6(domain)
    has_ip_address = is_ipv4 or is_ipv6

    num_query_params = len(query.split("&")) if query else 0
    num_subdomains = max(0, domain.count(".") - (1 if not is_ipv4 else 0))

    if has_ip_address:
        tld = ""
        second_level_domain = ""
        top_level_domain = ""
        subdomain_count = 0
        has_numeric_domain = True
    else:
        parts = domain.split(".")
        if len(parts) >= 3 and ".".join(parts[-2:]) in _COMPOUND_TLDS:
            tld = ".".join(parts[-2:])
            second_level_domain = parts[-3] if len(parts) >= 3 else ""
            subdomain_count = max(0, len(parts) - 3)
        else:
            tld = parts[-1] if parts else ""
            second_level_domain = parts[-2] if len(parts) >= 2 else ""
            subdomain_count = max(0, len(parts) - 2)
        top_level_domain = tld
        has_numeric_domain = any(char.isdigit() for char in domain)

    return {
        # 23 features the model was trained on:
        "url_length": len(url),
        "domain_length": len(domain),
        "path_length": len(path),
        "query_length": len(query),
        "fragment_length": len(fragment),
        "num_dots": url.count("."),
        "num_hyphens": url.count("-"),
        "num_underscores": url.count("_"),
        "num_slashes": url.count("/"),
        "num_query_params": num_query_params,
        "num_subdomains": num_subdomains,
        "domain_entropy": _entropy(domain),
        "url_entropy": _entropy(url),
        "tld": tld,
        "second_level_domain": second_level_domain,
        "has_ip_address": has_ip_address,
        "has_http": parsed.scheme == "http",
        "has_https": parsed.scheme == "https",
        "has_suspicious_chars": bool(_SUSPICIOUS_CHARS_RE.search(url)),
        "is_ipv4": is_ipv4,
        "is_ipv6": is_ipv6,
        "has_numeric_domain": has_numeric_domain,
        "subdomain_count": subdomain_count,
        # Derived signals for verdict sub-categorization only (not part of
        # the trained model's feature set):
        "has_userinfo": parsed.username is not None,
        "is_punycode": any(label.startswith("xn--") for label in domain.split(".")),
    }


class MLFeatureExtractor:
    """
    Implements the FeatureExtractor protocol (see orchestrator.py). By the
    time analyze() calls this, URLAnalysisRequest has already validated
    the URL is well-formed, so extract_ml_features returning None here in
    practice shouldn't happen - the empty-defaults fallback exists so a
    genuinely unparseable edge case degrades to "no signal" rather than
    crashing the whole request.
    """

    def extract(self, url: str) -> dict:
        features = extract_ml_features(url)
        if features is not None:
            return features
        return {
            "url_length": len(url), "domain_length": 0, "path_length": 0,
            "query_length": 0, "fragment_length": 0, "num_dots": 0,
            "num_hyphens": 0, "num_underscores": 0, "num_slashes": 0,
            "num_query_params": 0, "num_subdomains": 0, "domain_entropy": 0.0,
            "url_entropy": 0.0, "tld": "", "second_level_domain": "",
            "has_ip_address": False, "has_http": False, "has_https": False,
            "has_suspicious_chars": False, "is_ipv4": False, "is_ipv6": False,
            "has_numeric_domain": False, "subdomain_count": 0,
            "has_userinfo": False, "is_punycode": False,
        }
