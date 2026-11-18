import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import fixture from './fixtures/product-evidence-real-wire.json';
import responses from './fixtures/product-response-real-wire.json';
import type { Manifest } from '../src/types';
import { payloadBundleIdentity } from '../src/data/payloadBundleIdentity';
import { canonicalTermsJson } from '../src/data/productTerms';
import { downloadInflate } from '../src/data/payload';
import { reserveEvidence } from '../src/data/productEvidenceBudget';
import { validateEvidencePublication, validateDetachedCapability, checkCommonEvidenceBinding,
  type EvidenceLane, type EvidenceReference } from '../src/data/productEvidencePublication';
import { createPublishedProductEvidence } from '../src/data/productEvidencePublicationTransport';
import type { EvidenceCapability } from '../src/data/productEvidenceWire';
import type { ResponseCapability } from '../src/data/productResponseWire';

jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn() }));
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const facts = fixture.prepared.capability as EvidenceCapability;
const raw = responses.prepared.capability as ResponseCapability;
const SHA = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
let counter = 0;
function setup(lane: EvidenceLane = 'product_evidence_v1', capability: EvidenceCapability | ResponseCapability = facts) {
  const binding = 'facts' in capability.binding ? capability.binding.facts : capability.binding;
  const { generation_id, observation_date, observation_state, contract_digest } = binding.source;
  const source = { generation_id, observation_date, observation_state, contract_digest };
  const text = canonicalTermsJson(capability), compressed = gzipSync(text), sha = SHA(compressed);
  const family = lane === 'product_evidence_v1' ? 'product-evidence' : 'product-response';
  const ref: EvidenceReference = { schema: lane === 'product_evidence_v1' ? 'ar-product-evidence-reference-v1' : 'ar-product-response-evidence-reference-v1',
    source, core_sha256: binding.core_sha256, details_sha256: binding.details_sha256,
    capability: { name: `${family}-capability-${sha}.json.gz`, sha256: sha, bytes: compressed.length, decoded_bytes: Buffer.byteLength(text) } };
  const date = observation_date, tag = `app-payload-${date}-r000001`, prefix = `https://github.com/yanniedog/AR-local/releases/download/${tag}/`;
  const manifest = { schema_version: 1, run_date: date, repo: 'yanniedog/AR-local', tag, generated_at: `${date}T12:00:00Z`,
    app_min_version: '1.0.0', counts: { testProtocolNonce: ++counter }, schedule: { label: 'Daily' }, source_observation: source,
    files: { core: { name: 'core.json.gz', bytes: 10, sha256: binding.core_sha256, url: prefix + 'core.json.gz' },
      details: { name: 'details.json.gz', bytes: 10, sha256: binding.details_sha256, url: prefix + 'details.json.gz' } }, [lane]: ref } as Manifest;
  function seal() {
    const bundle = payloadBundleIdentity(manifest);
    manifest.payload_revision = { schema_version: 1, revision: 1, generation_id: `sha256-${bundle}`, bundle_sha256: bundle, parent_revision: null };
    return { revision: 1, generation_id: `sha256-${bundle}`, manifest_url: prefix + 'manifest.json', manifest_sha256: SHA(canonicalTermsJson(manifest)), bundle_sha256: bundle };
  }
  const selected = seal(), assets = (lane === 'product_evidence_v1' ? fixture.assets : responses.assets) as Record<string, string>;
  const key = (JSON.parse(assets[capability.index.name]) as { products: { identity: { product_key: string }; state?: string }[] }).products
    .find(item => lane === 'product_evidence_v1' || item.state === 'matched')!.identity.product_key;
  const loadCapability = jest.fn(async () => text), load = jest.fn(async (_url: string, descriptor: { name: string }) => assets[descriptor.name]);
  return { manifest, selected, seal, ref, text, key, loadCapability, load,
    create: (extra: Partial<Parameters<typeof createPublishedProductEvidence>[0]> = {}) => createPublishedProductEvidence({
      manifest, selected, isCurrent: () => true, loadCapability, loadFacts: load, loadResponse: load, ...extra }) };
}

