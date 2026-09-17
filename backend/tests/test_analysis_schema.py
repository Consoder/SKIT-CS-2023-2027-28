import pytest
from pydantic import ValidationError

from app.schemas.analysis import URLAnalysisResponse


def test_accepts_valid_response() -> None:
    resp = URLAnalysisResponse(
        url="https://example.com",
        verdict="benign",
        risk_score=12.5,
    )
    assert resp.verdict == "benign"
    assert resp.evidence == {}


def test_accepts_evidence_payload() -> None:
    resp = URLAnalysisResponse(
        url="https://example.com",
        verdict="phishing",
        risk_score=87.0,
        evidence={"url_length": 120, "has_ip_address": False},
    )
    assert resp.evidence["url_length"] == 120


def test_rejects_unknown_verdict() -> None:
    with pytest.raises(ValidationError):
        URLAnalysisResponse(url="https://example.com", verdict="unknown", risk_score=10)


def test_rejects_risk_score_out_of_range() -> None:
    with pytest.raises(ValidationError):
        URLAnalysisResponse(url="https://example.com", verdict="malware", risk_score=150)

    with pytest.raises(ValidationError):
        URLAnalysisResponse(url="https://example.com", verdict="malware", risk_score=-5)
