import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import facts from './fixtures/product-evidence-real-wire.json';
import { canonicalTermsJson } from '../src/data/productTerms';
import { EvidenceError } from '../src/data/productEvidenceWire';
import { reserveEvidence } from '../src/data/productEvidenceBudget';
import { createProductResponseReader } from '../src/data/productResponseTransport';
import { validateResponseIndex } from '../src/data/productResponseIndex';
import { RESPONSE_SCHEMA, RESPONSE_SCOPE, RESPONSE_LIMITS, validateResponseCapability, validateResponseEvent, responseUtf8,
  type ResponseBinding, type ResponseCapability, type ResponseIndex } from '../src/data/productResponseWire';

jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn() }));
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
// Captured product identity, with technical journal/absence controls only: no publication acceptance.
const factBinding = facts.prepared.capability.binding;
const oldIndex = JSON.parse(facts.assets[facts.prepared.capability.index.name as keyof typeof facts.assets]);
const identity = oldIndex.products[0].identity;
const binding: ResponseBinding = { facts: factBinding as ResponseBinding['facts'],
  journal: { session_id: 'test-retained', head_digest: 'a'.repeat(64), promotion_manifest_sha256: 'b'.repeat(64) }, scope: RESPONSE_SCOPE };
const index: ResponseIndex = { schema: RESPONSE_SCHEMA, binding, bodies: [], products: [{ identity, provider_uid: 'test-provider',
  state: 'missing', current_body_sha256: null, details: [], indexes: [], reasons: ['body_withheld_unresolved'], projection: 'known-exact-projections' }] };
const indexText = canonicalTermsJson(index), indexSha = bytesToHex(sha256(utf8ToBytes(indexText)));
const capability: ResponseCapability = { schema: RESPONSE_SCHEMA, binding, products: 1, bodies: 0, shards: [],
  index: { name: `product-response-index-${indexSha}.json.gz`, sha256: indexSha, bytes: 100, decoded_bytes: utf8ToBytes(indexText).length } };
const edition = { repo: 'yanniedog/AR-local' as const, tag: `app-payload-${binding.facts.source.observation_date}-r000001`, bundle_sha256: 'c'.repeat(64) };
function reader(overrides: Partial<Parameters<typeof createProductResponseReader>[0]> = {}) {
  const load = jest.fn(async () => indexText);
  return { load, value: createProductResponseReader({ capability, binding, edition, isCurrent: () => true, load, ...overrides }) };
}

