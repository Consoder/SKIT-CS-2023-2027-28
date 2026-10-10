"""
Sprint 6, Task 3 (PostgreSQL schema & indexing — due 10-02-2027):
normalized schema for Users, URL_Analysis, Threat_Intelligence and
Audit_Logs, matching the ER design in the project README. Indexes sit on
every column the real query patterns actually need:
  - url_analysis.url        - repeat-lookup / cache-miss persistence checks
  - url_analysis.user_id +
    url_analysis.analyzed_at - "my scan history", newest first
  - threat_intelligence.analysis_id, audit_logs.analysis_id - join lookups
  - audit_logs.tx_hash       - verifying a specific on-chain audit entry
  - users.email              - unique, login/lookup
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

# Real bug found 2026-09-25, dormant since this schema was first written:
# without an explicit DateTime(timezone=True), SQLAlchemy maps a plain
# `datetime` column to Postgres' TIMESTAMP WITHOUT TIME ZONE - but
# _utcnow() below returns a timezone-AWARE datetime. asyncpg refuses to
# insert a tz-aware value into a tz-naive column ("can't subtract
# offset-naive and offset-aware datetimes"). Never caught before because
# the DB was never actually wired into a live request until now - this
# surfaced on the very first real insert.
_TZ_AWARE = DateTime(timezone=True)


class Base(DeclarativeBase):
    pass


def _new_uuid() -> uuid.UUID:
    return uuid.uuid4()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=_new_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    # Added 2026-09-25 alongside real per-user JWT auth (see
    # core/security.py) - this table existed since Sprint 6.3 but nothing
    # populated it until now. bcrypt hashes are 60 chars; sized generously.
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(50), default="user")
    created_at: Mapped[datetime] = mapped_column(_TZ_AWARE, default=_utcnow)

    analyses: Mapped[list["URLAnalysis"]] = relationship(back_populates="user")


class URLAnalysis(Base):
    __tablename__ = "url_analysis"
    __table_args__ = (
        Index("ix_url_analysis_url", "url"),
        Index("ix_url_analysis_user_analyzed_at", "user_id", "analyzed_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=_new_uuid)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    url: Mapped[str] = mapped_column(String(2048))
    verdict: Mapped[str] = mapped_column(String(20))
    risk_score: Mapped[float]
    features: Mapped[dict] = mapped_column(JSON, default=dict)
    analyzed_at: Mapped[datetime] = mapped_column(_TZ_AWARE, default=_utcnow, index=True)

    user: Mapped["User | None"] = relationship(back_populates="analyses")
    threat_intelligence: Mapped[list["ThreatIntelligence"]] = relationship(back_populates="analysis")
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="analysis")


class ThreatIntelligence(Base):
    __tablename__ = "threat_intelligence"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=_new_uuid)
    analysis_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("url_analysis.id"), index=True)
    source: Mapped[str] = mapped_column(String(50))
    raw_response: Mapped[dict] = mapped_column(JSON, default=dict)
    fetched_at: Mapped[datetime] = mapped_column(_TZ_AWARE, default=_utcnow)

    analysis: Mapped["URLAnalysis"] = relationship(back_populates="threat_intelligence")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=_new_uuid)
    analysis_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("url_analysis.id"), index=True)
    tx_hash: Mapped[str | None] = mapped_column(String(66), index=True, nullable=True)
    content_hash: Mapped[str] = mapped_column(String(64))
    anchored_at: Mapped[datetime] = mapped_column(_TZ_AWARE, default=_utcnow)

    analysis: Mapped["URLAnalysis"] = relationship(back_populates="audit_logs")
