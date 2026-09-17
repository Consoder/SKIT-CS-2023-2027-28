"""
Sprint 3, Task 2 (URL validation & request/response schemas — due 30-09-2026):
request-side validation. Only well-formed URLs are allowed past this point
into the rest of the pipeline.
"""

import ipaddress
import re
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator

# Real bug found via adversarial testing 2026-09-14: a 100k+ character URL
# passed validation fine, then crashed downstream with a raw exception when
# the URL is eventually handed off to an HTTP client. Rejecting unreasonable
# length here, at the boundary, is the first line of defense.
MAX_URL_LENGTH = 2048

# Matches a valid domain label sequence (example.com, sub.example.co.uk,
# localhost), with an optional trailing dot (the DNS root - "example.com."
# is valid, real syntax, wrongly rejected before this fix, found 2026-09-14).
# IPv4/IPv6 literals are validated separately via the ipaddress module
# below, not by this regex - trying to hand-roll IPv6 validation in regex
# is exactly the kind of thing that goes wrong in subtle ways.
_HOSTNAME_RE = re.compile(
    r"^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"
    r"(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.?$"
)


def _is_valid_hostname(hostname: str) -> bool:
    try:
        ipaddress.ip_address(hostname)
        return True  # valid IPv4 or IPv6 literal
    except ValueError:
        pass
    return bool(_HOSTNAME_RE.match(hostname))

# Detects ANY URI scheme prefix (RFC 3986: ALPHA *(ALPHA/DIGIT/"+"/"-"/"."))
# followed by ":" - not just the ones using "://". Real bug this fixes,
# found via edge-case testing 2026-09-14: "javascript:alert(1)" has no
# "://", so the old check blindly prepended "http://", mangling it into
# "http://javascript:alert(1)" - which then got ACCEPTED as a valid URL
# instead of being correctly rejected for using a disallowed scheme.
_SCHEME_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*:")


class URLAnalysisRequest(BaseModel):
    url: str = Field(max_length=MAX_URL_LENGTH)

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        candidate = value.strip()
        if not candidate:
            raise ValueError("url must not be empty")

        if not _SCHEME_RE.match(candidate):
            candidate = f"http://{candidate}"

        try:
            parsed = urlparse(candidate)
        except ValueError as exc:
            raise ValueError(f"malformed url: {exc}") from exc

        if not parsed.netloc:
            raise ValueError("url must contain a valid host")

        if parsed.scheme not in ("http", "https"):
            raise ValueError("url scheme must be http or https")

        # Bug found and fixed 2026-09-14: without this, a plain string like
        # "not a url" silently passed validation - urlparse happily accepts
        # whitespace inside a netloc with no path segment, so the earlier
        # "netloc is non-empty" check alone wasn't enough.
        if not parsed.hostname or not _is_valid_hostname(parsed.hostname):
            raise ValueError("url must contain a valid hostname")

        return candidate
