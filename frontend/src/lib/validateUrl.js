// Client-side mirror of the backend's request validation
// (backend/app/schemas/url.py), run before a URL is ever sent to /analyze so
// users get instant feedback instead of a 422. Keep the two in sync.

export const MAX_URL_LENGTH = 2048;

// Any RFC 3986 scheme prefix ("https:", "javascript:", "data:" ...).
const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = /[\x00-\x1f\x7f]/;
const HOSTNAME_RE =
  /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.?$/;
const IPV4_RE = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

// Like the backend, a bare "example.com/path" is treated as http://.
export function normalizeUrl(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  return SCHEME_RE.test(trimmed) ? trimmed : `http://${trimmed}`;
}

// Extracts the authority's port the way the user typed it; `new URL()`
// silently drops default ports and throws on others, so check it by hand.
function rawPort(candidate) {
  const match = candidate.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^/?#]*)/);
  if (!match) return null;
  const authority = match[1].replace(/^.*@/, '');
  // IPv6 literals contain colons themselves: only a colon after "]" is a port.
  const portMatch = authority.startsWith('[') ? authority.match(/^\[[^\]]*\]:(.*)$/) : authority.match(/^[^:]*:(.*)$/);
  return portMatch ? portMatch[1] : null;
}

// Returns an error message string, or null when the URL is valid.
export function validateUrl(value) {
  const trimmed = String(value ?? '').trim();

  if (!trimmed) {
    return 'Enter a URL to analyze.';
  }
  if (trimmed.length > MAX_URL_LENGTH) {
    return `URL is too long (max ${MAX_URL_LENGTH.toLocaleString()} characters).`;
  }
  if (CONTROL_CHAR_RE.test(trimmed)) {
    return 'URL must not contain control characters.';
  }

  const candidate = normalizeUrl(trimmed);
  const scheme = candidate.split(':')[0].toLowerCase();
  if (scheme !== 'http' && scheme !== 'https') {
    return 'URL must use http:// or https://';
  }
  if (/\s/.test(candidate)) {
    return 'Enter a valid URL, e.g. https://example.com';
  }

  const port = rawPort(candidate);
  if (port !== null && port !== '' && !(/^\d+$/.test(port) && Number(port) <= 65535)) {
    return 'URL has an invalid port (must be 0–65535).';
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return 'Enter a valid URL, e.g. https://example.com';
  }

  const hostname = parsed.hostname;
  if (!hostname) {
    return 'Enter a valid URL, e.g. https://example.com';
  }

  const isIpv6 = hostname.startsWith('[') && hostname.endsWith(']');
  const isIpv4 = IPV4_RE.test(hostname);
  if (!isIpv4 && !isIpv6) {
    if (!HOSTNAME_RE.test(hostname)) {
      return 'Enter a valid URL, e.g. https://example.com';
    }
    // A scanner needs a public domain: single-label hosts like "localhost"
    // can't be looked up in WHOIS / threat-intel feeds.
    if (!hostname.replace(/\.$/, '').includes('.')) {
      return 'Enter a URL with a valid domain, e.g. https://example.com';
    }
  }

  return null;
}
