// Pure aggregations over scan history, shared by Dashboard, Reports and
// Threat Intel so every screen counts the same way.

import { RISK_LEVELS, VERDICT_ORDER, isThreat } from '../config/verdicts';
import { dayKey } from './format';

const DAY = 86400000;

export function filterByDays(scans, days, now = Date.now()) {
  if (!days) return scans;
  const since = now - days * DAY;
  return scans.filter((scan) => new Date(scan.scannedAt).getTime() >= since);
}

export function summarize(scans) {
  const byVerdict = Object.fromEntries(VERDICT_ORDER.map((key) => [key, 0]));
  let riskTotal = 0;
  for (const scan of scans) {
    byVerdict[scan.verdict] = (byVerdict[scan.verdict] ?? 0) + 1;
    riskTotal += scan.riskScore;
  }
  const threats = scans.filter((scan) => isThreat(scan.verdict)).length;
  return {
    total: scans.length,
    threats,
    byVerdict,
    avgRisk: scans.length ? Math.round(riskTotal / scans.length) : 0,
    detectionRate: scans.length ? threats / scans.length : 0,
  };
}

// Compares the last `days` window with the one before it.
export function periodDelta(scans, days, pick, now = Date.now()) {
  const current = scans.filter((s) => new Date(s.scannedAt).getTime() >= now - days * DAY);
  const previous = scans.filter((s) => {
    const t = new Date(s.scannedAt).getTime();
    return t < now - days * DAY && t >= now - 2 * days * DAY;
  });
  const a = pick(current);
  const b = pick(previous);
  if (!b) return null;
  return (a - b) / b;
}

export function dailySeries(scans, days, now = Date.now()) {
  const buckets = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(now - i * DAY);
    buckets.push({ key: dayKey(date), date, count: 0, threats: 0, riskTotal: 0 });
  }
  const index = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const scan of scans) {
    const bucket = index.get(dayKey(scan.scannedAt));
    if (!bucket) continue;
    bucket.count += 1;
    bucket.riskTotal += scan.riskScore;
    if (isThreat(scan.verdict)) bucket.threats += 1;
  }
  return buckets.map((bucket) => ({
    ...bucket,
    avgRisk: bucket.count ? Math.round(bucket.riskTotal / bucket.count) : null,
  }));
}

export function riskDistribution(scans) {
  return RISK_LEVELS.map((level) => ({
    ...level,
    count: scans.filter((scan) => scan.riskScore >= level.min && scan.riskScore <= level.max).length,
  }));
}

export function topSignals(scans, limit = 6) {
  const counts = new Map();
  for (const scan of scans) {
    for (const signal of scan.signals) {
      if (signal.weight <= 0) continue;
      const current = counts.get(signal.id) ?? { id: signal.id, label: signal.label.replace(/ "[^"]*"| \.[a-z0-9]+/gi, ''), count: 0 };
      current.count += 1;
      counts.set(signal.id, current);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

function tally(values, limit) {
  const counts = new Map();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function topCountries(scans, limit = 6) {
  return tally(scans.filter((s) => s.verdict !== 'benign').map((s) => s.ip?.country), limit);
}

export function topAsns(scans, limit = 6) {
  return tally(scans.filter((s) => s.verdict !== 'benign').map((s) => (s.ip?.asn ? `${s.ip.asn} · ${s.ip.org}` : null)), limit);
}

export function topTlds(scans, limit = 6) {
  return tally(scans.filter((s) => s.verdict !== 'benign').map((s) => (s.features?.tld ? `.${s.features.tld}` : null)), limit);
}

// Unique malicious/suspicious indicators (domains + IPs) for IOC export.
export function indicators(scans) {
  const map = new Map();
  for (const scan of scans) {
    if (scan.verdict === 'benign') continue;
    const ipHost = scan.features?.has_ip_address || /^[\d.]+$|^\[/.test(scan.hostname ?? '');
    const entries = [
      ['domain', ipHost ? null : scan.registrableDomain || scan.hostname],
      ['ip', scan.ip?.address || scan.dns?.ip_address],
    ];
    for (const [type, value] of entries) {
      if (!value) continue;
      const key = `${type}:${value}`;
      const current = map.get(key) ?? { type, value, verdict: scan.verdict, maxRisk: 0, hits: 0, lastSeen: scan.scannedAt };
      current.hits += 1;
      if (scan.riskScore > current.maxRisk) {
        current.maxRisk = scan.riskScore;
        current.verdict = scan.verdict;
      }
      if (scan.scannedAt > current.lastSeen) current.lastSeen = scan.scannedAt;
      map.set(key, current);
    }
  }
  return [...map.values()].sort((a, b) => b.maxRisk - a.maxRisk || b.hits - a.hits);
}
