import pair from './fixtures/product-criteria-wire-v2-real-20260519.json';
import { revisionManifest } from '../testUtils/payloadRevision';
import { createProductCriteriaReader } from '../src/data/productCriteriaTransport';
import { acquireProductCriteria, CRITERIA_CACHE_LIMITS } from '../src/data/productCriteriaAcquisition';
import { downloadInflate } from '../src/data/payload';
import type { ManifestFile } from '../src/types';

jest.mock('../src/lib/yieldToUi', () => ({ yieldToUi: async () => undefined }));
jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn() }));
function controls(aliases = false) {
  const manifest = revisionManifest(1);
  manifest.source_observation = { generation_id: `obs-${manifest.run_date}-aaaaaaaaaaaaaaaa`, contract_digest: 'b'.repeat(64) };
  const source = { generation_id: manifest.source_observation.generation_id, contract_digest: manifest.source_observation.contract_digest };
  const header = { schema_version: 2, scope: 'product-filter-facets-v1', run_date: manifest.run_date, source };
  // Extra route aliases exercise only cache protocol bounds. Every fact/document
  // is unchanged captured data, and aliases are never acceptance product data.
  const products = aliases ? Object.fromEntries(Array.from({ length: CRITERIA_CACHE_LIMITS.products + 1 }, (_, i) =>
    [`protocol-route-${i}`, Object.values(pair.encoded.products)[0]])) : pair.encoded.products;
  const keys = Object.keys(products);
  const index = { ...header, products: Object.fromEntries(keys.map((key, i) => [key, i === keys.length - 1 ? 'product_criteria_shard_001' : 'product_criteria_shard_000'])),
    coverage: { complete: true, productsExpected: keys.length, productsObserved: keys.length } };
  const shards = ['product_criteria_shard_000', 'product_criteria_shard_001'].map(route => ({ ...header,
    keyTable: pair.encoded.keyTable, stringTable: pair.encoded.stringTable,
    products: Object.fromEntries(Object.entries(products).filter(([key]) => index.products[key] === route)) }));
  const bodies: Record<string, string> = Object.create(null);
  const files = manifest.files as Record<string, ManifestFile>;
  for (const [i, key] of ['product_criteria_index', 'product_criteria_shard_000', 'product_criteria_shard_001'].entries()) {
    const name = `${key}.json.gz`; bodies[name] = JSON.stringify(i ? shards[i - 1] : index);
    files[key] = { name, bytes: 40, sha256: String(i + 1).repeat(64),
      url: `https://github.com/${manifest.repo}/releases/download/${manifest.tag}/${name}` };
  }
  const load = jest.fn(async (file: ManifestFile) => bodies[file.name]);
  jest.mocked(downloadInflate).mockImplementation(async url => bodies[url.slice(url.lastIndexOf('/') + 1)]);
  return { manifest, keys, bodies, index, shards, load };
}
beforeEach(() => jest.mocked(downloadInflate).mockReset());

