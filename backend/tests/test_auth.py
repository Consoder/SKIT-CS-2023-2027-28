"""
Real gap found 2026-09-25: /analyze's only auth was a single shared API
key, not real per-user accounts - see core/security.py, api/v1/endpoints/
auth.py, api/deps.py.
"""

import time

import jwt
import pytest
import pytest_asyncio
from fastapi.testclient import TestClient

from app.api.deps import get_db_session
from app.api.v1.endpoints.analyze import get_orchestrator
from app.core.config import get_settings
from app.core.security import (
    InvalidTokenError,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.db.models import Base
from app.db.session import create_session_factory, create_engine as _create_engine
from app.main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# core/security.py - unit tests, no DB/HTTP involved
# ---------------------------------------------------------------------------


def test_hash_and_verify_password_roundtrip() -> None:
    hashed = hash_password("correct horse battery staple")
    assert verify_password("correct horse battery staple", hashed)


def test_wrong_password_fails_verification() -> None:
    hashed = hash_password("correct horse battery staple")
    assert not verify_password("wrong password", hashed)


def test_password_hash_is_never_the_plaintext() -> None:
    hashed = hash_password("correct horse battery staple")
    assert hashed != "correct horse battery staple"
    assert hashed.startswith("$2b$")  # real bcrypt hash, not a no-op


def test_access_token_roundtrip() -> None:
    import uuid

    user_id = uuid.uuid4()
    token = create_access_token(user_id, "user@example.com")
    claims = decode_access_token(token)
    assert claims["user_id"] == user_id
    assert claims["email"] == "user@example.com"


def test_expired_token_is_rejected() -> None:
    import uuid

    settings = get_settings()
    now = time.time()
    expired_payload = {
        "sub": str(uuid.uuid4()),
        "email": "user@example.com",
        "iat": now - 120,
        "exp": now - 60,  # expired one minute ago
    }
    expired_token = jwt.encode(expired_payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    with pytest.raises(InvalidTokenError):
        decode_access_token(expired_token)


def test_token_signed_with_wrong_secret_is_rejected() -> None:
    import uuid

    settings = get_settings()
    forged_payload = {
        "sub": str(uuid.uuid4()),
        "email": "attacker@example.com",
        "iat": time.time(),
        "exp": time.time() + 3600,
    }
    forged_token = jwt.encode(forged_payload, "not-the-real-secret", algorithm=settings.JWT_ALGORITHM)

    with pytest.raises(InvalidTokenError):
        decode_access_token(forged_token)


# ---------------------------------------------------------------------------
# /auth/register, /auth/login - real HTTP + real (in-memory) DB
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def db_override():
    engine = _create_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = create_session_factory(engine)

    async def _get_db_session():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db_session] = _get_db_session
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_db_session, None)
        await engine.dispose()


def test_register_returns_a_usable_access_token(db_override) -> None:
    response = client.post("/api/v1/auth/register", json={"email": "new@example.com", "password": "correcthorse123"})
    assert response.status_code == 201
    body = response.json()
    assert body["token_type"] == "bearer"

    claims = decode_access_token(body["access_token"])
    assert claims["email"] == "new@example.com"


def test_register_duplicate_email_is_rejected(db_override) -> None:
    client.post("/api/v1/auth/register", json={"email": "dup@example.com", "password": "correcthorse123"})
    response = client.post("/api/v1/auth/register", json={"email": "dup@example.com", "password": "differentpass"})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "conflict"


def test_register_rejects_short_password(db_override) -> None:
    response = client.post("/api/v1/auth/register", json={"email": "short@example.com", "password": "short"})
    assert response.status_code == 422


def test_login_with_correct_credentials_succeeds(db_override) -> None:
    client.post("/api/v1/auth/register", json={"email": "login@example.com", "password": "correcthorse123"})
    response = client.post("/api/v1/auth/login", json={"email": "login@example.com", "password": "correcthorse123"})
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_with_wrong_password_is_rejected(db_override) -> None:
    client.post("/api/v1/auth/register", json={"email": "login2@example.com", "password": "correcthorse123"})
    response = client.post("/api/v1/auth/login", json={"email": "login2@example.com", "password": "wrongpassword"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


def test_login_with_nonexistent_email_is_rejected(db_override) -> None:
    response = client.post(
        "/api/v1/auth/login", json={"email": "nobody-here@example.com", "password": "whatever123"}
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


# ---------------------------------------------------------------------------
# /analyze integration - optional JWT attribution
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _reset_rate_limiter_for_this_module():
    from app.core.rate_limit import limiter as _limiter

    _limiter.reset()
    yield
    _limiter.reset()


def test_analyze_without_token_still_works_anonymously() -> None:
    class StubOrchestrator:
        received_user_id = "not-called"

        async def analyze(self, request, user_id=None):
            from app.schemas.analysis import URLAnalysisResponse

            type(self).received_user_id = user_id
            return URLAnalysisResponse(url=request.url, verdict="benign", risk_score=1.0, evidence={})

    app.dependency_overrides[get_orchestrator] = lambda: StubOrchestrator()
    try:
        response = client.post("/api/v1/analyze", json={"url": "https://example.com"})
        assert response.status_code == 200
        assert StubOrchestrator.received_user_id is None
    finally:
        app.dependency_overrides.pop(get_orchestrator, None)


def test_analyze_with_valid_token_attributes_the_user() -> None:
    import uuid

    user_id = uuid.uuid4()
    token = create_access_token(user_id, "attributed@example.com")

    class StubOrchestrator:
        received_user_id = "not-called"

        async def analyze(self, request, user_id=None):
            from app.schemas.analysis import URLAnalysisResponse

            type(self).received_user_id = user_id
            return URLAnalysisResponse(url=request.url, verdict="benign", risk_score=1.0, evidence={})

    app.dependency_overrides[get_orchestrator] = lambda: StubOrchestrator()
    try:
        response = client.post(
            "/api/v1/analyze",
            json={"url": "https://example.com"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert StubOrchestrator.received_user_id == user_id
    finally:
        app.dependency_overrides.pop(get_orchestrator, None)


def test_analyze_with_invalid_token_is_rejected_not_silently_anonymous() -> None:
    response = client.post(
        "/api/v1/analyze",
        json={"url": "https://example.com"},
        headers={"Authorization": "Bearer not-a-real-token"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


@pytest.mark.asyncio
async def test_invalid_token_error_does_not_leak_internal_decode_details() -> None:
    """
    Real gap found via live testing 2026-09-25 (curl, not TestClient - httpx
    itself refuses to send a header with a raw non-ASCII byte, so this has
    to call the dependency directly to reproduce the same code path a real
    HTTP request hit): a malformed bearer token used to come back with the
    raw underlying jwt library error in the response body - "Invalid header
    string: 'utf-8' codec can't decode byte 0x81 in position 0: invalid
    start byte" - the same class of internal-detail leak the DEBUG=False
    fix exists to prevent elsewhere (see README.md "Security notes"). The
    message is now generic regardless of what the real decode failure was.
    """
    from app.api.deps import get_current_user
    from app.core.errors import AppError

    with pytest.raises(AppError) as exc_info:
        await get_current_user("Bearer garbage.\x81.here")

    message = exc_info.value.message
    assert message == "Invalid or expired token"
    assert "codec" not in message and "utf-8" not in message.lower()
