// Browser-side port of the lexical & host-based features the ML pipeline
// extracts (ml/src/features.py, Sprint 1.2). Feature keys use the same names
// as the Python code so the UI can render either this output (demo mode) or
// the backend's `evidence.features` (live mode) through one table.

import { normalizeUrl } from './validateUrl';

export const SUSPICIOUS_TLDS = new Set([
  'tk', 'ml', 'ga', 'cf', 'gq', 'xyz', 'top', 'work', 'zip', 'mov', 'click',
  'country', 'kim', 'men', 'loan', 'review', 'rest', 'cam', 'icu', 'buzz', 'monster',
]);

export const SHORTENERS = new Set([
  'bit.ly', 'bitly.com', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly', 'is.gd', 'buff.ly',
  'cutt.ly', 'rebrand.ly', 'shorturl.at', 'rb.gy', 'tiny.cc', 'v.gd', 's.id',
]);

const MULTI_PART_SLDS = new Set(['co', 'com', 'org', 'net', 'ac', 'gov', 'edu', 'nic', 'res']);
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

// Shannon entropy in bits per character.
export function shannonEntropy(value) {
  if (!value) return 0;
  const counts = new Map();
  for (const char of value) counts.set(char, (counts.get(char) ?? 0) + 1);
  const total = value.length;
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / total;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

// "login.secure.example.co.uk" -> { registrable: "example.co.uk", sld: "example", tld: "uk" }
export function splitHost(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  const parts = host.split('.');
  const tld = parts.at(-1) ?? '';
  let registrableParts = 2;
  if (parts.length >= 3 && tld.length === 2 && MULTI_PART_SLDS.has(parts.at(-2))) {
    registrableParts = 3;
  }
  const registrable = parts.slice(-registrableParts).join('.');
  const sld = parts.at(-registrableParts) ?? '';
  const subdomains = parts.slice(0, Math.max(0, parts.length - registrableParts));
  return { host, tld, sld, registrable, subdomains };
}

function isIpHost(hostname) {
  return IPV4_RE.test(hostname) || (hostname.startsWith('[') && hostname.endsWith(']'));
}

// Returns { raw: {feature_name: value}, meta: {...} } or null for an unparseable URL.
export function extractFeatures(input) {
  const url = normalizeUrl(input);
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  const isIp = isIpHost(hostname);
  const { tld, registrable, subdomains } = isIp
    ? { tld: '', registrable: hostname, subdomains: [] }
    : splitHost(hostname);

  // Counts are taken on the URL as submitted, like the Python code does,
  // because `new URL()` normalizes away things attackers rely on.
  const raw = String(input).trim();
  const afterAuthority = raw.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/?#]*/, '');
  const rawPath = afterAuthority.split(/[?#]/)[0] ?? '';
  const query = parsed.search.replace(/^\?/, '');
  const port = parsed.port;
  const digits = (raw.match(/\d/g) ?? []).length;
  const letters = (raw.match(/[a-zA-Z]/g) ?? []).length;
  const specials = (raw.match(/[^a-zA-Z0-9]/g) ?? []).length;

  const features = {
    url_length: raw.length,
    domain_length: hostname.length,
    path_length: rawPath.length,
    query_length: query.length,
    fragment_length: parsed.hash.replace(/^#/, '').length,
    num_dots: (raw.match(/\./g) ?? []).length,
    num_hyphens: (raw.match(/-/g) ?? []).length,
    num_underscores: (raw.match(/_/g) ?? []).length,
    num_slashes: (raw.match(/\//g) ?? []).length,
    num_query_params: query ? query.split('&').length : 0,
    num_subdomains: subdomains.length,
    at_symbol_count: (raw.match(/@/g) ?? []).length,
    url_digit_ratio: raw.length ? digits / raw.length : 0,
    url_letter_ratio: raw.length ? letters / raw.length : 0,
    url_special_char_ratio: raw.length ? specials / raw.length : 0,
    url_entropy: shannonEntropy(raw),
    domain_entropy: shannonEntropy(hostname),
    has_ip_address: isIp,
    has_http: parsed.protocol === 'http:',
    has_https: parsed.protocol === 'https:',
    has_port: port !== '',
    has_unusual_port: port !== '' && port !== '80' && port !== '443',
    has_suspicious_tld: SUSPICIOUS_TLDS.has(tld),
    is_shortener: SHORTENERS.has(hostname.replace(/^www\./, '')),
    has_query_string: query.length > 0,
    has_fragment: parsed.hash.length > 1,
    double_slash_in_path: rawPath.includes('//'),
    double_dot_in_path: rawPath.includes('..'),
    has_percent_encoding: /%[0-9a-fA-F]{2}/.test(raw),
    has_unicode: [...raw].some((char) => char.charCodeAt(0) > 0x7f),
    has_punycode: hostname.split('.').some((label) => label.startsWith('xn--')),
    has_numeric_domain: /\d/.test(isIp ? '' : hostname),
    tld,
  };

  return {
    raw: features,
    meta: {
      url,
      hostname,
      registrable,
      subdomains,
      path: parsed.pathname,
      query,
      isIp,
    },
  };
}

// Display metadata for the feature table. `risky(value)` marks a feature
// that is pushing the score up so the UI can highlight it.
export const FEATURE_CATALOG = [
  { key: 'url_length', label: 'URL length', group: 'Lexical', format: 'chars', risky: (v) => v > 75 },
  { key: 'domain_length', label: 'Domain length', group: 'Lexical', format: 'chars', risky: (v) => v > 30 },
  { key: 'path_length', label: 'Path length', group: 'Lexical', format: 'chars' },
  { key: 'query_length', label: 'Query length', group: 'Lexical', format: 'chars' },
  { key: 'fragment_length', label: 'Fragment length', group: 'Lexical', format: 'chars' },
  { key: 'url_entropy', label: 'URL entropy', group: 'Lexical', format: 'bits', risky: (v) => v > 4.8 },
  { key: 'domain_entropy', label: 'Domain entropy', group: 'Lexical', format: 'bits', risky: (v) => v > 4.2 },
  { key: 'url_digit_ratio', label: 'Digit ratio', group: 'Lexical', format: 'ratio', risky: (v) => v > 0.25 },
  { key: 'url_letter_ratio', label: 'Letter ratio', group: 'Lexical', format: 'ratio' },
  { key: 'url_special_char_ratio', label: 'Special-char ratio', group: 'Lexical', format: 'ratio', risky: (v) => v > 0.3 },
  { key: 'num_dots', label: 'Dots', group: 'Character counts', risky: (v) => v > 4 },
  { key: 'num_hyphens', label: 'Hyphens', group: 'Character counts', risky: (v) => v > 3 },
  { key: 'num_underscores', label: 'Underscores', group: 'Character counts' },
  { key: 'num_slashes', label: 'Slashes', group: 'Character counts', risky: (v) => v > 7 },
  { key: 'at_symbol_count', label: '@ symbols', group: 'Character counts', risky: (v) => v > 0 },
  { key: 'num_query_params', label: 'Query parameters', group: 'Character counts', risky: (v) => v > 5 },
  { key: 'num_subdomains', label: 'Subdomains', group: 'Host', risky: (v) => v >= 3 },
  { key: 'has_ip_address', label: 'Raw IP as host', group: 'Host', format: 'bool', risky: (v) => v },
  { key: 'has_suspicious_tld', label: 'Abuse-prone TLD', group: 'Host', format: 'bool', risky: (v) => v },
  { key: 'is_shortener', label: 'URL shortener', group: 'Host', format: 'bool', risky: (v) => v },
  { key: 'has_punycode', label: 'Punycode (IDN) host', group: 'Host', format: 'bool', risky: (v) => v },
  { key: 'has_numeric_domain', label: 'Digits in domain', group: 'Host', format: 'bool' },
  { key: 'tld', label: 'Top-level domain', group: 'Host', format: 'text' },
  { key: 'has_https', label: 'HTTPS', group: 'Protocol & port', format: 'bool', risky: (v) => !v },
  { key: 'has_http', label: 'Plain HTTP', group: 'Protocol & port', format: 'bool' },
  { key: 'has_port', label: 'Explicit port', group: 'Protocol & port', format: 'bool' },
  { key: 'has_unusual_port', label: 'Non-standard port', group: 'Protocol & port', format: 'bool', risky: (v) => v },
  { key: 'has_query_string', label: 'Query string', group: 'Obfuscation', format: 'bool' },
  { key: 'has_fragment', label: 'Fragment', group: 'Obfuscation', format: 'bool' },
  { key: 'double_slash_in_path', label: '// in path', group: 'Obfuscation', format: 'bool', risky: (v) => v },
  { key: 'double_dot_in_path', label: '.. in path', group: 'Obfuscation', format: 'bool', risky: (v) => v },
  { key: 'has_percent_encoding', label: 'Percent-encoding', group: 'Obfuscation', format: 'bool', risky: (v) => v },
  { key: 'has_unicode', label: 'Non-ASCII characters', group: 'Obfuscation', format: 'bool', risky: (v) => v },
];

export function formatFeatureValue(value, format) {
  if (value === undefined || value === null || value === '') return '—';
  switch (format) {
    case 'bool':
      return value ? 'Yes' : 'No';
    case 'chars':
      return `${value}`;
    case 'bits':
      return Number(value).toFixed(2);
    case 'ratio':
      return `${(Number(value) * 100).toFixed(1)}%`;
    default:
      return String(value);
  }
}
