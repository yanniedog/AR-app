import { gzipSync, strToU8, strFromU8, gunzipSync } from 'fflate';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { gcm } from '@noble/ciphers/aes';
import { loadDetachedHistoricalBankRateCatalogue } from '../src/data/detachedHistoricalBankRateCatalogue';
import { validateDetachedHistoricalCatalogueDescriptor, validateDetachedHistoricalCatalogueEnvelope,
  DETACHED_HISTORY_MAX_COMPRESSED, DETACHED_HISTORY_MAX_DECODED } from '../src/data/detachedHistoricalBankRateCatalogueWire';
import { encodeDetachedHistoryBytes, decodeDetachedHistoryBytes } from '../src/data/detachedHistoricalCatalogueBytes';
import { cache } from '../src/data/cache';
import { downloadInflate } from '../src/data/payload';
import { compressCatalogue } from '../src/data/historicalBankRateCatalogueCompression';
import { upsertHistoricalCatalogueDay } from '../src/data/historicalBankRateCatalogueMerge';
import { sampleCore } from '../src/data/sample';
import { revisionManifest } from '../testUtils/payloadRevision';
import { isLocalAppHealthAudit } from '../src/lib/appHealthTransportGuard';
import { resolvePayloadKeyHex } from '../src/lib/keyVault';
import { yieldToUi } from '../src/lib/yieldToUi';
import type { Manifest } from '../src/types';
import { payloadBundleIdentity } from '../src/data/payloadBundleIdentity';

jest.mock('expo-crypto', () => ({ CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digest: jest.fn(async (_: unknown, bytes: Uint8Array) => new Uint8Array(jest.requireActual('@noble/hashes/sha256').sha256(bytes)).buffer),
}));
jest.mock('../src/data/cache', () => ({ cache: { readDetachedBankRateHistoryAsset: jest.fn(), writeDetachedBankRateHistoryAsset: jest.fn() } }));
jest.mock('../src/data/payload', () => ({ ...jest.requireActual('../src/data/payload'), downloadInflate: jest.fn() }));
jest.mock('../src/lib/appHealthTransportGuard', () => ({ ...jest.requireActual('../src/lib/appHealthTransportGuard'), isLocalAppHealthAudit: jest.fn(() => false) }));
jest.mock('../src/lib/keyVault', () => ({ resolvePayloadKeyHex: jest.fn() }));
jest.mock('../src/lib/yieldToUi', () => ({ yieldToUi: jest.fn(async () => {}), parseJsonHeavy: async (text: string) => JSON.parse(text) }));

const day = sampleCore.run_date;
const source = { kind: 'published_core' as const, core_sha256: 'a'.repeat(64), details_sha256: 'b'.repeat(64), manifest_sha256: 'c'.repeat(64) };
const capturedCore = { ...sampleCore, sections: { ...sampleCore.sections,
  Mortgage: { ...sampleCore.sections.Mortgage, rates: sampleCore.sections.Mortgage.rates.slice(0, 1) },
  Savings: { ...sampleCore.sections.Savings, rates: [] }, TD: { ...sampleCore.sections.TD, rates: [] } } };
const catalogue = upsertHistoricalCatalogueDay(null, capturedCore, null, source);
let serial = 0;
function fixture(inner: unknown = catalogue, coreSha = (++serial).toString(16).padStart(64, '0')) {
  const manifest = revisionManifest(1);
  manifest.files.core = { ...manifest.files.core, sha256: coreSha };
  delete manifest.files.core.enc;
  const envelope = { schema_version: 1, run_date: day, core_sha256: coreSha, catalogue: compressCatalogue(inner) };
  const text = JSON.stringify(envelope), raw = gzipSync(strToU8(text));
  attach(manifest, raw);
  return { manifest, envelope, raw, text };
}
function attach(manifest: Manifest, raw: Uint8Array, encrypted = false) {
  const hash = bytesToHex(sha256(raw));
  const name = `bank-rate-history-catalogue-${day}-${hash.slice(0, 12)}.json.gz${encrypted ? '.enc' : ''}`;
  const enc = { alg: 'aes-256-gcm', key_id: '12345678' };
  if (encrypted) manifest.files.core.enc = enc;
  manifest.bank_rate_history_catalogue = { schema_version: 1, file: { name, bytes: raw.length, sha256: hash,
    url: `https://github.com/${manifest.repo}/releases/download/${manifest.tag}/${name}`, ...(encrypted ? { enc } : {}) } };
  if (manifest.payload_revision) {
    const bundle = payloadBundleIdentity(manifest);
    manifest.payload_revision = { ...manifest.payload_revision, bundle_sha256: bundle, generation_id: `sha256-${bundle}` };
  }
}
function serve(value: ReturnType<typeof fixture>) {
  jest.mocked(downloadInflate).mockImplementation(async (_url, _sha, options) => {
    options!.onVerifiedBytes!(value.raw);
    return value.text;
  });
}
const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');
function stored(raw: Uint8Array) {
  jest.mocked(cache.readDetachedBankRateHistoryAsset).mockImplementation(async decode => decode(base64(raw)));
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(cache.readDetachedBankRateHistoryAsset).mockResolvedValue(null);
  jest.mocked(cache.writeDetachedBankRateHistoryAsset).mockResolvedValue(undefined);
  jest.mocked(isLocalAppHealthAudit).mockReturnValue(false);
  jest.mocked(resolvePayloadKeyHex).mockRejectedValue(new Error('No local key'));
  jest.mocked(yieldToUi).mockResolvedValue(undefined);
});

