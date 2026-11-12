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



@pytest.mark.parametrize(
    ("url", "expected_http", "expected_https"),
    [
        ("http://example.com/path", True, False),
        ("https://example.com/path", False, True),
        ("example.com/path", True, False),
    ],
)
def test_scheme_flags_match_the_parsed_url_scheme(url, expected_http, expected_https):
    features = extract_ml_features(url)
    assert features is not None
    assert features["has_http"] is expected_http
    assert features["has_https"] is expected_https


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("https://example.com/path", False),
        ("https://example.com/a;b", True),
        ('https://example.com/\"quoted\"', True),
        ("https://example.com/search?q=a+b", True),
    ],
)
def test_suspicious_character_flag_matches_training_pattern(url, expected):
    features = extract_ml_features(url)
    assert features is not None
    assert features["has_suspicious_chars"] is expected


def test_userinfo_signal_is_derived_from_the_actual_parsed_authority():
    disguised_url = "http://google.com@evil.example/login"
    features = extract_ml_features(disguised_url)

    assert features is not None
    assert features["has_userinfo"] is True
    # The parsed authority remains the model's host input; this signal is
    # separate and is used only for verdict sub-categorization.
    assert features["second_level_domain"] == "evil"
    assert features["tld"] == "example"

    ordinary_url = "https://evil.example/login"
    ordinary_features = extract_ml_features(ordinary_url)
    assert ordinary_features is not None
    assert ordinary_features["has_userinfo"] is False


def test_punycode_signal_detects_encoded_host_labels_only():
    punycode_url = "http://xn--pple-43d.com/"
    features = extract_ml_features(punycode_url)

    assert features is not None
    assert features["is_punycode"] is True

    ordinary_features = extract_ml_features("https://apple.com/")
    assert ordinary_features is not None
    assert ordinary_features["is_punycode"] is False

    # A punycode-looking string in the path is not a host label.
    path_features = extract_ml_features("https://example.com/xn--pple-43d")
    assert path_features is not None
    assert path_features["is_punycode"] is False
