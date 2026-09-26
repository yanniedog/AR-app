import { gzipSync, strToU8 } from 'fflate';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { compressCatalogue, compressCatalogueAsync, decompressCatalogue, decompressCatalogueAsync } from '../src/data/historicalBankRateCatalogueCompression';

const encode = (text: string) => {
  const bytes = strToU8(text);
  return { bytes: bytes.length, sha256: bytesToHex(sha256(bytes)), gzip_base64: Buffer.from(gzipSync(bytes)).toString('base64') };
};

test('compressed catalogue preserves Unicode evidence and large multi-chunk metadata', () => {
  const value = { description: 'Crédit — 日本語 😀\n'.repeat(20_000), rates: [0, 5.25, 12.1], nested: { unavailable: null } };
  const compressed = compressCatalogue(value);
  expect(compressed.gzip_base64.length).toBeLessThan(compressed.bytes / 5);
  expect(decompressCatalogue(compressed)).toEqual(value);
});

test.each([
  ['wrong digest', (value: ReturnType<typeof compressCatalogue>) => ({ ...value, sha256: '0'.repeat(64) })],
  ['wrong declared length', (value: ReturnType<typeof compressCatalogue>) => ({ ...value, bytes: value.bytes + 1 })],
  ['truncated gzip', (value: ReturnType<typeof compressCatalogue>) => ({ ...value, gzip_base64: value.gzip_base64.slice(0, -4) })],
  ['invalid base64 character', (value: ReturnType<typeof compressCatalogue>) => ({ ...value, gzip_base64: '!' + value.gzip_base64.slice(1) })],
  ['padding inside base64', (value: ReturnType<typeof compressCatalogue>) => ({ ...value, gzip_base64: value.gzip_base64.slice(0, 5) + '=' + value.gzip_base64.slice(6) })],
])('rejects %s before exposing a catalogue', (_name, mutate) => {
  expect(decompressCatalogue(mutate(compressCatalogue({ evidence: ['verified'], rates: [5] })))).toBeNull();
});

test('rejects decoded and compressed budgets before allocating the declared payload', () => {
  const compressed = compressCatalogue({ value: 'test' });
  expect(decompressCatalogue({ ...compressed, bytes: 128 * 1024 * 1024 + 1 })).toBeNull();
  expect(decompressCatalogue({ ...compressed, gzip_base64: 'A'.repeat(Math.ceil(16 * 1024 * 1024 / 3) * 4 + 4) })).toBeNull();
});

test('a forged small gzip footer cannot overrun the declared decompression buffer', () => {
  const value = encode(JSON.stringify({ evidence: 'x'.repeat(50_000) }));
  const gzip = Buffer.from(value.gzip_base64, 'base64');
  gzip.writeUInt32LE(8, gzip.length - 4);
  expect(decompressCatalogue({ ...value, bytes: 8, gzip_base64: gzip.toString('base64') })).toBeNull();
});

test('valid compression and digest do not admit malformed JSON', () => {
  expect(decompressCatalogue(encode('{broken JSON'))).toBeNull();
});

const cooperative = () => ({ yieldControl: jest.fn(async () => undefined), sliceMs: 0 });

test('async compression yields while preserving native JSON bytes, Unicode boundaries and shared references', async () => {
  const shared = { data: 'repeat', optional: undefined };
  const value = { '2': 'second', '1': 'first', omitted: undefined, functions: () => 1,
    description: ('x'.repeat(8191) + '😀\ud800\udfff\n"\\日本語').repeat(20), shared, again: shared,
    values: [undefined, , null, true, false, -0, Infinity, NaN, 3.14159], nested: Object.assign(Object.create(null), { x: 4 }) };
  const expected = JSON.stringify(value), options = cooperative();
  const encoded = await compressCatalogueAsync(value, options);
  expect(encoded.sha256).toBe(bytesToHex(sha256(strToU8(expected))));
  expect(encoded.bytes).toBe(strToU8(expected).length);
  expect(decompressCatalogue(encoded)).toEqual(JSON.parse(expected));
  expect(options.yieldControl.mock.calls.length).toBeGreaterThan(10);
  const decodeOptions = cooperative();
  expect(await decompressCatalogueAsync(encoded, decodeOptions)).toEqual(JSON.parse(expected));
  expect(decodeOptions.yieldControl.mock.calls.length).toBeGreaterThan(5);
});

