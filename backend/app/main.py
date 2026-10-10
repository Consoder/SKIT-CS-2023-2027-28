"""
App factory. Sprint 3, Task 1 (skeleton, CORS, base routing — due 05-09-2026),
extended in Task 2 to register structured error handling (due 30-09-2026)
and in Task 4 to mount the /analyze endpoint (due 20-11-2026).

Thread pool size (perf fix, stress testing 2026-09-14): AbuseIPDB lookups
resolve hostnames via asyncio.to_thread(socket.gethostbyname, ...), which
runs on Python's *default* executor - sized for CPU-bound work
(min(32, cpu_count+4)). Under real concurrent load this saturated fast:
measured 30 concurrent distinct URLs taking 10+ seconds EACH, blowing
straight through the 2s threat-intel timeout, because asyncio.wait_for can
only stop *us* from waiting - it cannot stop an already-running blocking
DNS call, so new lookups just queued behind exhausted worker threads.
These are I/O-bound (blocked on network, not CPU), so a much larger pool
is correct and safe here, not just a magic-number bump.
"""

import asyncio
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.v1.api import api_router
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.core.rate_limit import limiter, rate_limit_exceeded_handler

settings = get_settings()
configure_logging(settings.LOG_LEVEL)

DNS_THREAD_POOL_SIZE = 100


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.get_running_loop().set_default_executor(ThreadPoolExecutor(max_workers=DNS_THREAD_POOL_SIZE))
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        debug=settings.DEBUG,
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)
    register_exception_handlers(app)

    return app


app = create_app()
