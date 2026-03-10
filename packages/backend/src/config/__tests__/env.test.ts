import { describe, it, expect } from 'vitest';
import { normalizeFrontendUrl } from '../env.js';

describe('normalizeFrontendUrl', () => {
  it('returns empty string for empty input', () => {
    expect(normalizeFrontendUrl('')).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeFrontendUrl('   ')).toBe('');
  });

  it('returns empty string for an invalid URL', () => {
    expect(normalizeFrontendUrl('not-a-url')).toBe('');
  });

  it('returns origin for a clean URL', () => {
    expect(normalizeFrontendUrl('https://example.com')).toBe('https://example.com');
  });

  it('strips trailing slash', () => {
    expect(normalizeFrontendUrl('https://example.com/')).toBe('https://example.com');
  });

  it('strips path component', () => {
    expect(normalizeFrontendUrl('https://example.com/some/path')).toBe('https://example.com');
  });

  it('strips query string', () => {
    expect(normalizeFrontendUrl('https://example.com?foo=bar')).toBe('https://example.com');
  });

  it('strips hash fragment', () => {
    expect(normalizeFrontendUrl('https://example.com#section')).toBe('https://example.com');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeFrontendUrl('  https://example.com  ')).toBe('https://example.com');
  });

  it('preserves non-default port', () => {
    expect(normalizeFrontendUrl('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('handles URL with port, path and whitespace together', () => {
    expect(normalizeFrontendUrl('  https://app.example.com:8080/dashboard?v=1  ')).toBe(
      'https://app.example.com:8080',
    );
  });

  it('returns empty string for opaque origins like file://', () => {
    expect(normalizeFrontendUrl('file:///etc/passwd')).toBe('');
  });
});