test('a scheduled UI task runs before large async compression completes', async () => {
  let uiRan = false;
  const timer = setTimeout(() => { uiRan = true; }, 0);
  const value = { rows: Array.from({ length: 2000 }, (_, i) => ({ id: i, detail: 'x'.repeat(80) })) };
  const encoded = await compressCatalogueAsync(value, { yieldControl: () => new Promise(resolve => setTimeout(resolve, 0)), sliceMs: 1 });
  clearTimeout(timer);
  expect(uiRan).toBe(true);
  expect(decompressCatalogue(encoded)).toEqual(value);
});

test.each([
  ['root undefined', undefined], ['BigInt', { value: BigInt(1) }], ['Date', { date: new Date(0) }],
  ['custom toJSON', { toJSON: () => ({ x: 1 }) }],
])('async serialization clearly rejects unsupported %s', async (_label, value) => {
  await expect(compressCatalogueAsync(value, cooperative())).rejects.toThrow(/JSON|serializable/);
});

test('async serialization rejects cycles and excessive nesting without recursive stack overflow', async () => {
  const cyclic: { child?: unknown } = {}; cyclic.child = cyclic;
  await expect(compressCatalogueAsync(cyclic, cooperative())).rejects.toThrow('Circular');
  let deep: unknown = 1; for (let i = 0; i < 514; i++) deep = [deep];
  await expect(compressCatalogueAsync(deep, cooperative())).rejects.toThrow('nesting');
});

test('async cache rejects decoded output budget while streaming, without serializing a huge root', async () => {
  const value = Array(2100).fill('x'.repeat(65_536));
  await expect(compressCatalogueAsync(value, cooperative())).rejects.toThrow('decoded budget');
}, 30_000);

test.each([
  ['wrong digest', (v: ReturnType<typeof compressCatalogue>) => ({ ...v, sha256: '0'.repeat(64) })],
  ['wrong length', (v: ReturnType<typeof compressCatalogue>) => ({ ...v, bytes: v.bytes + 1 })],
  ['truncated gzip', (v: ReturnType<typeof compressCatalogue>) => ({ ...v, gzip_base64: v.gzip_base64.slice(0, -4) })],
  ['malformed base64', (v: ReturnType<typeof compressCatalogue>) => ({ ...v, gzip_base64: '!' + v.gzip_base64.slice(1) })],
  ['non-final padding', (v: ReturnType<typeof compressCatalogue>) => ({ ...v, gzip_base64: v.gzip_base64 + 'AAAA' })],
  ['declared overflow', (v: ReturnType<typeof compressCatalogue>) => ({ ...v, bytes: 128 * 1024 * 1024 + 1 })],
])('async decompression rejects %s', async (_label, mutate) => {
  expect(await decompressCatalogueAsync(mutate(compressCatalogue({ data: 'verified' })), cooperative())).toBeNull();
});

test('async decompression rejects forged inflation lengths and malformed JSON after verified digest', async () => {
  const encoded = encode(JSON.stringify({ data: 'x'.repeat(100_000) }));
  const gzip = Buffer.from(encoded.gzip_base64, 'base64'); gzip.writeUInt32LE(8, gzip.length - 4);
  expect(await decompressCatalogueAsync({ ...encoded, bytes: 8, gzip_base64: gzip.toString('base64') }, cooperative())).toBeNull();
  expect(await decompressCatalogueAsync(encode('{bad JSON'), cooperative())).toBeNull();
});

test('large async base64 roundtrip does not accept padding at an intermediate chunk boundary', async () => {
  const invalid = 'AAAA'.repeat(16_383) + 'AA==' + 'AAAA';
  expect(await decompressCatalogueAsync({ sha256: '0'.repeat(64), bytes: 10, gzip_base64: invalid }, cooperative())).toBeNull();
});
