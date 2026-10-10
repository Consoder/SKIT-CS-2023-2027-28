# Backend — URL Threat Detection API

FastAPI service for the "Identifying URL-Based Attacks using IP Data" project.
Sprint 3: Task 1 (project skeleton, env config, CORS, base routing) and
Task 2 (URL validation & request/response schemas, structured error handling).

## Structure

```
app/
  main.py              # app factory, CORS, router mount, error handler registration
  core/
    config.py          # pydantic-settings based Settings (.env driven)
    logging.py         # stdout logging config
    errors.py          # structured error responses (AppError, validation, unhandled)
  schemas/
    url.py             # URLAnalysisRequest — validates/normalizes submitted URLs
    analysis.py        # URLAnalysisResponse — verdict, risk score, evidence
  services/
    orchestrator.py    # AnalysisOrchestrator — coordinates features + threat intel + classifier + cache
    threat_intel.py    # real VirusTotal + AbuseIPDB client — retries, rate-limit backoff, degrades safely
    cache.py           # Redis caching layer — repeat lookups skip the pipeline entirely
  db/
    models.py          # Users, URL_Analysis, Threat_Intelligence, Audit_Logs — normalized + indexed
    session.py         # async engine/session factory (Postgres in prod, SQLite in tests)
  services/
    blockchain.py      # BlockchainAuditLogger — anchors result hashes on-chain, degrades safely
  api/v1/
    api.py             # aggregates versioned routers
    endpoints/
      health.py         # GET /api/v1/health
<<<<<<< HEAD
  schemas/
    url.py             # request-side URL validation (Sprint 3, Task 2)
    analysis.py         # response-side schema for scan results
  services/
    orchestrator.py     # feature extraction + threat intel + classification (Sprint 3, Task 3)
=======
      analyze.py         # POST /api/v1/analyze — unified verdict endpoint
contracts/
  AuditLog.sol         # Solidity contract — anchors content hashes, real, compiled + deployed live
  build/               # compiled ABI + bytecode (git-ignored, regenerate via "Blockchain setup" below)
>>>>>>> c21d9f7 (test: add backend tests and CI workflow)
tests/
  test_health.py
  test_url_schema.py
  test_url_schema_control_chars.py
  test_url_schema_port.py
  test_analysis_schema.py
  test_error_handling.py
  test_orchestrator.py
<<<<<<< HEAD
=======
  test_analyze_endpoint.py
  test_threat_intel.py
  test_cache.py
  test_db_models.py
  test_blockchain.py
Dockerfile
docker-compose.yml     # backend + Redis + PostgreSQL, full local stack
>>>>>>> c21d9f7 (test: add backend tests and CI workflow)
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

## Orchestration service (Sprint 3, Task 3)

`app/services/orchestrator.py` coordinates feature extraction,
threat-intelligence and classification behind one `AnalysisOrchestrator.
analyze()` call. Each stage is a small `Protocol` (`FeatureExtractor`,
`ThreatIntelClient`, `Classifier`) with a placeholder implementation for
now:

- `PlaceholderFeatureExtractor` — lexical checks only (URL length,
  IPv4/IPv6-literal host, subdomain count, userinfo-disguise, punycode
  homograph detection).
- `PlaceholderThreatIntelClient` — always reports "unknown"; replaced by
  the real VirusTotal/AbuseIPDB client in Sprint 6, Task 1.
- `PlaceholderClassifier` — heuristic rules over the extracted features,
  already reading the `virustotal`/`abuseipdb` keys the real threat-intel
  client will populate later, so that swap needs no change here.

Deliberately out of scope for this task (each is its own later sprint,
and would be premature against placeholder dependencies that can't
actually hang or need caching): the real ML model (Sprint 4), the real
threat-intel client's per-provider timeout (Sprint 6, Task 1), the Redis
cache (Sprint 6, Task 2), and DB persistence (Sprint 6, Task 3).

`get_default_orchestrator()` wires the placeholders today; later sprints
swap in the real dependencies there without changing `analyze()`'s call
sites.

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

**Optional: run with real TLS locally** (real gap found 2026-09-14, not in
any sprint task — the API only ever served plain HTTP):

```bash
python scripts/generate_dev_cert.py   # self-signed, localhost + 127.0.0.1 only
uvicorn app.main:app --ssl-keyfile certs/dev-key.pem --ssl-certfile certs/dev-cert.pem
```

Then use `https://127.0.0.1:8000/...` — browsers/`curl` will warn since it's
self-signed (`curl -k` to skip verification while testing). A real
deployment needs a CA-issued certificate for a real domain instead of this
dev-only script.

