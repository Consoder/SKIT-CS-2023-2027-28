# Sprint 6, Task 4 (Docker + CI/CD — due 10-03-2027).
FROM python:3.12-slim

WORKDIR /app

# Real deployment bug found 2026-09-25 (Render deployment prep): python:*-slim
# doesn't ship libgomp (GNU OpenMP runtime) - LightGBM's native binary
# needs it and fails at import time with "OSError: libgomp.so.1: cannot
# open shared object file", which only ever surfaced once the app actually
# tried to load the model in a real container, not in local venv testing.
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements-blockchain.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir --no-deps -r requirements-blockchain.txt

COPY app ./app
COPY contracts ./contracts

EXPOSE 8000

# Real, measured fix (2026-09-14): 1 worker (the old default) took
# 5.4-6.6s for 30 concurrent never-cached URLs; 4 workers took 1.2-2.3s -
# roughly matching the worker count. Single-worker deployment was never a
# deliberate choice, just an unset default. Configurable via WEB_CONCURRENCY
# so the real deployment target's CPU count can tune it without a rebuild.
ENV WEB_CONCURRENCY=4
# "exec" replaces the shell process with uvicorn (via the exec syscall)
# instead of running it as a child - without this, SIGTERM on container
# stop goes to the shell, not uvicorn, delaying graceful shutdown until
# Docker gives up and SIGKILLs it.
#
# TLS (real gap found 2026-09-14, not in any sprint task): the API only
# ever served plain HTTP. Uvicorn terminates TLS itself when given a
# cert/key, so if SSL_KEYFILE/SSL_CERTFILE are set (mount them in via
# docker-compose), they're passed straight through; otherwise this behaves
# exactly as before - plain HTTP, same as today's default. On a PaaS like
# Render, TLS is terminated at their edge/proxy instead - the container
# should stay plain HTTP internally there (leave SSL_KEYFILE/CERTFILE
# unset), which is exactly what happens by default.
#
# PORT (Render deployment prep, 2026-09-25): PaaS platforms like Render
# assign the listen port at runtime via $PORT and route traffic to
# whatever that is - a hardcoded 8000 would silently not receive any
# traffic there. Defaults to 8000 so local `docker run`/docker-compose
# (which don't set PORT) behave exactly as before.
ENV PORT=8000
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers ${WEB_CONCURRENCY} ${SSL_KEYFILE:+--ssl-keyfile \"$SSL_KEYFILE\" --ssl-certfile \"$SSL_CERTFILE\"}"]
