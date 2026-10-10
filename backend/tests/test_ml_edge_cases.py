"""
Direct tests of the ML pipeline (feature extraction + classifier) against
unusual/adversarial URLs, bypassing the HTTP layer and URL-schema
validation (already covered by scripts/security_battery.py) to test the ML
code paths specifically.

Skipped when the real model files aren't present (they're ~120MB and not
committed to git as of 2026-09-25 - see README.md "Deploying to Render").
"""

import pytest

from app.services.ml_classifier import MODEL_DIR

pytestmark = pytest.mark.skipif(
    not (MODEL_DIR / "stacking_ensemble_4model.pkl").exists(),
    reason="real model files not present locally",
)


@pytest.fixture(scope="module")
def classifier():
    from app.services.ml_classifier import MLClassifier

    return MLClassifier()


REALISTIC_THREAT_INTEL = {
    "source": "virustotal+abuseipdb",
    "is_resolvable": True,
    "has_a_record": True,
    "has_aaaa_record": False,
    "has_mx_record": False,
    "resolves_to_private_ip": False,
    "virustotal": {"available": True, "malicious_votes": 0, "suspicious_votes": 0},
    "abuseipdb": {"available": True, "abuse_confidence_score": 0},
}

# Real, unusual/adversarial inputs found via manual testing 2026-09-25 to
# never crash feature extraction or classification - see README.md "Known,
# unaddressed gaps" for the separate (and more serious) accuracy finding
# from the same testing pass: many of these legitimate-domain cases are
# flagged "malware" by the model itself, which is a real gap, not a crash.
# This test only asserts the pipeline stays up, not that every verdict is
# correct - that's a training-data problem, not a code bug (see README).
UNUSUAL_URLS = [
    "https://яндекс.рф/search",  # Cyrillic domain
    "https://百度.中国/",  # Chinese domain
    "https://موقع.مصر/",  # Arabic domain
    "https://उदाहरण.भारत/page",  # Devanagari domain
    "https://münchen.de/",  # German umlaut
    "https://xn--80akhbyknj4f.xn--p1ai/",  # already-punycode
    "https://xn--pple-43d.com/verify",  # punycode phishing disguise
    "https://\U0001f355.ws/",  # emoji domain
    "https://example.com/path/\U0001f525\U0001f525\U0001f525",  # emoji in path
    "https://exa​mple.com/",  # zero-width space in domain
    "https://example.com/‮evil",  # RTL override
    "https://" + ("a" * 200) + ".com/",  # very long label
    "https://" + ("sub." * 50) + "example.com/",  # 50-level subdomain chain
    "https://12345.67890/",  # numeric-only domain
    "https://a.co/",  # single-character domain
    "https://user:pass@example.com/p?q=1#frag",  # userinfo + query + fragment
    "https://[2001:db8::1]/path",  # IPv6 literal
    "https://example.com./path",  # trailing-dot FQDN
    "https://my_site.example.com/",  # underscore in domain
]


@pytest.mark.parametrize("url", UNUSUAL_URLS)
def test_unusual_url_does_not_crash_the_ml_pipeline(classifier, url):
    from app.services.ml_features import extract_ml_features

    features = extract_ml_features(url)
    verdict, risk_score = classifier.classify(features, REALISTIC_THREAT_INTEL)

    assert verdict in ("benign", "phishing", "malware", "suspicious")
    assert 0.0 <= risk_score <= 100.0


def test_trusted_allowlist_domains_are_always_benign(classifier):
    from app.services.ml_features import extract_ml_features

    for domain in ("google.com", "github.com", "wikipedia.org"):
        features = extract_ml_features(f"https://{domain}/")
        verdict, risk_score = classifier.classify(features, REALISTIC_THREAT_INTEL)
        assert verdict == "benign"
        assert risk_score == 2.0
