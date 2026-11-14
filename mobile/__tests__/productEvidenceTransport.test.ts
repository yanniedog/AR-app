import fixture from './fixtures/product-evidence-real-wire.json';
import { canonicalTermsJson } from '../src/data/productTerms';
import { createProductEvidenceReader, type EvidenceEdition } from '../src/data/productEvidenceTransport';
import { EvidenceError, parseEvidenceJson, validateEvidenceCapability, validateEvidenceIndex, validateEvidenceShard,
  type EvidenceBinding, type EvidenceCapability } from '../src/data/productEvidenceWire';

jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn() }));
const assets = fixture.assets as Record<string, string>;
const capability = fixture.prepared.capability as EvidenceCapability;
const binding = capability.binding;
const edition: EvidenceEdition = { repo: 'yanniedog/AR-local', tag: `app-payload-${binding.source.observation_date}-r000001`, bundle_sha256: 'c'.repeat(64) };
const index = validateEvidenceIndex(JSON.parse(assets[capability.index.name]) as unknown, capability);
const key = index.products[0].identity.product_key;
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function reader(overrides: Partial<Parameters<typeof createProductEvidenceReader>[0]> = {}) {
  const load = jest.fn(async (_url, asset) => assets[asset.name]);
  return { load, value: createProductEvidenceReader({ capability, binding, edition, isCurrent: () => true, load, ...overrides }) };
}

test('Python-produced real captured facts validate and acquire only selected product shards', async () => {
  expect(validateEvidenceCapability(capability, binding)).toEqual(capability);
  const { value, load } = reader();
  const actual = await value.readProduct(key);
  expect(actual.status).toBe('observed');
  if (actual.status !== 'observed') throw new Error('missing captured facts');
  const route = index.products[0];
  const selected = new Set(route.pages.map(page => page.shard));
  expect(load).toHaveBeenCalledTimes(1 + selected.size);
  expect(selected.size).toBeLessThan(capability.shards.length);
  const expected = route.pages.flatMap(page => {
    const descriptor = capability.shards.find(shard => shard.sha256 === page.shard)!;
    return validateEvidenceShard(JSON.parse(assets[descriptor.name]) as unknown, capability).pages[page.page].facts;
  });
  expect(actual.facts).toEqual(expected);
  expect(actual.facts).toHaveLength(route.facts);
  expect(actual.binding).toEqual(binding);
  expect(actual.originalBodyIncluded).toBe(false);
  expect(actual.renderedCoverageVerified).toBe(false);
  for (const [url, descriptor] of load.mock.calls) expect(url).toBe(`https://github.com/yanniedog/AR-local/releases/download/${edition.tag}/${descriptor.name}`);
});

test('absent product means unknown and does not download shards', async () => {
  const { value, load } = reader();
  expect(await value.readProduct('not-observed')).toEqual({ status: 'unknown', reason: 'product_not_observed', absenceIsWithdrawal: false });
  expect(load).toHaveBeenCalledTimes(1);
});

test.each(['core_sha256', 'details_sha256', 'snapshot_sha256'] as const)('rejects different %s before acquisition', field => {
  const mismatch = copy(binding); mismatch[field] = 'f'.repeat(64);
  expect(() => reader({ binding: mismatch })).toThrow('mismatch');
});

test.each(['generation_id', 'observation_date', 'contract_digest'] as const)('rejects detached source %s', field => {
  const mismatch = copy(binding);
  mismatch.source[field] = field === 'observation_date' ? '2026-05-20' : field === 'generation_id' ? 'obs-2026-05-19-0000000000000000' : 'd'.repeat(64);
  expect(() => reader({ binding: mismatch })).toThrow();
});

test('unsupported namespace is an explicit unsupported error', () => {
  expect(() => reader({ capability: { ...capability, schema: 'ar-product-evidence-delivery-v2', future: true } })).toThrow(EvidenceError);
  try { reader({ capability: { ...capability, schema: 'ar-product-evidence-delivery-v2' } }); }
  catch (error) { expect((error as EvidenceError).code).toBe('unsupported'); }
});

