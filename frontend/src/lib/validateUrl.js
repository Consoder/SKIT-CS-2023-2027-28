// Client-side format check for the scanner input, run before a URL is ever
// sent to /url/analyze. Returns an error message string, or null when valid.
export function validateUrl(value) {
  const trimmed = value.trim();

  if (!trimmed) {
    return 'Enter a URL to analyze.';
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return 'Enter a valid URL, e.g. https://example.com';
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'URL must use http:// or https://';
  }

  if (!parsed.hostname.includes('.')) {
    return 'Enter a URL with a valid domain, e.g. https://example.com';
  }

  return null;
}
