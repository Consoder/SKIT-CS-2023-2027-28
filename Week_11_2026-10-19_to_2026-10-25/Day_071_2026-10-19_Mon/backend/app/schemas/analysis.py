"""
Sprint 3, Task 2 (URL validation & request/response schemas — due 30-09-2026):
response-side schema. Defines the shape every scan result returns in.
"""

from typing import Literal

from pydantic import BaseModel, Field

Verdict = Literal["benign", "phishing", "malware", "suspicious"]


class URLAnalysisResponse(BaseModel):
    url: str
    verdict: Verdict
    risk_score: float = Field(ge=0, le=100)
    evidence: dict = Field(default_factory=dict)
