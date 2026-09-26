import { gzipSync, strToU8 } from 'fflate';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { compressCatalogue, decompressCatalogue } from '../src/data/historicalBankRateCatalogueCompression';

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
