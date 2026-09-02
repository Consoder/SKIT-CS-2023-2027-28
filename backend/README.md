# Backend — URL Threat Detection API

FastAPI service for the "Identifying URL-Based Attacks using IP Data" project.
Sprint 3 (Task 1): project skeleton, env config, CORS, base routing.

## Structure

```
app/
  main.py              # app factory, CORS, router mount
  core/
    config.py          # pydantic-settings based Settings (.env driven)
    logging.py         # stdout logging config
  api/v1/
    api.py             # aggregates versioned routers
    endpoints/
      health.py         # GET /api/v1/health
tests/
  test_health.py
```

## Local setup

```bash
python -m venv .venv
.venv/Scripts/activate        # Windows
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

API docs: http://127.0.0.1:8000/docs
Health check: http://127.0.0.1:8000/api/v1/health

## Tests

```bash
pytest -q
```

## Roadmap (per project sprint plan)

- [x] Sprint 3.1 — FastAPI skeleton, config, CORS, base routing
- [ ] Sprint 3.2 — URL validation & request/response schemas (due 30-09-2026)
- [ ] Sprint 3.3 — Orchestration service (due 25-10-2026)
- [ ] Sprint 3.4 — Unified `/analyze` endpoint + integration tests (due 20-11-2026)
- [ ] Sprint 6.1 — VirusTotal / AbuseIPDB integration (due 15-12-2026)
- [ ] Sprint 6.2 — Redis caching layer (due 15-01-2027)
- [ ] Sprint 6.3 — PostgreSQL schema & indexing (due 10-02-2027)
- [ ] Sprint 6.4 — Blockchain audit logging + Docker + CI/CD (due 10-03-2027)
