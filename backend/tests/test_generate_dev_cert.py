"""
Real gap found 2026-09-14, not part of any sprint task: the API only ever
served plain HTTP. Proves scripts/generate_dev_cert.py actually produces a
usable cert/key pair, not just that the script runs without raising.
"""

import shutil
import ssl
import subprocess

import pytest

from scripts.generate_dev_cert import generate

pytestmark = pytest.mark.skipif(shutil.which("openssl") is None, reason="requires the openssl CLI")


def test_generate_writes_a_key_and_cert_loadable_by_ssl(tmp_path) -> None:
    key_path, cert_path = generate(tmp_path)

    assert key_path.exists()
    assert cert_path.exists()

    # Real proof it's a usable TLS cert/key pair, not just two files with
    # PEM headers - this is the same loading Uvicorn does internally.
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=str(cert_path), keyfile=str(key_path))


def test_generate_cert_covers_localhost_and_127_0_0_1(tmp_path) -> None:
    _, cert_path = generate(tmp_path)

    result = subprocess.run(
        ["openssl", "x509", "-in", str(cert_path), "-noout", "-ext", "subjectAltName"],
        check=True,
        capture_output=True,
        text=True,
    )
    assert "DNS:localhost" in result.stdout
    assert "IP Address:127.0.0.1" in result.stdout
