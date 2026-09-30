import { AlertTriangle, Bug, ShieldAlert, ShieldCheck } from 'lucide-react';

// The four classes the ML model (Sprint 4) predicts, matching the backend's
// `Verdict` literal in backend/app/schemas/analysis.py.
//
// Verdicts are *status*, not categories, so they use the fixed status
// palette (good / warning / serious / critical) and are ALWAYS rendered with
// their icon + label — colour never carries the meaning on its own.
// Class names are written out in full so Tailwind can find them.
export const VERDICTS = {
  benign: {
    key: 'benign',
    label: 'Benign',
    icon: ShieldCheck,
    hex: '#0ca30c',
    text: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    fill: 'bg-[#0ca30c]',
    summary: 'No meaningful attack indicators were found.',
    advice: 'Safe to open. Stay alert if the page asks for credentials you did not expect to enter.',
  },
  suspicious: {
    key: 'suspicious',
    label: 'Suspicious',
    icon: AlertTriangle,
    hex: '#fab219',
    text: 'text-amber-300',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/30',
    fill: 'bg-[#fab219]',
    summary: 'Some risky traits were found, but not enough to confirm an attack.',
    advice: 'Open with caution. Do not enter passwords or payment details, and verify the sender first.',
  },
  phishing: {
    key: 'phishing',
    label: 'Phishing',
    icon: ShieldAlert,
    hex: '#d03b3b',
    text: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    fill: 'bg-[#d03b3b]',
    summary: 'This URL shows the traits of a credential-harvesting or impersonation page.',
    advice: 'Do not open or enter any information. Report the link and block the domain.',
  },
  malware: {
    key: 'malware',
    label: 'Malware',
    icon: Bug,
    hex: '#ec835a',
    text: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    fill: 'bg-[#ec835a]',
    summary: 'This URL appears to deliver or host malicious software.',
    advice: 'Do not download anything from this URL. Block the host and scan any device that opened it.',
  },
};

export const VERDICT_ORDER = ['benign', 'suspicious', 'phishing', 'malware'];

export function getVerdict(key) {
  return VERDICTS[String(key || '').toLowerCase()] ?? VERDICTS.suspicious;
}

export function isThreat(verdict) {
  return verdict === 'phishing' || verdict === 'malware';
}

// Risk-score bands (score is 0–100, backend `risk_score`).
export const RISK_LEVELS = [
  { key: 'low', label: 'Low', min: 0, max: 24, text: 'text-green-400' },
  { key: 'medium', label: 'Medium', min: 25, max: 49, text: 'text-amber-300' },
  { key: 'high', label: 'High', min: 50, max: 74, text: 'text-orange-400' },
  { key: 'critical', label: 'Critical', min: 75, max: 100, text: 'text-red-400' },
];

export function getRiskLevel(score) {
  const value = Math.max(0, Math.min(100, Number(score) || 0));
  return RISK_LEVELS.find((level) => value <= level.max) ?? RISK_LEVELS[RISK_LEVELS.length - 1];
}

export const SEVERITY_STYLES = {
  high: { label: 'High', text: 'text-red-400', bg: 'bg-red-500/10', dot: 'bg-red-400' },
  medium: { label: 'Medium', text: 'text-amber-300', bg: 'bg-amber-400/10', dot: 'bg-amber-300' },
  low: { label: 'Low', text: 'text-sky-300', bg: 'bg-sky-400/10', dot: 'bg-sky-300' },
  good: { label: 'Trust', text: 'text-green-400', bg: 'bg-green-500/10', dot: 'bg-green-400' },
};

// Rows for a labelled verdict breakdown (BarList): icon + label + count.
export function verdictBars(byVerdict) {
  return VERDICT_ORDER.map((key) => ({
    key,
    label: VERDICTS[key].label,
    value: byVerdict[key] ?? 0,
    icon: VERDICTS[key].icon,
    color: VERDICTS[key].hex,
    textClass: VERDICTS[key].text,
  }));
}