test('downloads once, verifies captured rates, caches exact bytes and memoizes the complete immutable receipt', async () => {
  const value = fixture(); serve(value);
  const result = await loadDetachedHistoricalBankRateCatalogue(value.manifest, { allowNetwork: true });
  expect(result).toEqual(catalogue);
  expect(downloadInflate).toHaveBeenCalledWith(value.manifest.bank_rate_history_catalogue!.file.url,
    value.manifest.bank_rate_history_catalogue!.file.sha256, expect.objectContaining({ expectedBytes: value.raw.length,
      requireExactBytes: true, expectedEncoding: 'gzip', maxCompressedBytes: DETACHED_HISTORY_MAX_COMPRESSED,
      maxInflatedBytes: DETACHED_HISTORY_MAX_DECODED }));
  expect(cache.writeDetachedBankRateHistoryAsset).toHaveBeenCalledWith(base64(value.raw), expect.any(Function));
  expect(await loadDetachedHistoricalBankRateCatalogue(value.manifest, { allowNetwork: false })).toBe(result);
  expect(downloadInflate).toHaveBeenCalledTimes(1);
  expect(cache.readDetachedBankRateHistoryAsset).toHaveBeenCalledTimes(1);
});

test('authenticates cached exact bytes and uses them offline without any transport', async () => {
  const value = fixture(); stored(value.raw);
  expect(await loadDetachedHistoricalBankRateCatalogue(value.manifest, { allowNetwork: false })).toEqual(catalogue);
  expect(downloadInflate).not.toHaveBeenCalled();
  expect(cache.writeDetachedBankRateHistoryAsset).not.toHaveBeenCalled();
});

test.each(['bundle', 'generation', 'descriptor'] as const)('rejects stale %s revision identity before cache or network access', async invalid => {
  const value = fixture();
  if (invalid === 'bundle') value.manifest.payload_revision!.bundle_sha256 = 'f'.repeat(64);
  if (invalid === 'generation') value.manifest.payload_revision!.generation_id = `sha256-${'f'.repeat(64)}`;
  if (invalid === 'descriptor') value.manifest.bank_rate_history_catalogue!.file.bytes++;
  expect(validateDetachedHistoricalCatalogueDescriptor(value.manifest)).not.toBeNull();
  expect(await loadDetachedHistoricalBankRateCatalogue(value.manifest, { allowNetwork: true })).toBeNull();
  expect(cache.readDetachedBankRateHistoryAsset).not.toHaveBeenCalled();
  expect(downloadInflate).not.toHaveBeenCalled();
});

test('a previously prepared asset cannot bypass a changed revision identity', async () => {
  const value = fixture(); serve(value);
  expect(await loadDetachedHistoricalBankRateCatalogue(value.manifest, { allowNetwork: true })).toEqual(catalogue);
  jest.clearAllMocks();
  value.manifest.payload_revision!.bundle_sha256 = 'f'.repeat(64);
  expect(await loadDetachedHistoricalBankRateCatalogue(value.manifest, { allowNetwork: true })).toBeNull();
  expect(cache.readDetachedBankRateHistoryAsset).not.toHaveBeenCalled();
  expect(downloadInflate).not.toHaveBeenCalled();
});

test('legacy payloads still authenticate the asset without revision metadata', async () => {
  const value = fixture(); delete value.manifest.payload_revision;
  value.manifest.tag = `app-payload-${day}`;
  attach(value.manifest, value.raw); stored(value.raw);
  expect(await loadDetachedHistoricalBankRateCatalogue(value.manifest, { allowNetwork: false })).toEqual(catalogue);
  expect(downloadInflate).not.toHaveBeenCalled();
});

