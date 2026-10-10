"""
Stress test for the real /analyze endpoint - real threat-intel calls (real
VirusTotal/AbuseIPDB API keys), real Redis caching, ramping concurrency.
Not part of the automated test suite - a one-time verification tool.

Usage:
    uvicorn app.main:app --port 8000   # in one terminal, with real .env
    python scripts/stress_test_analyze.py
"""

import asyncio
import statistics
import time

import httpx

BASE_URL = "http://127.0.0.1:8000"
ANALYZE_PATH = "/api/v1/analyze"

# A small pool of distinct URLs, repeated across requests - this exercises
# both cache hits (repeat lookups) and real external API calls (first
# lookup of each), which is what real traffic actually looks like.
URL_POOL = [
    "https://wikipedia.org",
    "https://github.com",
    "https://python.org",
    "http://192.168.1.1/admin",
    "https://suspicious-test-domain-xyz123.example",
]

CONCURRENCY_LEVELS = [10, 25, 50]
REQUESTS_PER_LEVEL_MULTIPLIER = 6


async def _fire_one(client: httpx.AsyncClient, url: str) -> tuple[int | None, float | None, str | None]:
    start = time.perf_counter()
    try:
        response = await client.post(ANALYZE_PATH, json={"url": url})
        elapsed = time.perf_counter() - start
        verdict = response.json().get("verdict") if response.status_code == 200 else None
        return response.status_code, elapsed, verdict
    except Exception:
        return None, None, None


async def run_level(concurrency: int) -> None:
    total_requests = concurrency * REQUESTS_PER_LEVEL_MULTIPLIER
    semaphore = asyncio.Semaphore(concurrency)
    results: list[tuple[int | None, float | None, str | None]] = []

    limits = httpx.Limits(max_connections=concurrency * 2, max_keepalive_connections=concurrency * 2)
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0, limits=limits) as client:

        async def bound_call(i: int) -> None:
            async with semaphore:
                url = URL_POOL[i % len(URL_POOL)]
                results.append(await _fire_one(client, url))

        start = time.perf_counter()
        await asyncio.gather(*[bound_call(i) for i in range(total_requests)])
        wall_time = time.perf_counter() - start

    successes = [(status, lat, verdict) for status, lat, verdict in results if status == 200]
    server_errors = [r for r in results if r[0] is not None and r[0] >= 500]
    other_failures = total_requests - len(successes) - len(server_errors)
    latencies = sorted(lat for _, lat, _ in successes)

    print(f"\nConcurrency={concurrency}  Total requests={total_requests}")
    print(f"  2xx success: {len(successes)}  5xx (real bugs): {len(server_errors)}  other/timeout: {other_failures}")
    print(f"  Wall time: {wall_time:.2f}s  Throughput: {total_requests / wall_time:.1f} req/s")
    if latencies:
        p50 = statistics.median(latencies)
        p95 = latencies[int(len(latencies) * 0.95) - 1]
        p99 = latencies[int(len(latencies) * 0.99) - 1]
        print(f"  Latency p50: {p50 * 1000:.1f}ms  p95: {p95 * 1000:.1f}ms  p99: {p99 * 1000:.1f}ms")
    if server_errors:
        print(f"  !! {len(server_errors)} real server errors (5xx) - this is a genuine bug, not expected")


async def main() -> None:
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=5.0) as client:
        try:
            await client.get("/api/v1/health")
        except Exception:
            print(f"Server not reachable at {BASE_URL} - start it first.")
            return

    for concurrency in CONCURRENCY_LEVELS:
        await run_level(concurrency)


if __name__ == "__main__":
    asyncio.run(main())
