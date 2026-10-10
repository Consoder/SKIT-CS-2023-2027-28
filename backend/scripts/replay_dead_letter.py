"""
Real gap found 2026-09-14, closed 2026-09-25: a DB outage used to just
silently drop the analysis. Now failed writes (after 3 retries) land in
data/db_dead_letter.jsonl instead of being lost - this script replays
them into the real DB once it's back up, then removes only the lines that
actually succeeded (so a second interrupted run doesn't re-replay
already-recovered records, and any line that fails again stays queued).

Usage:
    python scripts/replay_dead_letter.py
"""

import asyncio
import json
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import get_settings
from app.db.models import AuditLog, ThreatIntelligence, URLAnalysis
from app.db.session import create_engine, create_session_factory

DEAD_LETTER_PATH = Path(__file__).resolve().parent.parent / "data" / "db_dead_letter.jsonl"


async def replay() -> None:
    if not DEAD_LETTER_PATH.exists():
        print("No dead-letter file found - nothing to replay.")
        return

    lines = DEAD_LETTER_PATH.read_text(encoding="utf-8").splitlines()
    if not lines:
        print("Dead-letter file is empty - nothing to replay.")
        return

    print(f"Found {len(lines)} queued record(s). Replaying against {get_settings().DATABASE_URL}...")

    engine = create_engine()
    session_factory = create_session_factory(engine)

    still_failed: list[str] = []
    succeeded = 0

    for line in lines:
        record = json.loads(line)
        try:
            async with session_factory() as session:
                raw_user_id = record.get("user_id")
                analysis = URLAnalysis(
                    url=record["url"],
                    user_id=uuid.UUID(raw_user_id) if raw_user_id else None,
                    verdict=record["verdict"],
                    risk_score=record["risk_score"],
                    features=record.get("features", {}),
                )
                session.add(analysis)
                await session.flush()

                session.add(
                    ThreatIntelligence(
                        analysis_id=analysis.id,
                        source=record.get("threat_intel", {}).get("source", "none"),
                        raw_response=record.get("threat_intel", {}),
                    )
                )

                anchor_result = record.get("anchor_result")
                if anchor_result is not None:
                    session.add(
                        AuditLog(
                            analysis_id=analysis.id,
                            tx_hash=anchor_result["tx_hash"],
                            content_hash=anchor_result["content_hash"],
                        )
                    )

                await session.commit()
            succeeded += 1
        except Exception as exc:  # noqa: BLE001 - keep going, report at the end
            print(f"  still failing for {record.get('url')}: {exc}")
            still_failed.append(line)

    await engine.dispose()

    if still_failed:
        DEAD_LETTER_PATH.write_text("\n".join(still_failed) + "\n", encoding="utf-8")
    else:
        DEAD_LETTER_PATH.unlink()

    print(f"\nReplayed {succeeded}/{len(lines)} successfully. {len(still_failed)} still queued.")


if __name__ == "__main__":
    asyncio.run(replay())