test('a changed detached descriptor invalidates the prepared memo even when the core is unchanged', async () => {
  const first = fixture(); serve(first);
  const result = await loadDetachedHistoricalBankRateCatalogue(first.manifest, { allowNetwork: true });
  const second = fixture({ ...catalogue, sources: { [day]: { ...source, manifest_sha256: 'd'.repeat(64) } } }, first.manifest.files.core.sha256);
  serve(second);
  const changed = await loadDetachedHistoricalBankRateCatalogue(second.manifest, { allowNetwork: true });
  expect(changed).not.toBe(result);
  expect(changed?.sources[day]).toMatchObject({ manifest_sha256: 'd'.repeat(64) });
  expect(downloadInflate).toHaveBeenCalledTimes(2);
});

test.each(['tampered', 'wrong-length', 'truncated'] as const)('rejects %s cached bytes before exposing a catalogue', async corruption => {
  const value = fixture(), raw = value.raw.slice();
  if (corruption === 'tampered') raw[10] ^= 1;
  stored(corruption === 'truncated' ? raw.slice(0, -1) : corruption === 'wrong-length' ? new Uint8Array([...raw, 0]) : raw);
  expect(await loadDetachedHistoricalBankRateCatalogue(value.manifest, { allowNetwork: false })).toBeNull();
  expect(downloadInflate).not.toHaveBeenCalled();
});

test.each(['day', 'core', 'inner-hash', 'inner-bytes', 'inner-base64', 'schema', 'future', 'unknown-source'] as const)(
  'rejects an authenticated outer asset with invalid %s binding or catalogue', async invalid => {
    const value = fixture();
    if (invalid === 'day') value.envelope.run_date = '2026-01-01';
    if (invalid === 'core') value.envelope.core_sha256 = 'f'.repeat(64);
    if (invalid === 'inner-hash') value.envelope.catalogue.sha256 = 'f'.repeat(64);
    if (invalid === 'inner-bytes') value.envelope.catalogue.bytes++;
    if (invalid === 'inner-base64') value.envelope.catalogue.gzip_base64 = 'AB==';
    if (invalid === 'schema') value.envelope.catalogue = compressCatalogue({ ...catalogue, schema_version: 1 });
    if (invalid === 'future') value.envelope.catalogue = compressCatalogue({ schema_version: 2, run_dates: ['2099-01-01'],
      evidence: [{ status: 'unknown' }], sources: {}, unavailable_dates: {}, sections: { Mortgage: [], Savings: [], TD: [] } });
    if (invalid === 'unknown-source') value.envelope.catalogue = compressCatalogue({ ...catalogue, sources: { [day]: { kind: 'untrusted' } } });
    const text = JSON.stringify(value.envelope), raw = gzipSync(strToU8(text)); attach(value.manifest, raw); stored(raw);
    expect(await loadDetachedHistoricalBankRateCatalogue(value.manifest, { allowNetwork: false })).toBeNull();
    expect(downloadInflate).not.toHaveBeenCalled();
  },
);

test('does not cache unverified download callback bytes, even when decoded JSON looks valid', async () => {
  const value = fixture(); serve({ ...value, raw: new Uint8Array(value.raw.length) });
  expect(await loadDetachedHistoricalBankRateCatalogue(value.manifest, { allowNetwork: true })).toBeNull();
  expect(cache.writeDetachedBankRateHistoryAsset).not.toHaveBeenCalled();
});

test('a failed optional disk write preserves the verified prepared catalogue', async () => {
  const value = fixture(); serve(value);
  jest.mocked(cache.writeDetachedBankRateHistoryAsset).mockRejectedValue(new Error('disk full'));
  expect(await loadDetachedHistoricalBankRateCatalogue(value.manifest, { allowNetwork: true })).toEqual(catalogue);
});

test('an audit starting during the cache await prevents all subsequent transport', async () => {
  const value = fixture();
  jest.mocked(cache.readDetachedBankRateHistoryAsset).mockImplementation(async () => {
    jest.mocked(isLocalAppHealthAudit).mockReturnValue(true); return null;
  });
  expect(await loadDetachedHistoricalBankRateCatalogue(value.manifest, { allowNetwork: true })).toBeNull();
  expect(downloadInflate).not.toHaveBeenCalled();
});

test.each(['cache', 'download', 'decode'] as const)('cancellation during %s never installs or saves the detached result', async stage => {
  const value = fixture(); let current = true;
  if (stage === 'cache') jest.mocked(cache.readDetachedBankRateHistoryAsset).mockImplementation(async () => { current = false; return null; });
  else if (stage === 'download') jest.mocked(downloadInflate).mockImplementation(async (_url, _sha, opts) => {
    opts!.onVerifiedBytes!(value.raw); current = false; return value.text;
  });
  else { stored(value.raw); jest.mocked(yieldToUi).mockImplementation(async () => { current = false; }); }
  expect(await loadDetachedHistoricalBankRateCatalogue(value.manifest, { allowNetwork: true, isCurrent: () => current })).toBeNull();
  expect(cache.writeDetachedBankRateHistoryAsset).not.toHaveBeenCalled();
  if (stage !== 'download') expect(downloadInflate).not.toHaveBeenCalled();
});

