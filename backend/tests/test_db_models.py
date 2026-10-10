import pytest
import pytest_asyncio
from sqlalchemy import inspect, select
from sqlalchemy.exc import IntegrityError

from app.db.models import AuditLog, Base, ThreatIntelligence, URLAnalysis, User
from app.db.session import create_engine, create_session_factory


@pytest_asyncio.fixture
async def session_factory():
    # In-memory SQLite - proves the schema itself is correct without needing
    # a running Postgres server. Production still targets Postgres (asyncpg).
    engine = create_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield create_session_factory(engine)
    await engine.dispose()


@pytest.mark.asyncio
async def test_all_four_tables_are_created(session_factory) -> None:
    async with session_factory() as session:

        def _table_names(sync_conn) -> set[str]:
            return set(inspect(sync_conn).get_table_names())

        conn = await session.connection()
        names = await conn.run_sync(_table_names)

        assert names == {"users", "url_analysis", "threat_intelligence", "audit_logs"}


@pytest.mark.asyncio
async def test_full_relationship_chain_persists_and_loads_correctly(session_factory) -> None:
    async with session_factory() as session:
        user = User(email="analyst@example.com", password_hash="fake-hash", role="analyst")
        session.add(user)
        await session.flush()

        analysis = URLAnalysis(
            user_id=user.id,
            url="https://example.com",
            verdict="benign",
            risk_score=5.0,
            features={"url_length": 19},
        )
        session.add(analysis)
        await session.flush()

        session.add(
            ThreatIntelligence(
                analysis_id=analysis.id,
                source="virustotal+abuseipdb",
                raw_response={"malicious_votes": 0},
            )
        )
        session.add(
            AuditLog(
                analysis_id=analysis.id,
                tx_hash="0xabc123",
                content_hash="deadbeef",
            )
        )
        await session.commit()

        loaded = (await session.execute(select(URLAnalysis).where(URLAnalysis.id == analysis.id))).scalar_one()
        assert loaded.url == "https://example.com"
        assert loaded.user_id == user.id


@pytest.mark.asyncio
async def test_duplicate_email_is_rejected_by_unique_constraint(session_factory) -> None:
    async with session_factory() as session:
        session.add(User(email="dup@example.com", password_hash="fake-hash"))
        await session.commit()

        session.add(User(email="dup@example.com", password_hash="fake-hash"))
        with pytest.raises(IntegrityError):
            await session.commit()


@pytest.mark.asyncio
async def test_expected_indexes_exist_on_url_analysis(session_factory) -> None:
    async with session_factory() as session:

        def _index_names(sync_conn) -> set[str]:
            return {ix["name"] for ix in inspect(sync_conn).get_indexes("url_analysis")}

        conn = await session.connection()
        names = await conn.run_sync(_index_names)

        assert "ix_url_analysis_url" in names
        assert "ix_url_analysis_user_analyzed_at" in names
