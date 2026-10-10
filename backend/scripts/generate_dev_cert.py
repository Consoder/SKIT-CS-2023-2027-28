"""
Real gap found 2026-09-14, not in any sprint task: the API had no TLS at
all, plain HTTP only. A production deployment needs a certificate from a
real CA (Let's Encrypt, etc.) for a real domain - that can't be generated
here, there's no domain to issue one for. What CAN be fixed here is that
Uvicorn is capable of serving TLS directly and nothing wired that up, even
for local testing of the encrypted path itself.

This generates a self-signed cert/key for localhost + 127.0.0.1, good
enough to prove the server can actually terminate TLS (verified live by
starting Uvicorn with --ssl-keyfile/--ssl-certfile and hitting it with
curl -k). Shells out to the system `openssl` binary instead of adding a
new Python TLS dependency (e.g. `cryptography`) purely for a one-off
dev-only script.

Run: python scripts/generate_dev_cert.py
"""

import shutil
import subprocess
import sys
from pathlib import Path

DEFAULT_CERT_DIR = Path(__file__).resolve().parent.parent / "certs"


def generate(output_dir: Path) -> tuple[Path, Path]:
    """Writes dev-key.pem/dev-cert.pem into output_dir, returns (key_path, cert_path)."""
    if shutil.which("openssl") is None:
        raise RuntimeError("openssl not found on PATH - install it (Git for Windows bundles it) and retry.")

    output_dir.mkdir(parents=True, exist_ok=True)
    key_path = output_dir / "dev-key.pem"
    cert_path = output_dir / "dev-cert.pem"

    subprocess.run(
        [
            "openssl", "req", "-x509", "-newkey", "rsa:2048",
            "-keyout", str(key_path),
            "-out", str(cert_path),
            "-days", "365",
            "-nodes",
            "-subj", "/CN=localhost",
            "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1",
        ],
        check=True,
        capture_output=True,
    )
    return key_path, cert_path


def main() -> None:
    try:
        key_path, cert_path = generate(DEFAULT_CERT_DIR)
    except RuntimeError as exc:
        sys.exit(str(exc))

    print(f"\nWrote {cert_path} and {key_path}")
    print("Self-signed - dev/testing only. Real deployments need a CA-issued cert for a real domain.")
    print("Run with TLS: uvicorn app.main:app --ssl-keyfile certs/dev-key.pem --ssl-certfile certs/dev-cert.pem")


if __name__ == "__main__":
    main()
