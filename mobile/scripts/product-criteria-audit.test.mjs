import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { test } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { audit } = require('./audit-public-payload.cjs');
const { candidate, hash } = require('./product-evidence-audit-fixture.cjs');
const retained = require('../__tests__/fixtures/product-criteria-retained-20260519.json');
const pair = require('../__tests__/fixtures/product-criteria-wire-v2-real-20260519.json');

function criteria(p, mutate = () => {}) {
  const source = { generation_id: p.manifest.source_observation.generation_id, contract_digest: p.manifest.source_observation.contract_digest };
  const header = { schema_version: 1, run_date: p.manifest.run_date, source, scope: 'product-filter-facets-v1' };
  const products = structuredClone(retained.products), keys = Object.keys(products);
  const shard = { ...header, products };
  const index = { ...header, products: Object.fromEntries(keys.map(key => [key, 'product_criteria_shard_000'])),
    coverage: { productsExpected: keys.length, productsObserved: keys.length, complete: true } };
  mutate(index, shard);
  for (const [key, value] of [['product_criteria_index', index], ['product_criteria_shard_000', shard]]) {
    const bytes = gzipSync(JSON.stringify(value)), sha256 = hash(bytes), name = `${key}-${sha256}.json.gz`;
    p.manifest.files[key] = { name, bytes: bytes.length, sha256,
      url: `https://github.com/${p.manifest.repo}/releases/download/${p.manifest.tag}/${name}` };
    fs.writeFileSync(path.join(p.directory, name), bytes);
  }
  p.seal();
}
test('reports complete captured route accounting separately from legal, source-field and rendered coverage', async t => {
  const p = candidate(t); criteria(p);
  const report = await audit(p.options), result = report.optional_product_criteria;
  assert.equal(result.status, 'PASS'); assert.equal(result.scope, 'product-filter-facets-v1');
  assert.equal(result.products_expected, Object.keys(retained.products).length);
  assert.equal(result.products_observed, result.products_expected);
  assert.equal(result.product_routes_complete, true); assert.equal(result.source_current, true);
  assert.equal(result.legal_completeness_verified, false); assert.equal(result.rendered_coverage_verified, false);
  assert.equal(result.source_fields_complete, null); assert.equal(result.public_transport_verified, false);
  assert.ok(result.facet_kinds.fee > 0); assert.ok(result.facet_kinds.eligibility > 0);
});
test('mixed-source criteria fail even with freshly recomputed compressed hashes', async t => {
  const p = candidate(t); criteria(p, (_, shard) => { shard.source = { ...shard.source, contract_digest: 'f'.repeat(64) }; });
  const report = await audit(p.options);
  assert.equal(report.optional_product_criteria.status, 'FAIL'); assert.equal(report.status, 'FAIL');
  assert.equal(report.optional_product_criteria.product_routes_complete, false);
});
test('absence remains absent and does not rewrite base detail coverage metrics', async t => {
  const p = candidate(t), report = await audit(p.options);
  assert.equal(report.optional_product_criteria.status, 'ABSENT');
  assert.equal(report.optional_product_criteria.products_expected, null);
  assert.equal(report.optional_product_criteria.source_current, false);
  assert.equal(report.checks.some(check => check.code === 'optional-product-criteria'), false);
});
for (const malformed of [false, true]) test(`headless v2 uses the shipping compact decoder, malformed=${malformed}`, async t => {
  const p = candidate(t);
  criteria(p, (index, shard) => {
    index.schema_version = shard.schema_version = 2;
    index.products = Object.fromEntries(Object.keys(pair.products).map(key => [key, 'product_criteria_shard_000']));
    index.coverage.productsExpected = index.coverage.productsObserved = Object.keys(pair.products).length;
    Object.assign(shard, structuredClone(pair.encoded));
    if (malformed) shard.keyTable.push(shard.keyTable[0]);
  });
  const report = await audit(p.options), result = report.optional_product_criteria;
  assert.equal(result.status, malformed ? 'FAIL' : 'PASS');
  assert.equal(result.product_routes_complete, !malformed);
  if (!malformed) assert.equal(result.products_observed, Object.keys(pair.products).length);
});
