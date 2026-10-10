"""
Real gap found 2026-09-25: auth was a single shared API key, not real
per-user accounts. Request/response shapes for /auth/register and
/auth/login (see api/v1/endpoints/auth.py, core/security.py).
"""

import uuid

from pydantic import BaseModel, EmailStr, Field

from app.core.security import MAX_PASSWORD_BYTES

MIN_PASSWORD_LENGTH = 8


class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_BYTES)


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: str
