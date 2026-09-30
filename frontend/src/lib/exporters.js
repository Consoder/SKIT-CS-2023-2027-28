// CSV / JSON downloads and PDF (via the browser's print → "Save as PDF").

import { getVerdict } from '../config/verdicts';

const CSV_COLUMNS = [
  ['id', (scan) => scan.id],
  ['scanned_at', (scan) => scan.scannedAt],
  ['url', (scan) => scan.url],
  ['hostname', (scan) => scan.hostname],
  ['verdict', (scan) => getVerdict(scan.verdict).label],
  ['risk_score', (scan) => scan.riskScore],
  ['risk_level', (scan) => scan.riskLevel],
  ['confidence', (scan) => scan.confidence ?? ''],
  ['ip_address', (scan) => scan.ip?.address ?? scan.dns?.ip_address ?? ''],
  ['country', (scan) => scan.ip?.country ?? ''],
  ['asn', (scan) => scan.ip?.asn ?? ''],
  ['domain_age_days', (scan) => scan.whois?.domain_age_days ?? ''],
  ['virustotal_malicious', (scan) => scan.threatIntel?.virustotal?.malicious ?? ''],
  ['virustotal_total', (scan) => scan.threatIntel?.virustotal?.total ?? ''],
  ['abuseipdb_score', (scan) => scan.threatIntel?.abuseipdb?.abuse_confidence_score ?? ''],
  ['top_signals', (scan) => scan.signals.filter((s) => s.weight > 0).slice(0, 3).map((s) => s.label).join('; ')],
  ['audit_hash', (scan) => scan.ledger?.hash ?? ''],
  ['source', (scan) => scan.source],
];

function escapeCsv(value) {
  const text = String(value ?? '');
  // Neutralise spreadsheet formula injection (=, +, -, @ at the start).
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function scansToCsv(scans) {
  const header = CSV_COLUMNS.map(([name]) => name).join(',');
  const rows = scans.map((scan) => CSV_COLUMNS.map(([, get]) => escapeCsv(get(scan))).join(','));
  return [header, ...rows].join('\r\n');
}

export function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function stamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

export function exportCsv(scans, name = 'urlshield-scans') {
  // BOM so Excel opens UTF-8 correctly.
  downloadFile(`${name}-${stamp()}.csv`, `﻿${scansToCsv(scans)}`, 'text/csv;charset=utf-8');
}

export function exportJson(data, name = 'urlshield-scans') {
  downloadFile(`${name}-${stamp()}.json`, JSON.stringify(data, null, 2), 'application/json');
}

// Prints only the element marked `.print-area` (see index.css @media print).
export function exportPdf(title) {
  const previous = document.title;
  if (title) document.title = title;
  window.print();
  document.title = previous;
}
