# Week 12 — 26-10-2026 to 01-11-2026

Kartik Bhargava · Backend & Integration (Form 2: Sprint 3 & Sprint 6)

**Sprint 3 · Task 4** (26-10-2026 → 20-11-2026): Exposed the unified /analyze REST endpoint, wrote integration tests and wired the backend to the frontend.

| Day | Date | Work | Commit message |
|---|---|---|---|
| 78 | Mon 26-10-2026 | /analyze — orchestrator dependency | `feat(api): add analysis router and cached orchestrator dependency` |
| 79 | Tue 27-10-2026 | /analyze — route | `feat(api): add POST /analyze returning a unified verdict` |
| 80 | Wed 28-10-2026 | Mount /analyze | `feat(api): mount analysis router in v1 API` |
| 81 | Thu 29-10-2026 | Endpoint tests — setup + happy path | `test(api): integration test for POST /analyze` |
| 82 | Fri 30-10-2026 | Endpoint tests — raw-IP URL | `test(api): raw-IP URL comes back suspicious over HTTP` |
| 83 | Sat 31-10-2026 | Endpoint tests — malformed URL | `test(api): malformed URL returns a structured 422` |
| 84 | Sun 01-11-2026 | Endpoint tests — missing field | `test(api): missing url field returns a structured 422` |

Each `Day_...` folder holds the full project as of end of day (provided archive), a `WORKLOG.md` and a `CHANGES.diff`.
