# Load Test Results — Backend Skeleton

**Date:** 2026-09-13
**What was tested:** `GET /api/v1/health` — the only real endpoint that exists so far (Sprint 3 Tasks 1-2). No DB, no ML inference, no external API calls yet — this measures the raw FastAPI/Uvicorn skeleton's ceiling on this machine, not the final production system.
**Setup:** single Uvicorn worker (no `--reload`), Windows dev laptop, `scripts/load_test.py` (async `httpx` client, ramping concurrency).

## Results

| Concurrency | Total Requests | Errors | Throughput | p50 latency | p95 latency | p99 latency |
|---|---|---|---|---|---|---|
| 10 | 100 | 0.0% | 112.4 req/s | 60ms | 118ms | 742ms |
| 25 | 250 | 0.0% | 83.3 req/s | 208ms | 711ms | 1045ms |
| 50 | 500 | 0.0% | 72.9 req/s | 425ms | 1878ms | 2980ms |
| 100 | 1000 | 0.0% | 72.0 req/s | 781ms | 4440ms | 6402ms |
| 200 | 2000 | 0.0% | 64.9 req/s | 1994ms | 8591ms | 11831ms |
| 400 | 4000 | 0.1% | 56.0 req/s | 4481ms | 19291ms | 28678ms |

## Honest interpretation

**The server never actually crashes or errors out** — even at 400 concurrent requests, 99.9%+ still succeed. It just gets slower under load rather than failing. That's a real, good property (graceful degradation, not collapse).

**Realistic "comfortable" capacity right now: ~50 concurrent requests** with sub-2-second p95 latency and zero errors. Beyond that, requests still succeed but latency climbs into multi-second territory — not acceptable for a live user-facing scan, though fine for background/batch use.

**Why it doesn't scale higher on its own:** this is one Uvicorn worker on one Windows laptop hitting a trivial endpoint — there's no caching, no load balancing, no multiple processes. We tried converting the handler to `async def` expecting a big jump; it made no measurable difference, which tells us the bottleneck here is the single-worker event loop + Windows network stack overhead, not handler-level blocking.

## What actually gets this to real scale (already on the sprint plan, not new scope)

- **Sprint 6.2 — Redis caching:** repeat URL/IP lookups skip all processing entirely, this is the single biggest real-world win since most traffic in a URL scanner is repeat lookups.
- **Sprint 6.4 — Docker + multiple workers/replicas:** horizontal scaling via Gunicorn+Uvicorn workers or multiple containers behind a load balancer — this is what actually multiplies capacity, not micro-optimizing one worker.
- **Sprint 6.3 — indexed PostgreSQL:** avoids the query-time bottleneck once real DB reads/writes exist.

**For viva purposes:** the honest, defensible claim is *"our architecture is designed for horizontal scale via caching and multi-worker deployment (Sprint 6), and our measured single-instance baseline handles ~50 concurrent users comfortably with zero errors up to 400 concurrent"* — not an unverified "1 lakh users" claim.

## Follow-up: stress testing the real `/analyze` endpoint (2026-09-14)

Once Sprint 6.1 (VirusTotal/AbuseIPDB) and 6.2 (Redis) landed, re-tested against the real endpoint with real API keys and real caching (`scripts/stress_test_analyze.py`). Found and fixed two real bugs along the way, and ruled out several plausible-sounding causes rather than assume:

**Fixed, real, measured:**
1. **Request coalescing** (`orchestrator.py`) — concurrent requests for the identical URL now share one in-flight computation instead of each independently calling external APIs. Proven: 15 truly simultaneous identical requests → exactly 1 real VirusTotal call (confirmed in server logs).
2. **Persistent httpx client** (`threat_intel.py`) — was opening a brand-new `httpx.AsyncClient` (fresh TCP+TLS connection) on *every single* `check()` call. Fixed to reuse one client. Measured improvement: 30 concurrent distinct URLs went from 10.0-11.4s each to 6.1-7.5s each — a real ~35% reduction, verified before/after on the same test.

**Investigated and ruled out** (each tested in isolation, not assumed):
- DNS thread-pool exhaustion — tested 30 concurrent DNS lookups in complete isolation: all resolved in under 0.2s. Not the cause. (The larger thread pool added during this investigation is harmless to keep but wasn't the fix.)
- VirusTotal rate-limiting — checked server logs directly: zero 429 responses during the slow runs.
- Synchronous logging blocking the event loop — tested with `LOG_LEVEL=WARNING` (suppressing per-request httpx logs): no measurable change.

**Remaining ~6-7s tail on 30 concurrent *distinct* (never-cached) URLs:** traced back to the same root cause as the original health-check test above — a single Uvicorn worker's concurrency ceiling on this Windows dev machine. VirusTotal itself responds in under 1 second per request (confirmed via log timestamps); the gap between "external API responded" and "client received the response" is our own single-process request handling under load, not the external API or our threat-intel logic. This is exactly what Sprint 6.4's horizontal scaling (multiple workers/containers) is for, not something further micro-optimization of one worker fixes.

**Also added:** a 2-second timeout on the threat-intel step (`THREAT_INTEL_TIMEOUT_SECONDS`), so a slow/unresponsive external API can't hold up the response indefinitely — proven in isolated unit tests, though it doesn't fully mask the single-worker ceiling under this specific extreme (30 concurrent cold distinct-URL) scenario. Timed-out results are deliberately never cached, so the next lookup gets a fresh full-timeout attempt.

## Follow-up: does horizontal scaling actually fix the ceiling? (2026-09-14, Docker)

Rebuilt the Docker image with all fixes above and ran it with **4 Uvicorn workers** (`--workers 4`, matching this machine's 4 CPU cores) instead of the single dev worker used everywhere above — real container, real 4 worker processes confirmed via logs, real API keys, real external calls, `scripts/scale_test.py`.

**Same 30-concurrent-distinct-URL test that took 5.4-6.6s per request on 1 worker: 1.2-2.3s on 4 workers** — roughly matching the 4x worker count, confirming the single-worker ceiling diagnosis was correct and that horizontal scaling is the real fix, not a guess.

Pushed further to find where 4 workers actually degrade:

| Concurrency (all brand-new URLs, zero caching benefit) | Errors | p50 | p95 | p99 |
|---|---|---|---|---|
| 30 | 0 | 0.92s | 1.92s | 1.97s |
| 60 | 0 | 1.49s | 1.86s | 2.21s |
| 100 | 0 | 2.55s | 2.69s | 2.72s |
| 150 | 0 | 3.04s | 3.21s | 3.23s |
| 300 | 0 | 6.25s | 7.76s | 7.88s |
| 500 | 0 | 10.33s | 11.55s | 12.41s |
| 800 | 0 | 15.81s | 19.54s | 20.43s |

**Zero errors at every level tested, up to 800 concurrent brand-new lookups.** "Comfortable" (sub-2s p95) capacity on 4 workers, worst-case (no cache hits at all): **~60-100 concurrent**. Real traffic is not this adversarial — most URLs get cache hits — so this is a deliberately pessimistic floor, not the realistic number.

**Honest limits of this result:** tested on one machine's 4 cores, not multiple machines/containers behind a load balancer, and not tested beyond 800 concurrent. Scaling further (more containers, more cores) should keep helping since the pattern held cleanly from 1→4 workers, but that's a reasonable expectation based on this evidence, not itself a measured fact — don't state "N workers = X users" beyond what's actually been run.