test('a product reads exactly the index and its shard, returning only that product', async () => {
  const p = controls();
  const result = await createProductCriteriaReader(p.manifest, { productKeys: [p.keys[0]], isCurrent: () => true, load: p.load }).read();
  expect(Object.keys(result)).toEqual([p.keys[0]]); expect(p.load).toHaveBeenCalledTimes(2);
  expect(result[p.keys[0]]).toEqual(pair.products[p.keys[0] as keyof typeof pair.products]);
});
test('full filtering validates every shard but discards documents in its retained lookup', async () => {
  const p = controls();
  const result = await createProductCriteriaReader(p.manifest, { retainDocuments: false, isCurrent: () => true, load: p.load }).read();
  expect(p.load).toHaveBeenCalledTimes(3); expect(Object.keys(result)).toHaveLength(p.keys.length);
  expect(Object.values(result).every(product => product.sourceDocuments === undefined)).toBe(true);
  expect(Object.values(result).reduce((n, product) => n + product.facts!.length, 0))
    .toBe(Object.values(pair.products).reduce((n, product) => n + product.facts.length, 0));
});
test.each(['missing-product', 'missing-shard-route', 'source'])('scoped verification rejects %s before adoption', async fault => {
  const p = controls();
  if (fault === 'missing-shard-route') delete p.shards[0].products[p.keys[1]];
  if (fault === 'source') p.shards[0].source = { ...p.shards[0].source, contract_digest: 'f'.repeat(64) };
  p.bodies['product_criteria_shard_000.json.gz'] = JSON.stringify(p.shards[0]);
  await expect(createProductCriteriaReader(p.manifest, { productKeys: [fault === 'missing-product' ? 'missing' : p.keys[0]],
    isCurrent: () => true, load: p.load }).read()).rejects.toThrow();
});
test('concurrent page/comparison requests share the index and identical product acquisition', async () => {
  const p = controls(), a = acquireProductCriteria(p.manifest, [p.keys[0]]), b = acquireProductCriteria(p.manifest, [p.keys[0]]);
  try {
    const [first, second] = await Promise.all([a.promise, b.promise]);
    expect(first[p.keys[0]]).toBe(second[p.keys[0]]); expect(downloadInflate).toHaveBeenCalledTimes(2);
  } finally { a.release(); b.release(); }
  const c = acquireProductCriteria(p.manifest, [p.keys.at(-1)!]);
  try { await c.promise; expect(downloadInflate).toHaveBeenCalledTimes(3); } finally { c.release(); }
});
test('LRU bounds completed product lookups while preserving a shared index', async () => {
  const p = controls(true);
  for (const key of p.keys) { const lease = acquireProductCriteria(p.manifest, [key]); try { await lease.promise; } finally { lease.release(); } }
  const before = jest.mocked(downloadInflate).mock.calls.length, first = acquireProductCriteria(p.manifest, [p.keys[0]]);
  try { await first.promise; expect(downloadInflate).toHaveBeenCalledTimes(before + 1); } finally { first.release(); }
});
test('different products in the same shard share in-flight shard bytes', async () => {
  const p = controls(), lease = acquireProductCriteria(p.manifest, p.keys.slice(0, 2));
  try { expect(Object.keys(await lease.promise)).toHaveLength(2); expect(downloadInflate).toHaveBeenCalledTimes(2); }
  finally { lease.release(); }
});
test('pending request capacity is bounded and cancelled requests never adopt the delayed response', async () => {
  const p = controls(true); let finish!: (text: string) => void;
  jest.mocked(downloadInflate).mockImplementationOnce(async () => new Promise<string>(resolve => { finish = resolve; }));
  const leases = p.keys.map(key => acquireProductCriteria(p.manifest, [key]));
  const outcomes = Promise.allSettled(leases.map(lease => lease.promise));
  await new Promise(resolve => setImmediate(resolve));
  const excess = acquireProductCriteria(p.manifest, ['capacity-control']);
  try { await expect(excess.promise).rejects.toThrow('capacity'); } finally { excess.release(); }
  leases.forEach(lease => lease.release()); finish(p.bodies['product_criteria_index.json.gz']);
  expect((await outcomes).every(outcome => outcome.status === 'rejected')).toBe(true);
});
test('last release cancels shared acquisition, whereas another live subscriber keeps it current', async () => {
  const p = controls(); let finish!: (text: string) => void;
  jest.mocked(downloadInflate).mockImplementationOnce(async () => new Promise<string>(resolve => { finish = resolve; }));
  const a = acquireProductCriteria(p.manifest, [p.keys[0]]), b = acquireProductCriteria(p.manifest, [p.keys[0]]);
  await new Promise(resolve => setImmediate(resolve)); a.release();
  const signal = jest.mocked(downloadInflate).mock.calls[0][2]!.signal!;
  expect(signal.aborted).toBe(false); b.release(); expect(signal.aborted).toBe(true);
  const outcomes = Promise.allSettled([a.promise, b.promise]); finish(p.bodies['product_criteria_index.json.gz']);
  expect((await outcomes).every(outcome => outcome.status === 'rejected')).toBe(true);
});
test('changing source binding on the same manifest object invalidates the old completed cache', async () => {
  const p = controls(), first = acquireProductCriteria(p.manifest, [p.keys[0]]);
  try { await first.promise; } finally { first.release(); }
  p.manifest.source_observation!.contract_digest = 'f'.repeat(64);
  const next = acquireProductCriteria(p.manifest, [p.keys[0]]);
  try { await expect(next.promise).rejects.toThrow('index'); expect(downloadInflate).toHaveBeenCalledTimes(3); } finally { next.release(); }
});
