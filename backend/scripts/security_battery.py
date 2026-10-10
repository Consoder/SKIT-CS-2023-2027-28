"""
Adversarial security test battery against the live /analyze endpoint.
One-off script, not part of the automated test suite. Authorized testing
of our own system.

Usage:
    uvicorn app.main:app --port 8000
    python scripts/security_battery.py
"""

import time

import httpx

BASE_URL = "http://127.0.0.1:8000"

CASES: list[tuple[str, dict | str, dict]] = [
    # (label, json_body_or_raw, extra_kwargs)
    ("SQL injection in url", {"url": "http://example.com/'; DROP TABLE users;--"}, {}),
    ("SQL injection classic OR 1=1", {"url": "http://example.com/?id=1' OR '1'='1"}, {}),
    ("NoSQL injection ($ne)", {"url": {"$ne": None}}, {}),
    ("Command injection semicolon", {"url": "http://example.com/; rm -rf /"}, {}),
    ("Command injection backtick", {"url": "http://example.com/`whoami`"}, {}),
    ("Command injection $(...)", {"url": "http://example.com/$(cat /etc/passwd)"}, {}),
    ("Path traversal", {"url": "http://example.com/../../../../etc/passwd"}, {}),
    ("CRLF header injection attempt", {"url": "http://example.com/\r\nSet-Cookie: pwned=1"}, {}),
    ("Null byte injection", {"url": "http://example.com/\x00.jpg"}, {}),
    ("SSRF - localhost", {"url": "http://127.0.0.1:8000/api/v1/health"}, {}),
    ("SSRF - cloud metadata IP", {"url": "http://169.254.169.254/latest/meta-data/"}, {}),
    ("SSRF - internal hostname", {"url": "http://internal.local/admin"}, {}),
    ("Extremely long URL (100k chars)", {"url": "http://example.com/" + ("a" * 100_000)}, {}),
    ("Deeply nested JSON", {"url": {"a": {"a": {"a": {"a": {"a": "deep"}}}}}}, {}),
    ("Array instead of string", {"url": ["http://example.com"]}, {}),
    ("Unicode RTL override trick", {"url": "http://example.com/‮gnp.exe"}, {}),
    ("Zero-width space in domain", {"url": "http://exa​mple.com"}, {}),
    ("Massive JSON payload (5MB string)", {"url": "http://example.com/" + ("x" * 5_000_000)}, {}),
    ("Extra unexpected fields", {"url": "http://example.com", "admin": True, "__proto__": {}}, {}),
]


def run_case(client: httpx.Client, label: str, body, kwargs: dict) -> None:
    start = time.perf_counter()
    try:
        response = client.post("/api/v1/analyze", json=body, timeout=10.0, **kwargs)
        elapsed = time.perf_counter() - start
        status = response.status_code
        # Flag anything that looks like a real problem
        flag = ""
        if status >= 500:
            flag = "  !!! SERVER ERROR (real bug)"
        elif elapsed > 5.0:
            flag = f"  !!! SLOW ({elapsed:.1f}s - possible DoS vector)"
        body_preview = response.text[:150].replace("\n", " ")
        print(f"[{status}] {elapsed:5.2f}s  {label}{flag}")
        if status >= 500:
            print(f"       body: {body_preview}")
    except httpx.TimeoutException:
        print(f"[TIMEOUT] >10s  {label}  !!! HANG (real DoS vector)")
    except Exception as exc:
        print(f"[EXCEPTION] {label}: {type(exc).__name__}: {exc}")


def main() -> None:
    with httpx.Client(base_url=BASE_URL) as client:
        for label, body, kwargs in CASES:
            run_case(client, label, body, kwargs)


if __name__ == "__main__":
    main()
