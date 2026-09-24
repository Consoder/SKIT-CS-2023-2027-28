import pytest
from pydantic import ValidationError

from app.schemas.url import URLAnalysisRequest


def test_rejects_port_above_valid_range() -> None:
    """Real bug found 2026-09-24: port was never validated at all -
    'http://example.com:99999/' (max valid TCP port is 65535) passed."""
    with pytest.raises(ValidationError):
        URLAnalysisRequest(url="http://example.com:99999/")


def test_rejects_negative_port() -> None:
    with pytest.raises(ValidationError):
        URLAnalysisRequest(url="http://example.com:-1/")


def test_rejects_non_numeric_port() -> None:
    with pytest.raises(ValidationError):
        URLAnalysisRequest(url="http://example.com:abc/")


def test_accepts_valid_port_boundaries() -> None:
    assert URLAnalysisRequest(url="http://example.com:0/").url == "http://example.com:0/"
    assert URLAnalysisRequest(url="http://example.com:65535/").url == "http://example.com:65535/"


def test_accepts_url_with_no_port() -> None:
    req = URLAnalysisRequest(url="https://example.com/path")
    assert req.url == "https://example.com/path"
