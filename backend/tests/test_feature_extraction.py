"""
Sprint 3, Task 3 (Orchestration service — due 25-10-2026): coverage for
PlaceholderFeatureExtractor, including the adversarial edge cases found
via edge-case testing 2026-09-14 (userinfo disguise, punycode homograph).
"""

from app.services.orchestrator import PlaceholderFeatureExtractor


class TestPlaceholderFeatureExtractor:
    def setup_method(self):
        self.extractor = PlaceholderFeatureExtractor()

    def test_benign_url_has_no_signals(self):
        features = self.extractor.extract("https://example.com/page")
        assert features["has_ip_address"] is False
        assert features["has_userinfo"] is False
        assert features["is_punycode"] is False
        assert features["subdomain_count"] == 0

    def test_subdomain_count(self):
        features = self.extractor.extract("https://a.b.example.com/page")
        assert features["subdomain_count"] == 2

    def test_ip_literal_host_detected(self):
        features = self.extractor.extract("http://192.168.1.1/login")
        assert features["has_ip_address"] is True

    def test_ipv6_literal_host_detected(self):
        features = self.extractor.extract("http://[2001:db8::1]/login")
        assert features["has_ip_address"] is True

    def test_userinfo_disguise_detected(self):
        """
        Real bug found via edge-case testing 2026-09-14: the disguise
        pattern "http://realsite.com@evil.com/" must resolve to evil.com
        as the host, not realsite.com.
        """
        features = self.extractor.extract("http://google.com@evil.com/login")
        assert features["has_userinfo"] is True

    def test_punycode_homograph_detected(self):
        """
        Real gap found via edge-case testing 2026-09-14: punycode-encoded
        homograph domains (e.g. a Cyrillic lookalike for "apple.com") had
        zero signal before this check existed.
        """
        features = self.extractor.extract("http://xn--pple-43d.com/login")
        assert features["is_punycode"] is True

    def test_long_url_length_recorded(self):
        long_url = "https://example.com/" + "a" * 200
        features = self.extractor.extract(long_url)
        assert features["url_length"] == len(long_url)