## Tests

```bash
pytest -q
```

## Database migrations (Sprint 6, Task 3 wiring, closed 2026-09-25)

Real gap found 2026-09-14: the schema existed (`app/db/models.py`) but had
no versioned migrations - schema changes would have had no history and no
safe upgrade/rollback path. Now managed with Alembic, wired to the app's
own `Settings.DATABASE_URL` (not a second hardcoded connection string):

```bash
alembic upgrade head        # apply all migrations
alembic revision --autogenerate -m "describe the change"   # after editing models.py
alembic downgrade base      # roll back everything (verified live, drops cleanly)
```

Verified live 2026-09-25 against a real Postgres container: the initial
migration was autogenerated, correctly created all 4 tables + every index,
`alembic check` reported zero drift against the ORM models afterward, and
`downgrade base` cleanly dropped everything back out. Re-verified after
adding the second migration (`users.password_hash`, alongside real
per-user auth - see "User authentication" below): the full two-migration
chain downgrades to base and re-upgrades to head cleanly, and `alembic
check` still reports zero drift.

**DB write resilience**: a DB outage used to just silently drop the
analysis (found 2026-09-14). `AnalysisOrchestrator._persist()` now retries
with backoff first, and if the DB is genuinely down, appends the full
record to `data/db_dead_letter.jsonl` instead of losing it - run
`python scripts/replay_dead_letter.py` once the DB is back to recover
those. Verified live: killed the DB mid-request, confirmed the record
landed in the dead-letter file, brought Postgres back, ran the replay
script, confirmed the record appeared in `url_analysis` and the
dead-letter file was cleared.

## User authentication (real gap found and closed 2026-09-25)

`/analyze`'s only auth was a single shared `X-API-Key` (see below) - fine
for a small number of trusted callers, not real per-user accounts. The
`users` table existed since Sprint 6.3 but nothing populated it.

```bash
POST /api/v1/auth/register {"email": "...", "password": "..."}  -> 201, {access_token, token_type}
POST /api/v1/auth/login    {"email": "...", "password": "..."}  -> 200, {access_token, token_type}
```

Passwords are hashed with bcrypt (`app/core/security.py`, never stored or
logged in plaintext); tokens are JWTs signed with `JWT_SECRET_KEY`
(`JWT_EXPIRE_MINUTES`, default 24h). **`JWT_SECRET_KEY` has a dev-only
default and MUST be overridden with a long random value
(`openssl rand -hex 32`) before any real deployment** - unlike `API_KEY`/
`BLOCKCHAIN_PRIVATE_KEY`, which stay safely disabled when unset, an unset/
default signing key means every token this service issues is forgeable by
anyone who's read this file.