test('real captured normalized facts load only after explicit read through a detached capability', async () => {
  const p = setup(), reader = p.create();
  expect(p.loadCapability).not.toHaveBeenCalled(); expect(p.load).not.toHaveBeenCalled();
  const result = await reader.readFacts(p.key);
  expect(result.status).toBe('observed'); expect(p.loadCapability).toHaveBeenCalledTimes(1);
  expect(p.loadCapability.mock.calls[0]).toHaveLength(3);
  await reader.readFacts(p.key); expect(p.loadCapability).toHaveBeenCalledTimes(1);
});
test('real original response survives detached acquisition unchanged', async () => {
  const p = setup('product_response_evidence_v1', raw), result = await p.create().readResponse(p.key);
  expect(result.status).toBe('observed');
  if (result.status === 'observed') expect(result.text).toBe(responses.original_bodies[p.key as keyof typeof responses.original_bodies]);
});
test.each(['absent', 'unsupported'])('%s reference never downloads or claims zero facts', async state => {
  const p = setup();
  if (state === 'absent') delete (p.manifest as unknown as Record<string, unknown>).product_evidence_v1;
  else p.ref.schema = 'ar-product-evidence-reference-v999';
  p.selected = p.seal();
  const reader = p.create({ selected: p.selected });
  await expect(reader.readFacts(p.key)).resolves.toEqual({ status: state === 'absent' ? 'unavailable' : 'unsupported', absenceIsWithdrawal: false });
  expect(p.loadCapability).not.toHaveBeenCalled();
});
test.each(['generation_id', 'observation_date', 'observation_state', 'contract_digest'])('source %s mismatch fails without IO', key => {
  const p = setup(); (p.manifest.source_observation as Record<string, unknown>)[key] = 'different';
  // Reference source is deliberately a separate decoded object, as on the wire.
  p.ref.source = { generation_id: facts.binding.source.generation_id, observation_date: facts.binding.source.observation_date,
    observation_state: facts.binding.source.observation_state, contract_digest: facts.binding.source.contract_digest };
  expect(() => p.create({ selected: p.seal() })).toThrow(); expect(p.loadCapability).not.toHaveBeenCalled();
});
test.each(['core_sha256', 'details_sha256'])('reference %s cannot borrow another edition', key => {
  const p = setup(); p.ref[key as 'core_sha256'] = 'd'.repeat(64);
  expect(() => p.create({ selected: p.seal() })).toThrow('asset mismatch');
});
test('selected bundle is checked independently of reference self-consistency', () => {
  const p = setup(); p.manifest.counts.extra = 1;
  expect(() => p.create()).toThrow('bundle mismatch');
});
test('revision outside the managed immutable route cannot fall back to direct GitHub', () => {
  const p = setup(), tag = `app-payload-${p.manifest.run_date}-r1000000`;
  p.manifest.tag = tag; p.manifest.payload_revision!.revision = 1000000;
  const selected = { ...p.selected, revision: 1000000,
    manifest_url: `https://github.com/yanniedog/AR-local/releases/download/${tag}/manifest.json` };
  expect(() => p.create({ selected })).toThrow('route limit');
});
test('literal capability byte boundary is accepted, excess fails before IO', () => {
  const p = setup(); p.ref.capability.bytes = p.ref.capability.decoded_bytes = 65536;
  expect(() => p.create({ selected: p.seal() })).not.toThrow();
  for (const key of ['bytes', 'decoded_bytes'] as const) {
    p.ref.capability[key] = 65537;
    expect(() => p.create({ selected: p.seal() })).toThrow('descriptor'); p.ref.capability[key] = 65536;
  }
});
test('manifest exact 64 KiB limit is shared, and deep unknown input is bounded before canonicalization', () => {
  const p = setup(), m = p.manifest as unknown as Record<string, unknown>; m.padding = '';
  p.seal(); m.padding = 'x'.repeat(65536 - Buffer.byteLength(JSON.stringify(m)));
  const head = p.seal(); expect(Buffer.byteLength(JSON.stringify(m))).toBe(65536);
  expect(() => validateEvidencePublication(p.manifest, head)).not.toThrow();
  m.padding += 'x'; expect(() => validateEvidencePublication(p.manifest, head)).toThrow('64 KiB');
  const deep = setup(); let nest: unknown = null; for (let i = 0; i < 10000; i++) nest = { child: nest };
  (deep.manifest as unknown as Record<string, unknown>).future = nest;
  expect(() => deep.create()).toThrow('complexity');
});
test('misplaced eager files and invalid filenames cannot acquire evidence', () => {
  const p = setup(); p.manifest.files.search_index = { ...p.manifest.files.core, name: p.ref.capability.name,
    url: p.selected.manifest_url.replace('manifest.json', p.ref.capability.name) };
  expect(() => p.create({ selected: p.seal() })).toThrow('Misplaced');
  const q = setup(); q.ref.capability.name = '../capability.json.gz';
  expect(() => q.create({ selected: q.seal() })).toThrow('descriptor');
});
test('sparse arrays and oversized text are rejected before serialization or UTF8 copies', () => {
  for (const future of [new Array(1000000000), new Array(8), 'x'.repeat(65537)]) {
    const p = setup(); (p.manifest as unknown as Record<string, unknown>).future = future;
    expect(() => p.create()).toThrow(/array|dense|string/);
    expect(p.loadCapability).not.toHaveBeenCalled();
  }
});
test('detached source binding cannot be justified by its own hashes', () => {
  const p = setup(), changed = copy(facts); changed.binding.source.contract_digest = 'f'.repeat(64);
  expect(() => validateDetachedCapability(changed, 'product_evidence_v1', p.ref)).toThrow('selected binding');
  const mixed = copy(raw); mixed.binding.facts = { ...facts.binding, snapshot_sha256: 'a'.repeat(64) };
  expect(() => checkCommonEvidenceBinding(facts, mixed)).toThrow('different source snapshots');
});
test('future detached capability reports unsupported explicitly', () => {
  const p = setup(); expect(() => validateDetachedCapability({ schema: 'future' }, 'product_evidence_v1', p.ref)).toThrow('version unsupported');
});
test('failed capability is not cached and explicit retry works', async () => {
  const p = setup(); p.loadCapability.mockRejectedValueOnce(new Error('network failed'));
  const reader = p.create(); await expect(reader.readFacts(p.key)).rejects.toThrow('network failed');
  expect((await reader.readFacts(p.key)).status).toBe('observed'); expect(p.loadCapability).toHaveBeenCalledTimes(2);
});
test('capability decoding size and canonical JSON are verified before reader IO', async () => {
  const p = setup(); p.loadCapability.mockResolvedValue(p.text + ' ');
  await expect(p.create().readFacts(p.key)).rejects.toThrow('decoded size'); expect(p.load).not.toHaveBeenCalled();
});
test('edition change or cancellation during capability acquisition cannot install a result', async () => {
  for (const abort of [false, true]) {
    const p = setup(), controller = new AbortController(); let active = true;
    p.loadCapability.mockImplementation(async () => { if (abort) controller.abort(); else active = false; return p.text; });
    await expect(p.create({ isCurrent: () => active }).readFacts(p.key, controller.signal)).rejects.toThrow(abort ? 'cancelled' : 'edition changed');
    expect(p.load).not.toHaveBeenCalled();
  }
});
test('a queued cancelled caller neither downloads nor cancels a following caller', async () => {
  const p = setup(), controller = new AbortController(), release = await reserveEvidence();
  const pending = p.create().readFacts(p.key, controller.signal);
  const rejected = expect(pending).rejects.toThrow('cancelled'); controller.abort(); await rejected; release();
  expect(p.loadCapability).not.toHaveBeenCalled(); expect((await p.create().readFacts(p.key)).status).toBe('observed');
});
test('concurrent calls share verified capability without a nested reservation deadlock', async () => {
  const p = setup(), reader = p.create();
  const results = await Promise.all([reader.readFacts(p.key), reader.readFacts(p.key)]);
  expect(results.every(result => result.status === 'observed')).toBe(true); expect(p.loadCapability).toHaveBeenCalledTimes(1);
});
test('only two small capabilities are cached across all editions', async () => {
  const p = setup(), q = setup(), r = setup();
  await p.create().readFacts(p.key); await q.create().readFacts(q.key); await r.create().readFacts(r.key); await p.create().readFacts(p.key);
  expect(p.loadCapability).toHaveBeenCalledTimes(2);
});
test('caller mutation after creation cannot change pinned reference or manifest', async () => {
  const p = setup(), reader = p.create();
  p.ref.capability.name = 'changed'; p.manifest.run_date = '2000-01-01';
  const status = reader.references.product_evidence_v1;
  if (status.status === 'declared') status.reference.capability.name = 'also changed';
  expect((await reader.readFacts(p.key)).status).toBe('observed');
});
test('production detached loader retains ARE2 service path and exact domain limits', async () => {
  const p = setup(); jest.mocked(downloadInflate).mockResolvedValue(p.text);
  const reader = p.create({ loadCapability: undefined }); await reader.readFacts(p.key);
  expect(downloadInflate).toHaveBeenCalledWith(expect.stringContaining('/releases/download/app-payload-'), p.ref.capability.sha256,
    expect.objectContaining({ requireExactBytes: true, expectedEncoding: 'gzip', allowEncrypted: false,
      expectedBytes: p.ref.capability.bytes, expectedInflatedBytes: p.ref.capability.decoded_bytes,
      maxCompressedBytes: 65536, maxInflatedBytes: 65536 }));
});
