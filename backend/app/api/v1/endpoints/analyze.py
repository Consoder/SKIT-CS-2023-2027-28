"""
Sprint 3, Task 4 (Unified /analyze endpoint — due 20-11-2026):
exposes the orchestration service (Task 3) behind one REST endpoint, taking
a validated request (Task 2) and returning one consistent verdict.

Rate limiting (real gap found 2026-09-14, not part of any sprint task):
without this, we exhausted VirusTotal's real quota on ourselves during
stress testing - a client could do the same to deny service to everyone
else. See core/rate_limit.py for why it's Redis-backed.

Authentication (real gap found 2026-09-14, not part of any sprint task):
the endpoint was fully open. See core/auth.py - disabled unless API_KEY is
configured, so this stays a no-op for local dev and the existing tests.

Per-user auth (real gap found 2026-09-25): the API_KEY above is a single
shared secret, not real accounts. A caller MAY also send a real per-user
JWT (see core/security.py, /auth/register, /auth/login) via
`Authorization: Bearer <token>` - when present and valid, the analysis
gets attributed to that user (url_analysis.user_id) for a future "my scan
history" feature; when absent, the request proceeds exactly as before
(anonymous/API-key-gated). A token that IS supplied but invalid/expired
still gets rejected with 401 rather than silently falling back to
anonymous - see api/deps.py's get_current_user_optional for why.
"""

from functools import lru_cache

from fastapi import APIRouter, Depends, Request

from app.api.deps import get_current_user_optional
from app.core.auth import verify_api_key
from app.core.config import get_settings
from app.core.rate_limit import limiter
from app.schemas.analysis import URLAnalysisResponse
from app.schemas.url import URLAnalysisRequest
from app.services.orchestrator import AnalysisOrchestrator, get_default_orchestrator

router = APIRouter(tags=["analysis"])


@lru_cache
def get_orchestrator() -> AnalysisOrchestrator:
    # Placeholder pieces are stateless - one shared instance is enough, no
    # need to rebuild it per request. Once Sprint 4/6 wire in a real model
    # or API client with actual state (connections, loaded weights), this
    # is exactly where that gets constructed once and reused too.
    return get_default_orchestrator()


@router.post("/analyze", response_model=URLAnalysisResponse, dependencies=[Depends(verify_api_key)])
@limiter.limit(lambda: get_settings().ANALYZE_RATE_LIMIT)
async def analyze_url(
    request: Request,
    body: URLAnalysisRequest,
    orchestrator: AnalysisOrchestrator = Depends(get_orchestrator),
    current_user: dict | None = Depends(get_current_user_optional),
) -> URLAnalysisResponse:
    user_id = current_user["user_id"] if current_user is not None else None
    return await orchestrator.analyze(body, user_id)
