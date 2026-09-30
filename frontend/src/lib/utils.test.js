import { describe, expect, it } from 'vitest';
import { dailySeries, indicators, riskDistribution, summarize } from './analytics';
import { demoAnalyze } from './demoEngine';
import { scansToCsv } from './exporters';
import { normalizeAnalysis } from './normalize';
import { parseUrlList } from './urlList';

const make = (url, scannedAt) => {
  const response = demoAnalyze(url);
  if (scannedAt) response.evidence.analyzed_at = scannedAt;
  return normalizeAnalysis(response, { source: 'demo', submittedUrl: url });
};

describe('parseUrlList', () => {
  it('reads the first column, skips headers/comments/blank lines and dedupes', () => {
    const text = 'url,label\nhttps://a.com,benign\n\n# comment\n"https://b.com"\nhttps://A.com\nexample.org';
    expect(parseUrlList(text)).toEqual(['https://a.com', 'https://b.com', 'example.org']);
  });
});

describe('CSV export', () => {
  it('escapes quotes/commas and neutralises spreadsheet formulas', () => {
    const scan = { ...make('https://github.com'), url: '=HYPERLINK("http://evil.com","x")' };
    const csv = scansToCsv([scan]);
    const [header, row] = csv.split('\r\n');
    expect(header.startsWith('id,scanned_at,url')).toBe(true);
    expect(row).toContain(`"'=HYPERLINK(""http://evil.com"",""x"")"`);
  });
});

describe('analytics', () => {
  const scans = [
    make('https://github.com'),
    make('http://secure-paypa1-login.com/verify-account'),
    make('http://203.0.113.45:8080/files/invoice_2026.exe'),
    make('https://bit.ly/3xY7kQz'),
  ];

  it('summarizes verdicts and detection rate', () => {
    const stats = summarize(scans);
    expect(stats.total).toBe(4);
    expect(stats.threats).toBe(2);
    expect(stats.byVerdict).toMatchObject({ benign: 1, phishing: 1, malware: 1, suspicious: 1 });
    expect(stats.detectionRate).toBe(0.5);
  });

  it('buckets risk scores into the four levels', () => {
    const total = riskDistribution(scans).reduce((sum, level) => sum + level.count, 0);
    expect(total).toBe(4);
  });

  it('builds a zero-filled daily series', () => {
    const now = new Date('2026-09-30T12:00:00').getTime();
    const series = dailySeries([make('https://github.com', new Date('2026-09-29T09:00:00').toISOString())], 7, now);
    expect(series).toHaveLength(7);
    expect(series.at(-2).count).toBe(1);
    expect(series.at(-1).count).toBe(0);
    expect(series.at(-1).avgRisk).toBeNull();
  });

  it('extracts IOCs only from non-benign scans', () => {
    const iocs = indicators(scans);
    expect(iocs.some((ioc) => ioc.value === 'github.com')).toBe(false);
    expect(iocs.filter((ioc) => ioc.value === '203.0.113.45').map((ioc) => ioc.type)).toEqual(['ip']);
  });
});
