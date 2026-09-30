import { describe, expect, it } from 'vitest';
import { demoAnalyze } from './demoEngine';
import { extractFeatures, shannonEntropy, splitHost } from './features';
import { normalizeAnalysis } from './normalize';

describe('feature extraction (port of ml/src/features.py)', () => {
  it('computes Shannon entropy', () => {
    expect(shannonEntropy('')).toBe(0);
    expect(shannonEntropy('aaaa')).toBe(0);
    expect(shannonEntropy('ab')).toBeCloseTo(1);
  });

  it('splits registrable domains, including multi-part TLDs', () => {
    expect(splitHost('login.secure.example.co.uk')).toMatchObject({ registrable: 'example.co.uk', sld: 'example', subdomains: ['login', 'secure'] });
    expect(splitHost('www.github.com')).toMatchObject({ registrable: 'github.com', tld: 'com' });
  });

  it('extracts lexical and host features', () => {
    const { raw } = extractFeatures('http://user@198.51.100.7:8080/a//b?x=1&y=2');
    expect(raw.has_ip_address).toBe(true);
    expect(raw.at_symbol_count).toBe(1);
    expect(raw.has_unusual_port).toBe(true);
    expect(raw.double_slash_in_path).toBe(true);
    expect(raw.num_query_params).toBe(2);
    expect(raw.has_https).toBe(false);
  });

  it('flags suspicious TLDs, shorteners and punycode', () => {
    expect(extractFeatures('http://free-prize.tk/').raw.has_suspicious_tld).toBe(true);
    expect(extractFeatures('https://bit.ly/abc').raw.is_shortener).toBe(true);
    expect(extractFeatures('https://xn--pypal-4ve.com/').raw.has_punycode).toBe(true);
  });

  it('returns null for an unparseable URL', () => {
    expect(extractFeatures('http://')).toBeNull();
  });
});

describe('demo engine', () => {
  it('matches the backend response shape', () => {
    const response = demoAnalyze('https://github.com');
    expect(Object.keys(response)).toEqual(['url', 'verdict', 'risk_score', 'evidence']);
    expect(['benign', 'suspicious', 'phishing', 'malware']).toContain(response.verdict);
    expect(response.risk_score).toBeGreaterThanOrEqual(0);
    expect(response.risk_score).toBeLessThanOrEqual(100);
  });

  it('classifies well-known domains as benign', () => {
    for (const url of ['https://github.com/features', 'https://www.google.com/search?q=login', 'https://accounts.google.com/signin']) {
      expect(demoAnalyze(url).verdict).toBe('benign');
    }
  });

  it('detects typo-squatted brand phishing', () => {
    const response = demoAnalyze('http://secure-paypa1-login.com/verify-account');
    expect(response.verdict).toBe('phishing');
    expect(response.risk_score).toBeGreaterThanOrEqual(75);
    expect(response.evidence.signals.map((s) => s.id)).toContain('brand_impersonation');
  });

  it('detects executable downloads from raw IPs as malware', () => {
    expect(demoAnalyze('http://203.0.113.45:8080/files/invoice_2026.exe').verdict).toBe('malware');
  });

  it('marks shortened links as suspicious rather than benign', () => {
    expect(demoAnalyze('https://bit.ly/3xY7kQz').verdict).not.toBe('benign');
  });

  it('does not treat a brand as a substring of an unrelated word', () => {
    const response = demoAnalyze('https://www.purchase-orders.example.org/');
    expect(response.evidence.signals.map((s) => s.id)).not.toContain('brand_impersonation');
  });

  it('flags DGA-like domains but not ordinary hyphenated ones', () => {
    const ids = (url) => demoAnalyze(url).evidence.signals.map((s) => s.id);
    expect(ids('http://cdn-qx7v9kz2wpl.top/payload/stage2.bin')).toContain('random_domain');
    expect(ids('http://secure-paypa1-login.com/verify-account')).not.toContain('random_domain');
    expect(ids('https://blog.acme-widgets.io/release-notes')).not.toContain('random_domain');
  });

  it('is deterministic for simulated intel', () => {
    const a = demoAnalyze('http://netflix-billing-update.ga/account');
    const b = demoAnalyze('http://netflix-billing-update.ga/account');
    expect(a.evidence.ip).toEqual(b.evidence.ip);
    expect(a.evidence.threat_intel).toEqual(b.evidence.threat_intel);
  });
});

describe('normalizeAnalysis', () => {
  it('tolerates the minimal backend response (no evidence)', () => {
    const scan = normalizeAnalysis({ url: 'http://x.example.com', verdict: 'Phishing', risk_score: 88.6 }, { source: 'live' });
    expect(scan).toMatchObject({ verdict: 'phishing', riskScore: 89, riskLevel: 'critical', hostname: 'x.example.com', features: null, dns: null, threatIntel: null });
    expect(scan.signals).toEqual([]);
    expect(scan.id).toBeTruthy();
  });

  it('clamps out-of-range scores', () => {
    expect(normalizeAnalysis({ url: 'http://a.com', verdict: 'benign', risk_score: 140 }).riskScore).toBe(100);
    expect(normalizeAnalysis({ url: 'http://a.com', verdict: 'benign', risk_score: -3 }).riskScore).toBe(0);
  });
});