**Design choice, not an oversight**: JWTs are verified by signature +
expiry only - no DB lookup on every authenticated request. Consistent with
the graceful-degradation stance taken everywhere else in this backend (see
"Extended outage testing" below) - a DB round-trip on every request would
mean a Postgres outage locks out already-logged-in users too, not just
new registrations/logins. The real tradeoff, stated plainly: a token can't
be revoked before it expires (no logout-everywhere, no "deactivate this
account and cut off its live sessions"). `JWT_EXPIRE_MINUTES` bounds how
long that window is; a real deployment wanting revocation would need a
token blocklist (Redis, with a TTL matching the token's own expiry) -
not built, since nothing in this project currently needs it.

**`/analyze` integration is additive, not a breaking change**: a request
MAY include `Authorization: Bearer <token>` - when present and valid, the
analysis is attributed to that user (`url_analysis.user_id`, already
indexed for a "my scan history" query per `db/models.py`'s docstring) and
persisted normally; when absent, the endpoint behaves exactly as before
(open, or gated by the shared `API_KEY` below). A token that IS supplied
but invalid/expired is rejected with 401 rather than silently treated as
anonymous - a caller presenting a bad token almost certainly expected to
be authenticated, and downgrading that silently would hide the failure.

Known limitation, found while implementing this (not fixed - a bigger,
separate design decision): a cache hit or in-flight-request coalescing
(see `orchestrator.py`) returns the already-computed result without
writing a new DB row, so if user B requests a URL user A already caused to
be cached/in-flight, user B gets the correct verdict but no row is written
for user B - it won't appear in a future "my scan history" for user B.
Fixing this would mean writing a DB row on every request regardless of
cache status, changing the cache's performance characteristics.

Tested (`tests/test_auth.py`, `tests/test_db_models.py`): password hash/
verify roundtrip, wrong password rejected, JWT roundtrip, expired token
rejected, token signed with the wrong secret rejected, register/login
happy paths, duplicate email rejected (via the DB's own unique constraint,
not a check-then-insert - avoids a TOCTOU race between two concurrent
registrations for the same email), login timing kept constant between
"no such user" and "wrong password" (real password verification always
runs, against a fixed dummy hash when the user doesn't exist, so response
timing alone can't be used to enumerate valid emails), `/analyze` with no
token / a valid token / an invalid token.

## Blockchain setup (Sprint 6, Task 4)

`web3`'s own declared dependency versions have no installable wheel on
Windows/Python 3.13 without Microsoft C++ Build Tools, so it's installed
as a separate step:

```bash
pip install -r requirements.txt
pip install --no-deps -r requirements-blockchain.txt
```

To compile the contract (needs Docker — sidesteps `solc-bin.ethereum.org`,
which is unreachable on some networks):

```bash
docker run --rm -v "${PWD}/contracts:/contracts" ethereum/solc:0.8.20 \
  --bin --abi --optimize -o /contracts/build /contracts/AuditLog.sol --overwrite
```

Verified live 2026-09-14 against a real Ganache container (`docker run -d -p 8545:8545 trufflesuite/ganache`):
real contract deployed, real transaction mined, real on-chain read confirmed
(`scripts/verify_blockchain_live.py`). The checked-in test suite
(`test_blockchain.py`) uses a fake Web3 stub instead, so CI doesn't need a
live chain.

**Real key signing (closed 2026-09-25)**: previously relied on the
connected node holding an unlocked account and signing on our behalf -
fine for local Ganache, never for a real deployment. Set
`BLOCKCHAIN_PRIVATE_KEY` and `BlockchainAuditLogger` now builds, signs
(locally, with `eth_account`), and submits the transaction itself - the
node never sees the key. Falls back to the old node-trust path only when
no key is configured. Verified live: deployed a fresh contract, anchored
using an account the node had never unlocked, confirmed the on-chain
record's `submitted_by` matches the signer's real address.

## Docker

```bash
docker compose up -d --build   # backend + Redis + PostgreSQL
```

Verified live 2026-09-14: all three services start, `/analyze` correctly
uses the real Redis cache (confirmed via `redis-cli`), Postgres accepts
connections.

TLS is also supported here: generate a cert with
`python scripts/generate_dev_cert.py`, uncomment the `certs` volume mount
and the `SSL_KEYFILE`/`SSL_CERTFILE` lines in `docker-compose.yml`, and
Uvicorn inside the container terminates TLS directly — verified live by
starting the container this way and confirming plain HTTP fails while
`curl -k https://...` succeeds.

## Deploying to Render (prep done 2026-09-25, not deployed yet)

`render.yaml` is a Blueprint: a free-tier web service (Docker runtime), a
free-tier managed Postgres, and a free-tier Redis, wired together via
`fromDatabase`/`fromService` so no connection string is hand-typed.

Verified live before writing it, using a container capped at 512MB RAM and
1 worker to match Render's free tier exactly:
- **Fixed a real crash**: `python:3.12-slim` doesn't ship `libgomp`, so
  LightGBM's native binary failed at import with
  `OSError: libgomp.so.1: cannot open shared object file` — this only ever
  showed up inside a real container, never in local venv testing. Fixed by
  installing `libgomp1` in the `Dockerfile`.
- **Memory**: real `/analyze` requests through the actual ML model used
  ~350MB/512MB — comfortably under the limit, but without much headroom for
  heavy concurrent load on the free tier.
- **Port binding**: Render assigns the listen port at runtime via `$PORT`;
  the `Dockerfile`'s `CMD` now reads `${PORT}` (defaulting to `8000` so
  local `docker run`/Compose, which never set `PORT`, are unaffected).
- google.com correctly returned `benign` (trusted-domain allowlist working)
  and a known phishing-style URL correctly returned `malware`, confirming
  the ~120MB of model files load and score correctly inside the container.

**To actually deploy:** connect this repo in Render's dashboard
("New +" → "Blueprint"), point it at `backend/render.yaml`, and set the
secrets Render doesn't get from `fromDatabase`/`fromService` (VirusTotal/
AbuseIPDB keys, `API_KEY`, `BACKEND_CORS_ORIGINS` for the real frontend
origin, `BLOCKCHAIN_*` if a real chain is wired up) directly in its
dashboard — never commit them.

**Not done yet, deliberately** — this project hasn't actually been deployed:
- The ~120MB of ML model files (`app/ml_models/*.pkl`) are currently
  untracked/uncommitted, same as the rest of this session's backend and ML
  work. Render's GitHub-integration deploy flow needs them in the repo to
  build the image, so an actual deploy requires committing and pushing them
  first — not done without separate, explicit confirmation.
- No real domain — this is a college project, so it would run on Render's
  own `onrender.com` subdomain rather than a custom domain (see "Known,
  unaddressed gaps" below for what that means for TLS).
- Free tier: Render's free web services spin down after inactivity and cold
  -start on the next request; acceptable for a demo, not for "always on."

## CI/CD

`.github/workflows/backend-ci.yml` runs the full test suite on every push/PR
touching `backend/**`.

## Security notes (audited 2026-09-14)

**Input validation, hardened via real edge-case testing, not just theory:**
dangerous URL schemes (`javascript:`, `data:`) are rejected instead of being
silently mangled into fake `http://` URLs; the classic `user@host` phishing
disguise and IDN/Punycode homograph attacks (`xn--pple-43d.com`) are both
now detected; malformed input never crashes the request (structured errors,
no stack traces leaked).

**Dependency audit (`pip-audit`):** found and fixed multiple real CVEs in
`starlette` (FastAPI's core, directly in the request path) by upgrading
FastAPI `0.115.6 → 0.141.1` (pulls Starlette `1.6.0`) — confirmed via
`pip-audit` before/after, and the full test suite (57/57) re-verified live
afterward. Two specific CVEs checked in detail (BadHost host-header
injection, multipart-upload DoS) had low real exposure for this API
specifically (no host-based auth logic, no file-upload endpoints exist),
but were fixed anyway since that exposure changes the moment those features
get added. Remaining flagged packages (`pip`, `pytest`, `setuptools`) are
build/dev tooling only, never part of the running API's request path —
`setuptools` is deliberately pinned older for `pkg_resources` compatibility
with the blockchain dependencies (documented in `requirements-blockchain.txt`).

**Resolved since the original audit** (all real gaps, not sprint-scoped,
each with its own fix, tests, and live verification):
- **Rate limiting on `/analyze`** — added after we exhausted the real
  VirusTotal quota on ourselves during stress testing. Redis-backed
  (`app/core/rate_limit.py`) rather than in-memory, since Docker now runs
  multiple worker processes and an in-memory counter would let a client get
  roughly Nx the intended limit depending on which worker handled which
  request. Falls back to in-memory only when Redis isn't configured.
- **Authentication** — `/analyze` was fully open. `app/core/auth.py` adds an
  optional shared `X-API-Key` header check (constant-time comparison via
  `secrets.compare_digest`), disabled by default so local dev and the test
  suite keep working unauthenticated until `API_KEY` is actually set.
- **Docker defaulted to a single worker** even though stress testing proved
  4 workers gives roughly 4x the throughput for concurrent distinct URLs
  (single-worker concurrency was the real bottleneck, confirmed by direct
  A/B measurement, not guessed). `Dockerfile` now sets
  `WEB_CONCURRENCY=4` and passes `--workers` through explicitly.
- **Trailing dot in domains** (`example.com.`) was incorrectly rejected —
  the hand-rolled hostname regex didn't allow it.
- **IPv6 URLs** were incorrectly rejected for the same reason. Both fixed
  by validating IP hosts with Python's `ipaddress` module (handles v4 and
  v6 correctly) instead of extending the regex further, applied consistently
  in both request validation (`app/schemas/url.py`) and feature extraction
  (`app/services/orchestrator.py`'s `has_ip_address` signal, which was
  previously IPv4-only).
- **No TLS** — the dev server only ever served plain HTTP. Uvicorn now
  terminates TLS directly when given `--ssl-keyfile`/`--ssl-certfile`
  (locally or via the equivalent Docker Compose env vars); a self-signed
  dev cert can be generated with `scripts/generate_dev_cert.py`. Verified
  live: plain HTTP to the TLS port fails, `curl -k https://...` succeeds,
  and `curl https://...` (no `-k`) correctly fails certificate verification
  against the self-signed cert. A real deployment still needs a CA-issued
  certificate for a real domain — that can't be generated for `localhost`.

**Known, unaddressed gaps** (real, not sprint-scoped, worth knowing before
a production deployment):
- TLS is self-signed only for *local* Docker/Compose use — a real CA-issued
  cert genuinely can't be generated for `localhost`. Not an issue on Render
  specifically: it terminates TLS at its own edge/proxy in front of the
  container (real cert, automatic, even on the free tier and even on the
  shared `onrender.com` subdomain), so the container itself should stay
  plain HTTP there (leave `SSL_KEYFILE`/`SSL_CERTFILE` unset) — see
  "Deploying to Render" above.
- `BLOCKCHAIN_PRIVATE_KEY` lives in `.env` - fine for this project, a real
  deployment should pull it from a proper secrets manager (AWS KMS,
  HashiCorp Vault) instead.
- Real per-user accounts now exist (`/auth/register`, `/auth/login`, JWTs
  - see "User authentication" above), closing the "no real accounts" gap.
  What's still open: `/analyze` doesn't *require* a token by default (same
  optional-by-default pattern as `API_KEY`, not fixed here) - a real
  multi-tenant deployment would want a setting that makes auth mandatory
  rather than attribution-only; still no OAuth/social login (email+password
  only); and no token revocation before expiry (see "User authentication"
  above for why that's a deliberate tradeoff, not an oversight).
- **The ML model has a real, significant false-positive rate on legitimate
  domains it wasn't confidently trained on** - found via direct testing of
  `extract_ml_features()` + `MLClassifier.classify()` against 26 unusual
  URLs plus 15 ordinary well-known domains (2026-09-25), bypassing the HTTP
  layer to test the ML code paths specifically. Two distinct findings:
  - **Robustness (good news): 0 crashes across all 26 adversarial/unusual
    cases** - IDN/non-Latin-script domains, emoji, zero-width and RTL
    override characters, 200-char labels, 50-level subdomain chains,
    numeric-only domains, IPv6 literals, punycode. Feature extraction and
    classification never threw on any of them.
  - **Accuracy (real gap): every legitimate non-Latin-script domain tested
    (Cyrillic, Chinese, Arabic, Hindi, Japanese, German-umlaut) was flagged
    `malware` at 93-98% confidence**, and among 15 ordinary, well-known,
    unambiguously legitimate ASCII domains *not* on the `_TRUSTED_DOMAINS`
    allowlist, **5/15 (npmjs.com, shopify.com, notion.so, vercel.com,
    render.com) were also wrongly flagged malware** at 88-95% confidence.
    Root cause is the training data itself, not a code bug: the dataset
    skews toward a narrow slice of "obviously benign" patterns (mostly
    long-established, mostly-English, mostly-.com/.edu/.gov/.org sites),
    so anything structurally different - a non-Latin domain, an unusual
    but legitimate TLD, a newer SaaS-style short domain - reads as
    "unfamiliar" to the model, and the model already conflates "unfamiliar"
    with "malicious" for the small hardcoded allowlist's domains too (see
    the `google.com` finding that motivated `_TRUSTED_DOMAINS` in the first
    place, above). This is **not fixable by more code** - it needs a
    training set with substantially more diverse *legitimate* examples
    (non-English sites, newer domains, more TLDs), which isn't available
    right now. The allowlist is a real, working mitigation for the ~18
    sites on it, not a general solution - a project demo or report should
    be upfront that any domain outside that list carries a real chance of
    a false "malware" verdict, particularly non-English or less common
    TLDs.

**Resolved since the previous audit** (2026-09-25):
- Blockchain client used to trust the node's unlocked account instead of
  signing with a real private key locally — see "Real key signing" above.
- The Postgres schema existed but wasn't wired into the live `/analyze`
  request flow — see "Database migrations" above; analyses, threat-intel
  responses, and audit-log entries are all persisted now, with retry +
  dead-letter recovery for DB outages.
- No versioned DB migrations — see "Database migrations" above (Alembic).
- **Classification blocked the event loop under concurrent load** — found
  via real load testing (100-200 concurrent requests against the Docker
  build), not guessed. `classify()` (a synchronous, CPU-bound 4-model
  stacking-ensemble `predict_proba()` call) was invoked directly inside the
  async request handler, so its CPU time blocked *every other in-flight
  request* on that worker, not just its own. Measured before the fix:
  ~15-16 req/s ceiling regardless of concurrency, with a large fraction of
  requests timing out (30s+) once concurrency passed ~50. Fixed by
  offloading it via `asyncio.to_thread` in `orchestrator.py`'s `_compute()`
  (same pattern already used for DNS enrichment). Re-measured after:
  ~45 req/s at concurrency 50 (roughly 3x), 0 timeouts across 2,000 real
  requests at concurrencies 20/50/100/200. Regression test added
  (`test_slow_classification_does_not_block_other_requests` in
  `tests/test_orchestrator.py`) using a deliberately blocking fake
  classifier, so this can't silently regress.

**Extended outage testing (2026-09-25)** - stopped Redis, then Postgres,
for real (not mocked) while repeatedly hitting the live endpoint, since the
existing graceful-degradation claims had only ever been tested for a
single transient failure, not a sustained one. Found and fixed two real
gaps that only show up over an extended outage:
- **A configured-but-unreachable Redis crashed every `/analyze` request
  with a 500**, contradicting this project's own documented claim of
  graceful degradation. `core/rate_limit.py`'s docstring already *said*
  "falls back to in-memory... or Redis down", but the code never actually
  implemented that case - slowapi's `Limiter` only falls back when
  `in_memory_fallback_enabled` is explicitly set, and it wasn't. Stopping
  the Redis container reproduced it immediately: `redis.exceptions.
  ConnectionError` propagated uncaught out of the rate-limit check (no
  internals leaked to the client, per the earlier security work, but every
  request still failed). Fixed with slowapi's own built-in mechanism
  (`in_memory_fallback_enabled=True`) - verified live: stopped Redis,
  confirmed requests kept succeeding with a single "falling back to
  in-memory storage" warning logged, restarted Redis, confirmed shared
  rate limiting resumed. Regression test:
  `test_analyze_survives_rate_limit_storage_outage` in
  `tests/test_analyze_endpoint.py`.
- **A real Postgres outage made every request take ~20-25s**, not because
  of the retry+backoff design itself but because a single failed
  connection attempt was measured at ~7s (slow OS-level DNS-failure
  resolution in this environment, with no explicit timeout set) - times 3
  retry attempts, plus the existing backoff sleeps. Slow enough to trip
  reasonable client-side timeouts even though the server-side behavior was
  already technically correct (falls back to the dead-letter log, returns
  200). Fixed by adding an explicit `DB_CONNECT_TIMEOUT_SECONDS = 3` to
  `db/session.py`'s engine (`connect_args={"timeout": ...}`), bounding each
  attempt instead of relying on a slow OS default. Verified live:
  re-measured a real request during the same outage at ~15s (down from
  ~20-25s).
- **Separately, found the dead-letter safety net itself wasn't durable**:
  `docker-compose.yml`'s `backend` service had no volume for `data/` (only
  Postgres had a named volume), so a container restart during the exact
  outage the dead-letter log exists to survive would have silently
  discarded any not-yet-replayed records. Fixed by adding a
  `backend_data` volume. Verified live end-to-end: stopped Postgres, sent
  a request (wrote a dead-letter record), restarted the *backend*
  container (Postgres still down) and confirmed the record survived,
  restarted Postgres, ran `scripts/replay_dead_letter.py`, and confirmed
  the row landed in `url_analysis` and the dead-letter file was cleared.
  Not fixed on the Render free tier specifically - see `render.yaml` -
  free web services there don't support persistent disks at all, so this
  gap remains on that plan (paid Render plans do support it).
- VirusTotal/AbuseIPDB were already unavailable by default in this local
  setup (no API keys configured) - confirmed stable and non-crashing
  across repeated real requests, consistent with the existing composite
  threat-intel graceful-degradation design.

**Adversarial attack battery (`scripts/security_battery.py`, 2026-09-14):**
ran real SQL/NoSQL/command injection payloads, path traversal, CRLF header
injection, null bytes, SSRF-style URLs (localhost, cloud metadata IP,
internal hostnames), oversized/malformed JSON, and Unicode tricks against
the live endpoint. Found and fixed two serious bugs, not just theoretical
ones:

1. **A 100k-character URL and a 5MB JSON payload both crashed the server
   with a raw Python traceback returned to the client** — completely
   bypassing the "never leak internals" error handling built earlier. Root
   cause: `httpx.InvalidURL` (raised when base64-encoding an oversized URL
   for the VirusTotal request) is **not** a subclass of `httpx.RequestError`,
   so the retry logic's exception handler never caught it, and it
   propagated uncaught up the whole stack.
2. **The real reason it leaked a traceback instead of our own safe generic
   500: `DEBUG` defaulted to `True`.** That's a serious anti-pattern on its
   own, independent of the specific crash — a debug-mode default means
   *any* future unhandled exception, not just this one, would leak internals
   by default. Fixed to default `False`; opt into debug mode explicitly.

Fixed with three layers, not just one: (a) `DEBUG` now defaults to `False`,
(b) `httpx.InvalidURL` is now caught explicitly as a non-retryable failure,
(c) a `2048`-character max length on the `url` field rejects the input
before it ever reaches the point of crashing. Re-ran the full attack
battery afterward: **zero 500s, zero crashes, zero connection resets across
all 19 cases** — confirmed via server logs showing no exceptions at all,
not just checking HTTP status codes. SQL/command injection payloads and
SSRF-style URLs were already safe (no vulnerable sink exists for them
currently) and remain so.

## Roadmap (per project sprint plan)

- [x] Sprint 3.1 — FastAPI skeleton, config, CORS, base routing
- [x] Sprint 3.2 — URL validation & request/response schemas (due 30-09-2026)
- [x] Sprint 3.3 — Orchestration service (due 25-10-2026)
<<<<<<< HEAD
- [ ] Sprint 3.4 — Unified `/analyze` endpoint + integration tests (due 20-11-2026)
- [ ] Sprint 6.1 — VirusTotal / AbuseIPDB integration (due 15-12-2026)
- [ ] Sprint 6.2 — Redis caching layer (due 15-01-2027)
- [ ] Sprint 6.3 — PostgreSQL schema & indexing (due 10-02-2027)
- [ ] Sprint 6.4 — Blockchain audit logging + Docker + CI/CD (due 10-03-2027)
=======
- [x] Sprint 3.4 — Unified `/analyze` endpoint + integration tests (due 20-11-2026)
- [x] Sprint 6.1 — VirusTotal / AbuseIPDB integration (due 15-12-2026)
- [x] Sprint 6.2 — Redis caching layer (due 15-01-2027)
- [x] Sprint 6.3 — PostgreSQL schema & indexing (due 10-02-2027)
- [x] Sprint 6.4 — Blockchain audit logging + Docker + CI/CD (due 10-03-2027)

**Backend: 8/8 Sprint 3 & 6 tasks complete.**
>>>>>>> c21d9f7 (test: add backend tests and CI workflow)
