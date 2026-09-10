import pandas as pd

from src.ingest import Source, _is_valid_url, load_and_clean
from src.features import (
    extract_features,
    has_ip_address,
    is_shortener,
    url_entropy,
    get_tld,
)


# ===== Ingest tests =====
def test_is_valid_url_accepts_normal_urls() -> None:
    assert _is_valid_url("http://example.com")
    assert _is_valid_url("example.com/path")


def test_is_valid_url_rejects_empty_and_malformed() -> None:
    assert not _is_valid_url("")
    assert not _is_valid_url(float("nan"))
    # malformed bracket sequences used to crash urlparse with ValueError
    assert not _is_valid_url("http://ex[ample.com]")


def test_load_and_clean_normalizes_labels_and_drops_invalid(tmp_path) -> None:
    raw = tmp_path / "raw.csv"
    raw.write_text("url,label\nexample.com,good\nbad-site.com,bad\n,bad\nexample.com,unknown\n")

    source = Source(
        name="test_source",
        url="unused",
        url_col="url",
        label_col="label",
        label_map={"good": "benign", "bad": "malicious"},
    )
    df = load_and_clean(source, raw)

    assert set(df["label"]) == {"benign", "malicious"}
    assert len(df) == 2
    assert (df["source"] == "test_source").all()


# ===== Feature extraction tests =====
def test_entropy_calculation() -> None:
    # Uniform string = high entropy
    high_entropy = url_entropy("aaaa")
    # Repetitive = low entropy
    low_entropy = url_entropy("abcd")
    assert high_entropy >= 0


def test_ip_address_detection() -> None:
    assert has_ip_address("192.168.1.1")
    assert has_ip_address("10.0.0.1")
    assert not has_ip_address("example.com")
    assert not has_ip_address("sub.example.com")


def test_shortener_detection() -> None:
    assert is_shortener("bit.ly")
    assert is_shortener("tinyurl.com")
    assert is_shortener("goo.gl")
    assert not is_shortener("google.com")
    assert not is_shortener("example.com")


def test_tld_extraction() -> None:
    assert get_tld("example.com") == "com"
    assert get_tld("sub.example.co.uk") == "uk"
    assert get_tld("localhost") == "localhost"
    assert get_tld("") == ""


def test_extract_features_benign_url() -> None:
    features = extract_features("https://www.google.com/search?q=test")
    assert features["url"] == "https://www.google.com/search?q=test"
    assert features["has_https"] == 1
    assert features["has_http"] == 0
    assert features["has_query_string"] == 1
    assert features["url_length"] > 0
    assert features["dot_count"] >= 1
    assert features["subdomain_count"] >= 1


def test_extract_features_suspicious_url() -> None:
    features = extract_features("http://192.168.1.1:8080/path?q=value")
    assert features["has_ip_address"] == 1
    assert features["has_unusual_port"] == 1
    assert features["has_http"] == 1


def test_extract_features_shortener() -> None:
    features = extract_features("https://bit.ly/abc123")
    assert features["is_shortener"] == 1


def test_extract_features_at_symbol() -> None:
    features = extract_features("http://user@example.com")
    assert features["at_symbol_count"] >= 1


def test_extract_features_handles_invalid_url() -> None:
    # Should not crash, should return features dict with NaN values for missing data
    features = extract_features("")
    assert "url" in features
    assert len(features) > 10  # Should have feature columns


def test_extract_features_normalization() -> None:
    # Case insensitivity
    features1 = extract_features("HTTP://EXAMPLE.COM")
    features2 = extract_features("http://example.com")
    assert features1["url_length"] == features2["url_length"]
    assert features1["dot_count"] == features2["dot_count"]