test('captured identity with missing raw evidence remains explicitly unknown', async () => {
  validateResponseCapability(capability, binding); validateResponseIndex(index, capability);
  const { value, load } = reader();
  expect(await value.readProduct(identity.product_key)).toMatchObject({ status: 'unknown', reason: 'no_unique_current_body',
    route: { state: 'missing' }, absenceIsWithdrawal: false });
  expect(load).toHaveBeenCalledTimes(1);
});
test('absent product is unknown and cannot be read through an arbitrary body hash', async () => {
  expect(await reader().value.readProduct('not-observed')).toEqual({ status: 'unknown', reason: 'product_not_observed', route: null, absenceIsWithdrawal: false });
  await expect(reader().value.readProduct(identity.product_key, { bodySha: 'd'.repeat(64) })).rejects.toThrow('not declared');
});
test.each(['head_digest', 'promotion_manifest_sha256'] as const)('different journal %s fails before IO', field => {
  const changed = copy(binding); changed.journal[field] = 'e'.repeat(64);
  expect(() => reader({ binding: changed })).toThrow('mismatch');
});
test('fact/core/generation binding remains required', () => {
  const changed = copy(binding); changed.facts.core_sha256 = 'f'.repeat(64);
  expect(() => reader({ binding: changed })).toThrow('mismatch');
  expect(() => reader({ edition: { ...edition, tag: 'app-payload-latest' } })).toThrow('immutable');
});
test('deep unsupported descriptors reject before cloning', () => {
  let nested: unknown = null; for (let i = 0; i < 10000; i++) nested = [nested];
  expect(() => reader({ capability: { schema: 'ar-product-response-evidence-v2', future: nested } })).toThrow(EvidenceError);
  try { reader({ capability: { schema: 'ar-product-response-evidence-v2', future: nested } }); }
  catch (error) { expect((error as EvidenceError).code).toBe('unsupported'); }
});
test('metadata cannot claim a current response without a matched declared body', () => {
  const changed = copy(index); changed.products[0].state = 'matched'; changed.products[0].current_body_sha256 = 'd'.repeat(64);
  expect(() => validateResponseIndex(changed, capability)).toThrow('False current');
});
test('raw routing index accepts literal8MiB while every excess fails before acquisition', () => {
  expect(RESPONSE_LIMITS.index).toBe(8 * 1024 ** 2);
  const accepted = copy(capability); accepted.index.decoded_bytes = 8 * 1024 ** 2;
  expect(validateResponseCapability(accepted, binding)).toEqual(accepted);
  const rejected = copy(accepted); rejected.index.decoded_bytes++;
  const load = jest.fn();
  expect(() => reader({ capability: rejected, load })).toThrow('asset'); expect(load).not.toHaveBeenCalled();
  expect(RESPONSE_LIMITS.asset).toBe(4 * 1024 ** 2); expect(RESPONSE_LIMITS.compressed).toBe(1024 ** 2);
});
test('long provider/product identifiers remain representable when original evidence is missing', () => {
  const changed = copy(index);
  changed.products[0].identity.provider = 'p'.repeat(1024); changed.products[0].identity.product_id = 'i'.repeat(1024);
  expect(validateResponseIndex(changed, capability).products[0].state).toBe('missing');
});
test('response event metadata excludes headers and malformed instants/versions', () => {
  const event = { sequence: 1, event_digest: 'd'.repeat(64), phase: 'products_index', completed_at: '2026-11-14T01:00:00Z',
    request_version: 6, response_version: 6, provider: 'captured', provider_uid: 'uid', product_id: null };
  expect(validateResponseEvent(event)).toEqual(event);
  expect(() => validateResponseEvent({ ...event, headers: { authorization: 'withheld' } })).toThrow('Unexpected');
  expect(() => validateResponseEvent({ ...event, completed_at: '2026-02-30T01:00:00Z' })).toThrow('instant');
  expect(() => validateResponseEvent({ ...event, response_version: '6' })).toThrow('version');
});
test('unpaired surrogates cannot silently change the source byte stream', () => {
  expect(() => responseUtf8('\ud800')).toThrow('surrogate');
  expect(() => responseUtf8('\udc00')).toThrow('surrogate');
  expect(responseUtf8('😀')).toEqual(utf8ToBytes('😀'));
});
test('raw lane shares admission with the normalized lane and queued abort performs no IO', async () => {
  const release = await reserveEvidence();
  const abort = new AbortController(), { value, load } = reader();
  const pending = expect(value.readProduct(identity.product_key, { signal: abort.signal })).rejects.toMatchObject({ code: 'cancelled' });
  await Promise.resolve(); expect(load).not.toHaveBeenCalled(); abort.abort(); await pending; release();
  await expect(value.readProduct(identity.product_key)).resolves.toMatchObject({ status: 'unknown' });
});
test('abort or edition drift cannot accept an index', async () => {
  const abort = new AbortController(); abort.abort();
  const { value, load } = reader();
  await expect(value.readProduct(identity.product_key, { signal: abort.signal })).rejects.toMatchObject({ code: 'cancelled' });
  expect(load).not.toHaveBeenCalled();
  await expect(reader({ isCurrent: () => false }).value.readProduct(identity.product_key)).rejects.toMatchObject({ code: 'unavailable' });
});
test('failed reads are retryable without storing failed or stale evidence', async () => {
  const load = jest.fn(async () => indexText).mockRejectedValueOnce(new Error('offline'));
  const { value } = reader({ load });
  await expect(value.readProduct(identity.product_key)).rejects.toThrow('offline');
  await expect(value.readProduct(identity.product_key)).resolves.toMatchObject({ status: 'unknown' });
  expect(load).toHaveBeenCalledTimes(2);
});
test('production acquisition forwards immutable SHA and exact compressed/inflated bounds', async () => {
  const { downloadInflate } = jest.requireMock('../src/data/payload') as typeof import('../src/data/payload');
  const download = downloadInflate as jest.Mock; download.mockResolvedValue(indexText);
  const value = createProductResponseReader({ capability, binding, edition, isCurrent: () => true });
  await value.readProduct(identity.product_key);
  expect(download).toHaveBeenCalledWith(expect.stringContaining(edition.tag), indexSha,
    expect.objectContaining({ expectedBytes: capability.index.bytes, expectedInflatedBytes: capability.index.decoded_bytes,
      requireExactBytes: true, maxCompressedBytes: 1024 ** 2, maxInflatedBytes: 8 * 1024 ** 2, allowEncrypted: false }));
});
