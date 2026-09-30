// Turns an /analyze response (live backend or demo engine — same shape) into
// the "scan" object every screen renders. Everything under `evidence` is
// optional: the backend currently only guarantees url / verdict / risk_score
// (backend/app/schemas/analysis.py), so each section degrades to `null` and
// the UI shows "Not available" instead of crashing.

import { getRiskLevel } from '../config/verdicts';

function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function normalizeAnalysis(response, { source = 'live', submittedUrl } = {}) {
  const evidence = response?.evidence ?? {};
  const riskScore = Math.round(Math.max(0, Math.min(100, Number(response?.risk_score) || 0)));
  const url = response?.url || submittedUrl || '';
  const verdict = String(response?.verdict || 'suspicious').toLowerCase();
  const threatIntel = evidence.threat_intel ?? null;

  return {
    id: evidence.scan_id || newId(),
    url,
    submittedUrl: submittedUrl ?? url,
    hostname: evidence.host?.hostname || hostOf(url),
    registrableDomain: evidence.host?.registrable_domain || null,
    verdict,
    riskScore,
    riskLevel: getRiskLevel(riskScore).key,
    confidence: typeof evidence.confidence === 'number' ? evidence.confidence : null,
    model: evidence.model ?? null,
    scannedAt: evidence.analyzed_at || new Date().toISOString(),
    durationMs: evidence.duration_ms ?? null,
    source,
    features: evidence.features ?? null,
    signals: Array.isArray(evidence.signals) ? evidence.signals : [],
    dns: evidence.dns ?? null,
    ip: evidence.ip ?? null,
    whois: evidence.whois ?? null,
    ssl: evidence.ssl ?? null,
    threatIntel: threatIntel
      ? {
          simulated: Boolean(threatIntel.simulated),
          virustotal: threatIntel.virustotal ?? null,
          abuseipdb: threatIntel.abuseipdb ?? null,
          safeBrowsing: threatIntel.safe_browsing ?? null,
        }
      : null,
    // On-chain receipt from the backend (Sprint 6.4). The browser's own hash
    // chain entry is attached separately as `ledger` when the scan is saved.
    chainReceipt: evidence.audit ?? null,
  };
}

// Turns an axios / engine error into one user-facing message, following the
// backend's error envelope {error: {code, message, details}} (core/errors.py).
export function describeApiError(error, baseUrl) {
  const body = error?.response?.data?.error;
  if (body) {
    const detail = Array.isArray(body.details) && body.details[0]?.msg ? ` — ${body.details[0].msg.replace(/^Value error, /, '')}` : '';
    return { code: body.code, message: `${body.message}${detail}` };
  }
  if (error?.response?.status === 404) {
    return {
      code: 'not_implemented',
      message: `The backend at ${baseUrl} doesn't expose /analyze yet. Switch to Demo mode in Settings, or wait for Sprint 3.4.`,
    };
  }
  if (error?.code === 'ECONNABORTED') {
    return { code: 'timeout', message: 'The analysis took too long. Try again in a moment.' };
  }
  if (error?.request && !error.response) {
    return {
      code: 'network_error',
      message: `Can't reach the backend at ${baseUrl}. Is uvicorn running? You can switch to Demo mode in Settings.`,
    };
  }
  return { code: error?.code || 'unknown_error', message: error?.message || 'Something went wrong while analyzing the URL.' };
}