test('cached ARE1 uses only the matching local key and falls back offline when the key is unavailable', async () => {
  const value = fixture(), key = new Uint8Array(32).fill(7), nonce = new Uint8Array(12).fill(4), magic = strToU8('ARE1');
  const ciphertext = gcm(key, nonce, magic).encrypt(value.raw), raw = new Uint8Array(16 + ciphertext.length);
  raw.set(magic); raw.set(nonce, 4); raw.set(ciphertext, 16); attach(value.manifest, raw, true); stored(raw);
  expect(await loadDetachedHistoricalBankRateCatalogue(value.manifest, { allowNetwork: false })).toBeNull();
  expect(resolvePayloadKeyHex).toHaveBeenCalledWith('12345678');
  expect(downloadInflate).not.toHaveBeenCalled();
  jest.mocked(resolvePayloadKeyHex).mockResolvedValue(bytesToHex(key));
  expect(await loadDetachedHistoricalBankRateCatalogue(value.manifest, { allowNetwork: false })).toEqual(catalogue);
  expect(downloadInflate).not.toHaveBeenCalled();
});

test.each(['namespace', 'path', 'origin', 'tag-date', 'bytes', 'sha', 'name', 'enc', 'misplaced'] as const)('rejects invalid %s descriptors before cache or network', async invalid => {
  const value = fixture(), file = value.manifest.bank_rate_history_catalogue!.file;
  if (invalid === 'namespace') Object.assign(value.manifest.bank_rate_history_catalogue!, { unknown: true });
  if (invalid === 'path') file.url += '?redirect=https://elsewhere.test';
  if (invalid === 'origin') file.url = file.url.replace('github.com', 'elsewhere.test');
  if (invalid === 'tag-date') { value.manifest.tag = 'app-payload-2026-01-01'; file.url = `https://github.com/${value.manifest.repo}/releases/download/${value.manifest.tag}/${file.name}`; }
  if (invalid === 'bytes') file.bytes = DETACHED_HISTORY_MAX_COMPRESSED + 1;
  if (invalid === 'sha') file.sha256 = 'bad';
  if (invalid === 'name') file.name = '../core.json.gz';
  if (invalid === 'enc') file.enc = { alg: 'other', key_id: '12345678' };
  if (invalid === 'misplaced') Object.assign(value.manifest.files, { bank_rate_history_catalogue: file });
  expect(validateDetachedHistoricalCatalogueDescriptor(value.manifest)).toBeNull();
  expect(await loadDetachedHistoricalBankRateCatalogue(value.manifest, { allowNetwork: true })).toBeNull();
  expect(cache.readDetachedBankRateHistoryAsset).not.toHaveBeenCalled();
  expect(downloadInflate).not.toHaveBeenCalled();
});

test('pure envelope validator enforces exact shape and declared inner budgets', () => {
  const value = fixture();
  expect(validateDetachedHistoricalCatalogueEnvelope(value.envelope, value.manifest)).toEqual(value.envelope.catalogue);
  expect(validateDetachedHistoricalCatalogueEnvelope({ ...value.envelope, extra: 1 }, value.manifest)).toBeNull();
  for (const bytes of [0, NaN, 0.5, 128 * 1024 * 1024 + 1]) expect(validateDetachedHistoricalCatalogueEnvelope({ ...value.envelope,
    catalogue: { ...value.envelope.catalogue, bytes } }, value.manifest)).toBeNull();
});

test('raw-byte codec preserves chunk boundaries and rejects noncanonical/oversized input cooperatively', async () => {
  const raw = new Uint8Array(50_003); for (let i = 0; i < raw.length; i++) raw[i] = i % 251;
  const work = jest.fn(async () => {});
  const encoded = await encodeDetachedHistoryBytes(raw, work);
  expect(encoded).toBe(base64(raw)); expect(await decodeDetachedHistoryBytes(encoded, work)).toEqual(raw);
  expect(work.mock.calls.length).toBeGreaterThan(3);
  for (const value of ['AB==', 'AAF=', 'AA==AAAA', '!!!!', 'AAAA\n']) expect(await decodeDetachedHistoryBytes(value, work)).toBeNull();
  await expect(encodeDetachedHistoryBytes(new Uint8Array(DETACHED_HISTORY_MAX_COMPRESSED + 1), work)).rejects.toThrow('budget');
  expect(strFromU8(gunzipSync(fixture().raw))).toContain('core_sha256');
});
