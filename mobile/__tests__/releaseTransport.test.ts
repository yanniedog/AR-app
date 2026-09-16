import { hexToBytes } from '@noble/ciphers/utils';
import { strFromU8 } from 'fflate';
import { decryptReleaseTransport, RELEASE_TRANSPORT_OVERHEAD } from '../src/lib/releaseTransport';
import { downloadInflate, fetchManifest } from '../src/data/payload';
import { fetchDatesIndexJson } from '../src/data/historyDaily';
import * as SecureStore from 'expo-secure-store';
import { transportKeyId } from '../src/lib/payloadCrypto';
import vector from './fixtures/release-transport-v2.json';
import { gcm } from '@noble/ciphers/aes';
import { sha256 } from '@noble/hashes/sha256';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digest: jest.fn(async (_algorithm: string, bytes: Uint8Array) =>
    Uint8Array.from(require('crypto').createHash('sha256').update(bytes).digest()).buffer),
}));

const wire = () => hexToBytes(vector.wire_hex);
const resolver = jest.fn(async () => vector.key_hex);

beforeEach(() => resolver.mockClear());

test('authenticates exact Python-produced bytes with a retained key ID', async () => {
  expect(transportKeyId(vector.key_hex)).toBe(vector.key_id);
  expect(await decryptReleaseTransport(wire(), resolver)).toEqual(hexToBytes(vector.plain_hex));
  expect(resolver).toHaveBeenCalledWith(vector.key_id);
});

test.each([4, 36, 44, 56, -1])('rejects tampering at byte %s', async index => {
  const bytes = wire(); bytes[index < 0 ? bytes.length - 1 : index] ^= 1;
  await expect(decryptReleaseTransport(bytes, resolver)).rejects.toThrow();
});

test('refuses oversized content before accessing keys', async () => {
  await expect(decryptReleaseTransport(wire(), resolver, 1)).rejects.toThrow();
  expect(resolver).not.toHaveBeenCalled();
});

test('fails with wrong or missing keys without exposing private errors', async () => {
  await expect(decryptReleaseTransport(wire(), async () => '00'.repeat(32))).rejects.toThrow('could not be opened');
  await expect(decryptReleaseTransport(wire(), async () => { throw new Error('private-path'); })).rejects.toThrow('could not be opened');
});

function encrypted(text: string): Uint8Array {
  const plain = new TextEncoder().encode(text);
  const header = new Uint8Array(44); header.set([65, 82, 69, 50]);
  header.set(new TextEncoder().encode(vector.key_id), 4);
  new DataView(header.buffer).setUint32(40, plain.length, false);
  const nonce = new Uint8Array(12); // Technical test vector only.
  const cipher = gcm(hexToBytes(vector.key_hex), nonce, header).encrypt(plain);
  const result = new Uint8Array(plain.length + RELEASE_TRANSPORT_OVERHEAD);
  result.set(header); result.set(nonce, 44); result.set(cipher, 56); return result;
}

test.each(['ARE1', 'ARE2'])('rejects authenticated nested %s transport', async prefix => {
  await expect(decryptReleaseTransport(encrypted(prefix + 'x'.repeat(80)), resolver)).rejects.toThrow('could not be opened');
});

test('shared loader unwraps transport before unchanged domain bounds and hash checks', async () => {
  const previous = globalThis.XMLHttpRequest;
  let body = wire();
  class Response {
    status = 200; response = body.slice().buffer;
    onload?: () => void;
    open() {} send() { this.onload?.(); }
  }
  Object.defineProperty(globalThis, 'XMLHttpRequest', { configurable: true, value: Response });
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(vector.key_hex);
  try {
    const bytes = hexToBytes(vector.plain_hex);
    await expect(downloadInflate('https://example.test/asset', vector.plain_sha256, {
      expectedBytes: bytes.length, requireExactBytes: true, maxCompressedBytes: bytes.length,
      maxInflatedBytes: bytes.length, expectedEncoding: 'identity', allowEncrypted: false,
    })).resolves.toBe(strFromU8(bytes));
    await expect(downloadInflate('https://example.test/asset', 'a'.repeat(64))).rejects.toThrow('sha256');
    const manifest = JSON.stringify({ schema_version: 1, run_date: '2026-09-16' });
    body = encrypted(manifest);
    const hash = Array.from(sha256(new TextEncoder().encode(manifest))).map(b => b.toString(16).padStart(2, '0')).join('');
    await expect(fetchManifest('https://example.test/manifest', undefined, hash)).resolves.toMatchObject({ run_date: '2026-09-16' });
    body = encrypted(JSON.stringify({ dates: ['2026-09-16'] }));
    await expect(fetchDatesIndexJson('https://example.test/dates-index')).resolves.toMatchObject({ dates: ['2026-09-16'] });
  } finally {
    Object.defineProperty(globalThis, 'XMLHttpRequest', { configurable: true, value: previous });
    (SecureStore.getItemAsync as jest.Mock).mockReset();
  }
});
