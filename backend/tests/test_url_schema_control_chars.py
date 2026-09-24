import pytest
from pydantic import ValidationError

from app.schemas.url import URLAnalysisRequest


def test_rejects_embedded_newline() -> None:
    """
    Real bug found 2026-09-24: .strip() only removes leading/trailing
    whitespace - "http://example.com/\\npath" used to pass straight
    through with the newline still embedded in the middle, a real
    CRLF/header/log-injection risk if this string ever reaches a raw
    HTTP header or log line downstream.
    """
    with pytest.raises(ValidationError):
        URLAnalysisRequest(url="http://example.com/\npath")


def test_rejects_embedded_carriage_return() -> None:
    with pytest.raises(ValidationError):
        URLAnalysisRequest(url="http://example.com/\rpath")


def test_rejects_embedded_tab() -> None:
    with pytest.raises(ValidationError):
        URLAnalysisRequest(url="http://example.com/\tpath")


def test_rejects_embedded_null_byte() -> None:
    with pytest.raises(ValidationError):
        URLAnalysisRequest(url="http://example.com/\x00path")


def test_strips_trailing_whitespace_without_rejecting() -> None:
    """A trailing newline from copy-paste is edge whitespace, not an
    embedded control character - .strip() already handles it fine."""
    req = URLAnalysisRequest(url="https://example.com\n")
    assert req.url == "https://example.com"
