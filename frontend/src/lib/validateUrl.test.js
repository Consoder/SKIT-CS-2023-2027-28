import { describe, expect, it } from 'vitest';
import { validateUrl } from './validateUrl';

describe('validateUrl', () => {
  it('rejects an empty value', () => {
    expect(validateUrl('')).toBe('Enter a URL to analyze.');
    expect(validateUrl('   ')).toBe('Enter a URL to analyze.');
  });

  it('rejects a value with no scheme', () => {
    expect(validateUrl('example.com')).toBe('Enter a valid URL, e.g. https://example.com');
  });

  it('rejects a non-http(s) scheme', () => {
    expect(validateUrl('ftp://example.com')).toBe('URL must use http:// or https://');
    expect(validateUrl('javascript:alert(1)')).toBe('URL must use http:// or https://');
  });

  it('rejects a hostname with no domain', () => {
    expect(validateUrl('http://localhost')).toBe(
      'Enter a URL with a valid domain, e.g. https://example.com',
    );
  });

  it('accepts a well-formed http(s) URL', () => {
    expect(validateUrl('https://example.com')).toBeNull();
    expect(validateUrl('http://sub.example.com/path?q=1')).toBeNull();
    expect(validateUrl('  https://example.com  ')).toBeNull();
  });
});
