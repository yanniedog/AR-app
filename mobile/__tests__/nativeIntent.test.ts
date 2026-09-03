import { sanitizeNativeIntentPath } from '../app/+native-intent';

describe('native intent boundary', () => {
  it('normalizes supported app links to internal routes', () => {
    expect(sanitizeNativeIntentPath('arrates://product/A%7C1?ri=2')).toBe('/product/A%7C1?ri=2');
    expect(sanitizeNativeIntentPath('arrates://product/rate%25special')).toBe('/product/rate%25special');
    expect(sanitizeNativeIntentPath('/search?section=Mortgage')).toBe('/search?section=Mortgage');
    expect(sanitizeNativeIntentPath('arrates://passthrough')).toBe('/passthrough');
    expect(sanitizeNativeIntentPath('arrates://watchlist')).toBe('/watchlist');
    expect(sanitizeNativeIntentPath('arrates://privacy')).toBe('/terms');
  });

  it('rejects unknown schemes, routes, control characters, and malformed encoding', () => {
    expect(sanitizeNativeIntentPath('https://example.test/search')).toBe('/');
    expect(sanitizeNativeIntentPath('arrates://not-a-route')).toBe('/');
    expect(sanitizeNativeIntentPath('arrates://search?query=%ZZ')).toBe('/');
    expect(sanitizeNativeIntentPath('/search\u0000?query=rate')).toBe('/');
  });

  it('keeps internal diagnostic surfaces out of external deep links', () => {
    expect(sanitizeNativeIntentPath('arrates://debug-log')).toBe('/');
    expect(sanitizeNativeIntentPath('arrates://performance-audit')).toBe('/');
  });

  it('rejects literal, encoded, and double-encoded path traversal', () => {
    expect(sanitizeNativeIntentPath('arrates://product/../performance-audit')).toBe('/');
    expect(sanitizeNativeIntentPath('arrates://product/%2e%2e/debug-log')).toBe('/');
    expect(sanitizeNativeIntentPath('arrates://product/%252e%252e/debug-log')).toBe('/');
    expect(sanitizeNativeIntentPath('arrates://product/%2fdebug-log')).toBe('/');
    expect(sanitizeNativeIntentPath('arrates://product/%c0%ae%c0%ae/debug-log')).toBe('/');
  });

  it('caps work before decoding attacker-controlled input', () => {
    expect(sanitizeNativeIntentPath(`/search?query=${'a'.repeat(2_100)}`)).toBe('/');
  });
});