test('download failure is retryable and never supplies stale partial facts', async () => {
  const load = jest.fn(async (_url, descriptor) => assets[descriptor.name]).mockRejectedValueOnce(new Error('offline'));
  const { value } = reader({ load });
  await expect(value.readProduct(key)).rejects.toThrow('offline');
  await expect(value.readProduct(key)).resolves.toMatchObject({ status: 'observed' });
  expect(load.mock.calls.filter(([, descriptor]) => descriptor.name === capability.index.name)).toHaveLength(2);
});

test('aborted request cannot install a decoded routing index', async () => {
  const controller = new AbortController();
  const load = jest.fn(async (_url, descriptor) => { controller.abort(); return assets[descriptor.name]; });
  const { value } = reader({ load });
  await expect(value.readProduct(key, controller.signal)).rejects.toMatchObject({ code: 'cancelled' });
  expect(load).toHaveBeenCalledTimes(1);
});

test('edition changes mid-acquisition stop before further downloads', async () => {
  let current = true;
  const load = jest.fn(async (_url, descriptor) => { current = false; return assets[descriptor.name]; });
  const { value } = reader({ load, isCurrent: () => current });
  await expect(value.readProduct(key)).rejects.toMatchObject({ code: 'unavailable' });
  expect(load).toHaveBeenCalledTimes(1);
});

test('same-length page identity corruption is refused', async () => {
  const load = jest.fn(async (_url, descriptor) => {
    if (descriptor.name === capability.index.name) return assets[descriptor.name];
    const changed = JSON.parse(assets[descriptor.name]);
    changed.pages.forEach((page: { identity: { product_id: string } }) => { page.identity.product_id = 'x' + page.identity.product_id.slice(1); });
    return canonicalTermsJson(changed);
  });
  await expect(reader({ load }).value.readProduct(key)).rejects.toThrow('identity/count mismatch');
});

test('index counts and across-shard product budgets cannot be bypassed', () => {
  const altered = copy(index); altered.products[0].facts++;
  expect(() => validateEvidenceIndex(altered, capability)).toThrow('count mismatch');
  const heavy = copy(capability);
  heavy.shards.forEach(shard => { shard.decoded_bytes = 4 * 1024 ** 2; });
  // Repeat unique shard routes sufficiently to exceed one product's aggregate ceiling.
  const routed = copy(index), product = routed.products[0];
  for (let i = heavy.shards.length; i < 22; i++) {
    const shard = { ...heavy.shards[0], sha256: i.toString(16).padStart(64, '0') };
    shard.name = `product-evidence-shard-${shard.sha256}.json.gz`; heavy.shards.push(shard);
    product.pages.push({ shard: shard.sha256, page: 0, facts: 1 }); product.facts++; heavy.facts++;
  }
  expect(() => validateEvidenceIndex(routed, heavy)).toThrow('cumulative');
});

test('duplicate outer JSON and inflated overruns fail', () => {
  expect(() => parseEvidenceJson('{"a":1,"a":1}', 100)).toThrow('not canonical');
  expect(() => parseEvidenceJson('{}', 1)).toThrow('exceeds');
});

test('source numeric JSON text stays exact without JavaScript reserialization', () => {
  const shard = JSON.parse(assets[capability.shards[0].name]);
  shard.pages[0].facts[0].source_value_json = '9007199254740993';
  const result = validateEvidenceShard(shard, capability);
  expect(result.pages[0].facts[0].source_value_json).toBe('9007199254740993');
});

test('default production IO enforces hash, exact sizes, inflation and cancellation', async () => {
  const { downloadInflate } = jest.requireMock('../src/data/payload') as typeof import('../src/data/payload');
  const download = downloadInflate as jest.Mock;
  download.mockImplementation(async (_url, _sha, opts) => assets[opts.fileName]);
  const signal = new AbortController().signal;
  const value = createProductEvidenceReader({ capability, binding: binding as EvidenceBinding, edition, isCurrent: () => true });
  await value.readProduct(key, signal);
  expect(download.mock.calls[0][1]).toBe(capability.index.sha256);
  expect(download.mock.calls[0][2]).toMatchObject({ signal, requireExactBytes: true, expectedEncoding: 'gzip', allowEncrypted: false,
    expectedBytes: capability.index.bytes, expectedInflatedBytes: capability.index.decoded_bytes, maxInflatedBytes: 4 * 1024 ** 2 });
});
