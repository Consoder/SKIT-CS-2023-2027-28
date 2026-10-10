"""
Basic concurrency ramp-test against a running instance of the API.

Not a substitute for a real production load test (that needs the actual
deployed infra from Sprint 6). This measures the current FastAPI/Uvicorn
skeleton's ceiling on this machine, single worker, so we have an honest,
reproducible number instead of a guess.

Usage:
    uvicorn app.main:app --port 8010          # in one terminal
    python scripts/load_test.py               # in another
"""

import asyncio
import statistics
import sys
import time

import httpx

BASE_URL = "http://127.0.0.1:8070"
TARGET_PATH = "/api/v1/health"
CONCURRENCY_LEVELS = [10, 25, 50, 100, 200, 400]
REQUESTS_PER_LEVEL_MULTIPLIER = 10


async def _fire_one(client: httpx.AsyncClient) -> tuple[int | None, float | None]:
    start = time.perf_counter()
    try:
        response = await client.get(f"{BASE_URL}{TARGET_PATH}")
        return response.status_code, time.perf_counter() - start
    except Exception:
        return None, None


async def run_level(concurrency: int) -> None:
    total_requests = concurrency * REQUESTS_PER_LEVEL_MULTIPLIER
    semaphore = asyncio.Semaphore(concurrency)
    results: list[tuple[int | None, float | None]] = []

    # httpx defaults to max_connections=100 - without raising this, the CLIENT's
    # pool becomes the bottleneck above 100 concurrency, not the server. That
    # produced misleadingly bad multi-minute p99s before this fix.
    limits = httpx.Limits(max_connections=concurrency * 2, max_keepalive_connections=concurrency * 2)
    async with httpx.AsyncClient(timeout=10.0, limits=limits) as client:

        async def bound_call() -> None:
            async with semaphore:
                results.append(await _fire_one(client))

        start = time.perf_counter()
        await asyncio.gather(*[bound_call() for _ in range(total_requests)])
        wall_time = time.perf_counter() - start

    successes = [lat for status, lat in results if status == 200]
    failures = total_requests - len(successes)
    throughput = total_requests / wall_time if wall_time > 0 else 0.0

    print(f"\nConcurrency={concurrency}  Total requests={total_requests}")
    print(f"  Success: {len(successes)}  Failures: {failures}  ({failures / total_requests:.1%} error rate)")
    print(f"  Wall time: {wall_time:.2f}s  Throughput: {throughput:.1f} req/s")
    if successes:
        successes.sort()
        p50 = statistics.median(successes)
        p95 = successes[int(len(successes) * 0.95) - 1]
        p99 = successes[int(len(successes) * 0.99) - 1]
        print(f"  Latency p50: {p50 * 1000:.1f}ms  p95: {p95 * 1000:.1f}ms  p99: {p99 * 1000:.1f}ms")


async def main() -> None:
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            await client.get(f"{BASE_URL}{TARGET_PATH}")
        except Exception:
            print(f"Server not reachable at {BASE_URL} - start it first with uvicorn.")
            sys.exit(1)

    for concurrency in CONCURRENCY_LEVELS:
        await run_level(concurrency)


if __name__ == "__main__":
    asyncio.run(main())
