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


def test_rejects_plain_text_with_spaces() -> None:
    # Real bug found live 2026-09-14: this used to silently pass as
    # "http://not a url" - urlparse doesn't reject whitespace in a netloc
    # with no path, so a non-empty-netloc check alone wasn't sufficient.
    with pytest.raises(ValidationError):
        URLAnalysisRequest(url="not a url")


def test_accepts_localhost_and_ip_hosts() -> None:
    assert URLAnalysisRequest(url="http://localhost:8000").url == "http://localhost:8000"
    assert URLAnalysisRequest(url="http://192.168.1.1/login").url == "http://192.168.1.1/login"


def test_rejects_javascript_scheme_instead_of_mangling_it() -> None:
    """
    Real bug found live via edge-case testing 2026-09-14: "javascript:alert(1)"
    has no "://", so the old scheme check blindly prepended "http://",
    mangling it into "http://javascript:alert(1)" - which then got ACCEPTED
    as a valid URL instead of being rejected for its real scheme.
    """
    with pytest.raises(ValidationError):
        URLAnalysisRequest(url="javascript:alert(1)")


def test_rejects_data_scheme_instead_of_mangling_it() -> None:
    with pytest.raises(ValidationError):
        URLAnalysisRequest(url="data:text/html,<script>alert(1)</script>")


def test_rejects_extremely_long_url() -> None:
    """
    Real bug found via adversarial testing 2026-09-14: a 100k+ character
    URL passed validation fine, then crashed downstream with DEBUG's raw
    traceback leaking to the client. Rejecting unreasonable length at the
    boundary is the first line of defense.
    """
    with pytest.raises(ValidationError):
        URLAnalysisRequest(url="http://example.com/" + ("a" * 100_000))


def test_accepts_trailing_dot_in_domain() -> None:
    """example.com. is technically valid DNS (represents the root) - was incorrectly rejected."""
    req = URLAnalysisRequest(url="http://example.com./path")
    assert req.url == "http://example.com./path"


def test_accepts_ipv6_hosts() -> None:
    assert URLAnalysisRequest(url="http://[2001:db8::1]/path").url == "http://[2001:db8::1]/path"
    assert URLAnalysisRequest(url="http://[::1]:8080/").url == "http://[::1]:8080/"
