import retained from './fixtures/product-criteria-retained-20260519.json';
import pair from './fixtures/product-criteria-wire-v2-real-20260519.json';
import { createProductCriteriaReader } from '../src/data/productCriteriaTransport';
import { revisionManifest } from '../testUtils/payloadRevision';
import type { ManifestFile } from '../src/types';

jest.mock('../src/lib/yieldToUi', () => ({ yieldToUi: async () => undefined }));
function controls() {
  const manifest = revisionManifest(1);
  manifest.source_observation = { generation_id: `obs-${manifest.run_date}-aaaaaaaaaaaaaaaa`, contract_digest: 'b'.repeat(64) };
  const source = { generation_id: manifest.source_observation!.generation_id!, contract_digest: manifest.source_observation!.contract_digest! };
  const products = JSON.parse(JSON.stringify(retained.products)) as typeof retained.products;
  const keys = Object.keys(products);
  const index = { schema_version: 1, scope: 'product-filter-facets-v1', run_date: manifest.run_date, source,
    products: Object.fromEntries(keys.map(key => [key, 'product_criteria_shard_000'])),
    coverage: { productsExpected: keys.length, productsObserved: keys.length, complete: true } };
  const shard = { schema_version: 1, scope: 'product-filter-facets-v1', run_date: manifest.run_date, source, products };
  const bodies = { 'criteria-index.json.gz': JSON.stringify(index), 'criteria-shard.json.gz': JSON.stringify(shard) };
  const files = manifest.files as Record<string, ManifestFile>;
  files.product_criteria_index = { name: 'criteria-index.json.gz', bytes: 40, sha256: 'c'.repeat(64),
    url: `https://github.com/${manifest.repo}/releases/download/${manifest.tag}/criteria-index.json.gz` };
  files.product_criteria_shard_000 = { name: 'criteria-shard.json.gz', bytes: 40, sha256: 'd'.repeat(64),
    url: `https://github.com/${manifest.repo}/releases/download/${manifest.tag}/criteria-shard.json.gz` };
  return { manifest, index, shard, bodies, load: jest.fn(async (file: ManifestFile) => bodies[file.name as keyof typeof bodies]) };
}
test.each([false, true])('transport adopts the exact retained v2 semantics and rejects mixed versions=%s', async mixed => {
  const c = controls();
  c.bodies['criteria-index.json.gz'] = JSON.stringify({ ...c.index, schema_version: 2,
    products: Object.fromEntries(Object.keys(pair.products).map(key => [key, 'product_criteria_shard_000'])) });
  c.bodies['criteria-shard.json.gz'] = JSON.stringify({ ...c.shard, schema_version: mixed ? 1 : 2, ...pair.encoded });
  const result = createProductCriteriaReader(c.manifest, { isCurrent: () => true, load: c.load }).read();
  if (mixed) await expect(result).rejects.toThrow();
  else await expect(result).resolves.toEqual(pair.products);
});
test('loads all routed retained fact groups without changing the bound details', async () => {
  const c = controls(), before = JSON.stringify(c.manifest);
  const result = await createProductCriteriaReader(c.manifest, { isCurrent: () => true, load: c.load }).read();
  expect(result).toEqual(retained.products);
  expect(c.load).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(c.manifest)).toBe(before);
});
test.each(['source', 'route', 'coverage', 'invalid-fact', 'extra-product'])('rejects %s instead of exposing a partial filter inventory', async fault => {
  const c = controls();
  if (fault === 'source') c.shard.source = { ...c.shard.source, contract_digest: 'e'.repeat(64) };
  if (fault === 'route') delete c.shard.products[Object.keys(c.shard.products)[0] as keyof typeof c.shard.products];
  if (fault === 'coverage') c.index.coverage.productsObserved--;
  if (fault === 'invalid-fact') c.shard.products[Object.keys(c.shard.products)[0] as keyof typeof c.shard.products].facts[0].id = '';
  if (fault === 'extra-product') Object.assign(c.shard.products, { foreign: { facts: [] } });
  c.bodies['criteria-index.json.gz'] = JSON.stringify(c.index); c.bodies['criteria-shard.json.gz'] = JSON.stringify(c.shard);
  await expect(createProductCriteriaReader(c.manifest, { isCurrent: () => true, load: c.load }).read()).rejects.toThrow();
});
test('refuses foreign release URLs and cancels after an edition changes', async () => {
  const c = controls(); (c.manifest.files as Record<string, ManifestFile>).product_criteria_shard_000.url = 'https://attacker.test/file';
  await expect(createProductCriteriaReader(c.manifest, { isCurrent: () => true, load: c.load }).read()).rejects.toThrow('descriptor');
  const next = controls(); let current = true;
  const reader = createProductCriteriaReader(next.manifest, { isCurrent: () => current,
    load: async file => { const body = await next.load(file); current = false; return body; } });
  await expect(reader.read()).rejects.toThrow('edition');
});
test('refuses an unreferenced reserved shard descriptor', async () => {
  const c = controls(); const files = c.manifest.files as Record<string, ManifestFile>;
  files.product_criteria_shard_001 = { ...files.product_criteria_shard_000, name: 'extra.json.gz' };
  await expect(createProductCriteriaReader(c.manifest, { isCurrent: () => true, load: c.load }).read()).rejects.toThrow('Extraneous');
});
test.each(['evidenceState', 'sourcePath', 'sourcePathBasis', 'decimal-number'])(
  'rejects malformed new criterion %s instead of silently treating it as observed', async fault => {
    const c = controls();
    const detail = Object.values(c.shard.products).find(product => product.facts.some(fact => 'criteriaVersion' in fact))!;
    const fact = detail.facts.find(value => 'criteriaVersion' in value) as Record<string, unknown>;
    if (fault === 'decimal-number') { fact.valueType = 'decimal'; fact.value = 9007199254740993; }
    else delete fact[fault];
    c.bodies['criteria-shard.json.gz'] = JSON.stringify(c.shard);
    await expect(createProductCriteriaReader(c.manifest, { isCurrent: () => true, load: c.load }).read()).rejects.toThrow('facts');
  });
