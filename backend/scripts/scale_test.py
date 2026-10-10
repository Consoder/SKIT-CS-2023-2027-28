"""One-off: ramp concurrency of brand-new distinct URLs against a running
container to find where it actually starts to degrade. Not part of the
automated test suite."""

import asyncio
import statistics
import sys
import time

import httpx

BASE_URL = "http://127.0.0.1:8500"


async def timed_request(client: httpx.AsyncClient, tag: str, i: int) -> tuple[float, int]:
    url = f"https://scale-test-{tag}-{i}.example.org"
    start = time.perf_counter()
    r = await client.post("/api/v1/analyze", json={"url": url})
    return time.perf_counter() - start, r.status_code


async def run_level(concurrency: int) -> None:
    limits = httpx.Limits(max_connections=concurrency * 2, max_keepalive_connections=concurrency * 2)
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=60.0, limits=limits) as client:
        start = time.perf_counter()
        results = await asyncio.gather(*[timed_request(client, str(concurrency), i) for i in range(concurrency)])
        wall = time.perf_counter() - start

    times = sorted(t for t, status in results)
    errors = sum(1 for _, status in results if status != 200)
    p50 = statistics.median(times)
    p95 = times[int(len(times) * 0.95) - 1]
    p99 = times[int(len(times) * 0.99) - 1]
    print(f"Concurrency={concurrency}  wall={wall:.2f}s  errors={errors}  p50={p50:.2f}s  p95={p95:.2f}s  p99={p99:.2f}s  max={times[-1]:.2f}s")


async def main() -> None:
    for concurrency in [300, 500, 800]:
        await run_level(concurrency)


if __name__ == "__main__":
    asyncio.run(main())
