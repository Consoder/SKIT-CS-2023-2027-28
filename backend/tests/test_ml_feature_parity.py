"""Regression tests for training/serving parity in ML feature extraction."""

import pytest

from app.services.ml_features import (
    _is_ipv4,
    _is_ipv6,
    extract_ml_features,
)


@pytest.mark.parametrize(
    ("host", "expected_ipv4", "expected_ipv6"),
    [
        ("192.168.1.1", True, False),
        # Preserve the training regex's lexical behaviour exactly. Do not
        # replace this with strict address validation without retraining.
        ("999.999.999.999", True, False),
        ("256.1.1.1", True, False),
        ("[2001:db8::1]", False, True),
        ("[::::]", False, True),
        ("example.com", False, False),
        ("sub.example.co.uk", False, False),
    ],
)
def test_ip_detection_matches_training_regex(host, expected_ipv4, expected_ipv6):
    assert _is_ipv4(host) is expected_ipv4
    assert _is_ipv6(host) is expected_ipv6


def test_lexically_detected_ipv4_keeps_training_host_feature_semantics():
    features = extract_ml_features("http://999.999.999.999/path")
    assert features is not None
    assert features["is_ipv4"] is True
    assert features["is_ipv6"] is False
    assert features["has_ip_address"] is True
    assert features["has_numeric_domain"] is True
    assert features["tld"] == ""
    assert features["second_level_domain"] == ""
    assert features["subdomain_count"] == 0
    assert features["num_subdomains"] == 3


def test_bracketed_ipv6_is_detected_as_in_training():
    features = extract_ml_features("https://[2001:db8::1]/path")
    assert features is not None
    assert features["is_ipv4"] is False
    assert features["is_ipv6"] is True
    assert features["has_ip_address"] is True
    assert features["tld"] == ""
    assert features["second_level_domain"] == ""
    assert features["subdomain_count"] == 0


def test_normal_domain_features_remain_unchanged():
    features = extract_ml_features("https://mail.google.co.uk/search?q=1")
    assert features is not None
    assert features["tld"] == "co.uk"
    assert features["second_level_domain"] == "google"
    assert features["subdomain_count"] == 1
    # This field follows the original training implementation's dot count,
    # not the compound-TLD-aware host subdomain_count.
    assert features["num_subdomains"] == 2
    assert features["has_https"] is True
    assert features["has_http"] is False
