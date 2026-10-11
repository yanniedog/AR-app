import { createHash } from 'crypto';

const mockDigest = jest.fn((algorithm: string, text: string, options: { encoding: string }) => {
  expect(algorithm).toBe('SHA-256');
  expect(options).toEqual({ encoding: 'hex' });
  return createHash('sha256').update(text, 'utf8').digest('hex');
});
let mockNativeAvailable = true;
jest.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: (name: string) => {
    expect(name).toBe('ExpoCrypto');
    return mockNativeAvailable ? { digestString: mockDigest } : null;
  },
}));

function nativeHash() {
  // Isolate the cached native compatibility decision between runtime scenarios.
  let hash!: (value: object) => string;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    hash = require('../src/lib/jsonContentHash.native').jsonContentHash;
  });
  return hash;
}

beforeEach(() => { mockNativeAvailable = true; mockDigest.mockClear(); });

it('matches exact JSON SHA for Unicode, escaped surrogates, nested values and large strings', () => {
  const hash = nativeHash();
  for (const value of [{}, { text: 'é 澳 🏦\ud800', rows: [null, 0, false, { rate: '0.0525' }] },
    { description: 'Real content \"\n'.repeat(80_000) }]) {
    expect(hash(value)).toBe(createHash('sha256').update(JSON.stringify(value)).digest('hex'));
  }
  expect(mockDigest).toHaveBeenCalledTimes(4); // One compatibility probe, then native hashes.
});

it('re-hashes changed content without reusing a prior object receipt', () => {
  const hash = nativeHash(), value = { rows: [{ rate: '0.05' }] };
  const original = hash(value);
  value.rows[0].rate = '0.99';
  expect(hash(value)).not.toBe(original);
  expect(mockDigest).toHaveBeenCalledTimes(3);
});

it('keeps the portable implementation when the native method is unavailable', () => {
  mockNativeAvailable = false;
  const value = { text: 'é 🏦\ud800' };
  expect(nativeHash()(value)).toBe(createHash('sha256').update(JSON.stringify(value)).digest('hex'));
  expect(mockDigest).not.toHaveBeenCalled();
});

it('fails closed for incompatible native output and malformed later results', () => {
  mockDigest.mockReturnValueOnce('0'.repeat(64));
  expect(() => nativeHash()({})).toThrow('compatibility');
  const hash = nativeHash();
  hash({});
  mockDigest.mockReturnValueOnce('not-a-sha');
  expect(() => hash({ changed: true })).toThrow('invalid');
});
