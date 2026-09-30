import { describe, expect, it } from 'vitest';
import { normalizeUrl, validateUrl } from './validateUrl';

// Cases mirror backend/tests/test_url_schema*.py so both layers agree.
describe('validateUrl', () => {
  it('rejects an empty value', () => {
    expect(validateUrl('')).toBe('Enter a URL to analyze.');
    expect(validateUrl('   ')).toBe('Enter a URL to analyze.');
  });

  it('accepts a bare domain and treats it as http://, like the backend', () => {
    expect(validateUrl('example.com')).toBeNull();
    expect(normalizeUrl('example.com/path')).toBe('http://example.com/path');
    expect(normalizeUrl('  https://example.com ')).toBe('https://example.com');
  });

  it('rejects free text', () => {
    expect(validateUrl('not a url')).toBe('Enter a valid URL, e.g. https://example.com');
  });

  it('rejects a non-http(s) scheme', () => {
    expect(validateUrl('ftp://example.com')).toBe('URL must use http:// or https://');
    expect(validateUrl('javascript:alert(1)')).toBe('URL must use http:// or https://');
    expect(validateUrl('data:text/html,hi')).toBe('URL must use http:// or https://');
  });

  it('rejects a hostname with no domain', () => {
    expect(validateUrl('http://localhost')).toBe('Enter a URL with a valid domain, e.g. https://example.com');
  });

  it('rejects embedded control characters (CRLF injection)', () => {
    expect(validateUrl('http://example.com/\npath')).toBe('URL must not contain control characters.');
    expect(validateUrl('http://example.com/\u0000')).toBe('URL must not contain control characters.');
  });

  it('rejects out-of-range and non-numeric ports', () => {
    expect(validateUrl('http://example.com:99999/')).toMatch(/invalid port/);
    expect(validateUrl('http://example.com:-1/')).toMatch(/invalid port/);
    expect(validateUrl('http://example.com:8080/')).toBeNull();
  });

  it('rejects URLs over 2048 characters', () => {
    expect(validateUrl(`https://example.com/${'a'.repeat(2100)}`)).toMatch(/too long/);
  });

  it('accepts IPv4 / IPv6 literals and a trailing DNS root dot', () => {
    expect(validateUrl('http://203.0.113.5/login')).toBeNull();
    expect(validateUrl('http://[2001:db8::1]/')).toBeNull();
    expect(validateUrl('https://example.com./')).toBeNull();
  });

  it('accepts a well-formed http(s) URL', () => {
    expect(validateUrl('https://example.com')).toBeNull();
    expect(validateUrl('http://sub.example.com/path?q=1')).toBeNull();
    expect(validateUrl('  https://example.com  ')).toBeNull();
  });
});
