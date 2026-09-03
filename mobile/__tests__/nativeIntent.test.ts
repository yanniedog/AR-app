import { sanitizeNativeIntentPath } from '../app/+native-intent';

describe('native intent boundary', () => {
  it('normalizes supported app links to internal routes', () => {
    expect(sanitizeNativeIntentPath('arrates://product/A%7C1?ri=2')).toBe('/product/A%7C1?ri=2');
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

  it('caps work before decoding attacker-controlled input', () => {
    expect(sanitizeNativeIntentPath(`/search?query=${'a'.repeat(2_100)}`)).toBe('/');
  });
});
