# Backend — URL Threat Detection API

FastAPI service for the "Identifying URL-Based Attacks using IP Data" project.
Sprint 3: Task 1 (project skeleton, env config, CORS, base routing) and
Task 2 (URL validation & request/response schemas, structured error handling).

## Structure

```
app/
  main.py              # app factory, CORS, router mount, error handlers
  core/
    config.py          # pydantic-settings based Settings (.env driven)
    logging.py         # stdout logging config
    errors.py          # structured error responses, never leaks internals
  api/v1/
    api.py             # aggregates versioned routers
    endpoints/
      health.py         # GET /api/v1/health
  schemas/
    url.py             # request-side URL validation (Sprint 3, Task 2)
    analysis.py         # response-side schema for scan results
tests/
  test_health.py
  test_url_schema.py
  test_url_schema_control_chars.py
  test_url_schema_port.py
  test_analysis_schema.py
  test_error_handling.py
```

## Validation & error handling notes (Sprint 3, Task 2)

`app/schemas/url.py` rejects malformed/dangerous URLs at the boundary
instead of silently mangling them: disallowed schemes (`javascript:`,
`data:`) are rejected rather than accidentally accepted, oversized URLs are
capped at 2048 characters, and hostnames (including IPv4/IPv6 literals and
a trailing DNS root dot) are validated properly instead of via a naive
substring check.

`app/core/errors.py` guarantees every error response — validation
failures, domain errors, and truly unexpected exceptions alike — comes
back in one consistent JSON shape and never leaks a raw stack trace to the
client. `DEBUG` now defaults to `False` for the same reason: a debug-mode
default previously bypassed this handling entirely on any unhandled
exception (found via edge-case testing 2026-09-14, fixed here).

Two more real gaps found and fixed (2026-09-24), still within `url.py`'s
own validation scope:
- **Embedded control characters were accepted.** `.strip()` only trims
  leading/trailing whitespace, so `"http://example.com/\npath"` passed
  straight through with the newline still embedded in the middle - a real
  CRLF/header/log-injection risk if that string ever reaches a raw HTTP
  header or log line downstream. Now rejected via an explicit control-
  character check.
- **Port was never actually validated.** `http://example.com:99999/`
  (above the valid 0-65535 TCP range) and `:-1` both passed. `urlparse`'s
  own `.port` property already raises `ValueError` for exactly these
  cases - it just needed to be accessed at all, which it wasn't.

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
- [x] Sprint 3.2 — URL validation & request/response schemas (due 30-09-2026)
- [ ] Sprint 3.3 — Orchestration service (due 25-10-2026)
- [ ] Sprint 3.4 — Unified `/analyze` endpoint + integration tests (due 20-11-2026)
- [ ] Sprint 6.1 — VirusTotal / AbuseIPDB integration (due 15-12-2026)
- [ ] Sprint 6.2 — Redis caching layer (due 15-01-2027)
- [ ] Sprint 6.3 — PostgreSQL schema & indexing (due 10-02-2027)
- [ ] Sprint 6.4 — Blockchain audit logging + Docker + CI/CD (due 10-03-2027)
