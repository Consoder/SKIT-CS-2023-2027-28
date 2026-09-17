from urllib.parse import urlparse

from pydantic import BaseModel, field_validator


class URLAnalysisRequest(BaseModel):
    url: str

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        candidate = value.strip()
        if not candidate:
            raise ValueError("url must not be empty")

        if "://" not in candidate:
            candidate = f"http://{candidate}"

        try:
            parsed = urlparse(candidate)
        except ValueError as exc:
            raise ValueError(f"malformed url: {exc}") from exc

        if not parsed.netloc:
            raise ValueError("url must contain a valid host")

        if parsed.scheme not in ("http", "https"):
            raise ValueError("url scheme must be http or https")

        return candidate
