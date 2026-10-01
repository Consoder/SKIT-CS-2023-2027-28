"""
Sprint 3, Task 3 (Orchestration service — due 25-10-2026): coverage for
PlaceholderClassifier, including the threat-intel keys the real
VirusTotal/AbuseIPDB client (Sprint 6, Task 1) will populate later.
"""

from app.services.orchestrator import PlaceholderClassifier


class TestPlaceholderClassifier:
    def setup_method(self):
        self.classifier = PlaceholderClassifier()

    def test_userinfo_disguise_is_phishing(self):
        verdict, score = self.classifier.classify({"has_userinfo": True}, {})
        assert verdict == "phishing"
        assert score == 85.0

    def test_ip_literal_is_suspicious(self):
        verdict, score = self.classifier.classify({"has_ip_address": True}, {})
        assert verdict == "suspicious"
        assert score == 60.0

    def test_punycode_is_suspicious(self):
        verdict, score = self.classifier.classify({"is_punycode": True}, {})
        assert verdict == "suspicious"
        assert score == 50.0

    def test_long_url_is_suspicious(self):
        verdict, score = self.classifier.classify({"url_length": 150}, {})
        assert verdict == "suspicious"
        assert score == 55.0

    def test_no_signals_is_benign(self):
        verdict, score = self.classifier.classify({"url_length": 20}, {})
        assert verdict == "benign"
        assert score == 5.0

    def test_threat_intel_malicious_vote_overrides_to_phishing(self):
        """
        Lexically clean URL (no local signals) but flagged by external
        threat intel - the classifier already reads the keys the real
        VirusTotal/AbuseIPDB client (Sprint 6, Task 1) will populate, so no
        change is needed here when that client replaces the placeholder.
        """
        verdict, score = self.classifier.classify(
            {"url_length": 20},
            {"virustotal": {"malicious_votes": 3}},
        )
        assert verdict == "phishing"
        assert score == 80.0

    def test_threat_intel_abuse_score_overrides_to_phishing(self):
        verdict, score = self.classifier.classify(
            {"url_length": 20},
            {"abuseipdb": {"abuse_confidence_score": 75}},
        )
        assert verdict == "phishing"
        assert score == 80.0
