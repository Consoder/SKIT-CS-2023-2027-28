"""
Real gap found 2026-09-25: auth was a single shared API key (see auth.py),
not real per-user accounts - the `users` table existed but nothing issued
per-user tokens. This adds password hashing and JWT issuance/verification;
app/api/v1/endpoints/auth.py wires them into /auth/register and /auth/login.

Design: JWTs are verified by signature + expiry only, with no per-request
DB lookup - deliberately stateless, consistent with the graceful-
degradation stance taken everywhere else in this backend (Redis, DB
retry+dead-letter). A DB round-trip on every authenticated request would
mean a Postgres outage takes down auth for already-logged-in users too,
not just new logins - see README.md "Extended outage testing". The
tradeoff (documented, not hidden): a token can't be revoked before it
expires. JWT_EXPIRE_MINUTES bounds how long that window is.
"""

import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import get_settings

# bcrypt truncates silently at 72 bytes - not a real-world limitation for
# a password, but worth bounding explicitly so a caller gets a clear error
# instead of silent truncation if something ever passes a much longer value.
MAX_PASSWORD_BYTES = 72


def hash_password(password: str) -> str:
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError(f"password must be at most {MAX_PASSWORD_BYTES} bytes")
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        # Malformed stored hash - fail closed, not an exception bubbling
        # up into a 500.
        return False


def create_access_token(user_id: uuid.UUID, email: str) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": now,
        "exp": now + timedelta(minutes=settings.JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


class InvalidTokenError(Exception):
    pass


def decode_access_token(token: str) -> dict:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise InvalidTokenError(str(exc)) from exc

    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise InvalidTokenError("token missing a valid subject claim") from exc

    return {"user_id": user_id, "email": payload.get("email")}
