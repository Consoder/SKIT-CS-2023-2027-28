import pytest
from pydantic import ValidationError

from app.schemas.url import URLAnalysisRequest


def test_accepts_valid_url() -> None:
    req = URLAnalysisRequest(url="https://example.com/path")
    assert req.url == "https://example.com/path"


def test_normalizes_missing_scheme() -> None:
    req = URLAnalysisRequest(url="example.com")
    assert req.url == "http://example.com"


def test_rejects_empty_url() -> None:
    with pytest.raises(ValidationError):
        URLAnalysisRequest(url="   ")


def test_rejects_malformed_bracket_sequence() -> None:
    # urlparse raises ValueError on inputs like this - must be caught, not crash the request.
    with pytest.raises(ValidationError):
        URLAnalysisRequest(url="http://ex[ample.com]")


def test_rejects_non_http_scheme() -> None:
    with pytest.raises(ValidationError):
        URLAnalysisRequest(url="ftp://example.com")
