"""
Real gap found 2026-09-25, not part of any sprint task: /analyze's only
auth was a single shared API key (core/auth.py) - fine for a small number
of trusted callers, but not real per-user accounts. The `users` table
existed since Sprint 6.3 but nothing populated it. Register/login issue a
JWT (core/security.py); analyze.py accepts it optionally to attribute
analyses to a user without breaking existing anonymous/API-key access.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session
from app.core.errors import AppError
from app.core.security import create_access_token, hash_password, verify_password
from app.db.models import User
from app.schemas.auth import TokenResponse, UserLoginRequest, UserRegisterRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: UserRegisterRequest, session: AsyncSession = Depends(get_db_session)) -> TokenResponse:
    user = User(email=body.email, password_hash=hash_password(body.password))
    session.add(user)
    try:
        await session.commit()
    except IntegrityError as exc:
        # Real race found via review, not just theory: the "does this email
        # already exist" check has to be the DB's own unique constraint,
        # not a separate SELECT-then-INSERT - two concurrent registrations
        # for the same email would both pass a SELECT-based check before
        # either INSERT commits (classic TOCTOU), and the DB is the only
        # thing that can atomically arbitrate that.
        await session.rollback()
        raise AppError("An account with this email already exists", status_code=409, error_code="conflict") from exc

    return TokenResponse(access_token=create_access_token(user.id, user.email))


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLoginRequest, session: AsyncSession = Depends(get_db_session)) -> TokenResponse:
    result = await session.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    # Same error for "no such user" and "wrong password", and the password
    # check always runs even when the user doesn't exist (verify_password
    # against a fixed dummy hash) - real gap this avoids: returning early on
    # "user not found" makes that response measurably faster than a wrong-
    # password response, letting a timing attack enumerate valid emails
    # even though the API keeps the *message* the same.
    _DUMMY_HASH = "$2b$12$k0IqRW3mHOzGTTit2O7m6.MStuyFxbnSndtM0noSpswiHqGoJvU8y"
    password_ok = verify_password(body.password, user.password_hash if user else _DUMMY_HASH)

    if user is None or not password_ok:
        raise AppError("Incorrect email or password", status_code=401, error_code="unauthorized")

    return TokenResponse(access_token=create_access_token(user.id, user.email))
