import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
const require = createRequire(import.meta.url);
const { verify } = require('./verify-observed-candidate.cjs');
const { payloadBundleIdentity } = require('../src/data/payloadBundleIdentity.ts');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
test('private fixture verifier binds actual asset bytes without network or installation', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ar-observed-fixture-'));
  try {
    const day = '2026-11-02', tag = `app-payload-observed-v1-${day}-r000001`;
    const core = { schema_version: 1, run_date: day, sections: { Mortgage: { rates: [] }, Savings: { rates: [] }, TD: { rates: [] } },
      coverage: { observed_on: day, observed_at: '2026-11-01T14:00:00Z', population_assessment: { schema_version: 1, scope: 'observed-products', observed_on: day,
        total_population: null, missing_product_count: null, observed_counts: { products: 0, rates: 0, providers: 0 },
        affected_providers: [{ provider_id: 'wise', provider_name: 'Wise', register_status: 'registered', membership_status: 'unknown',
          reason: 'register-endpoint-conflict', missing_product_count: null, register_url: 'https://register.example/', endpoint_url: 'https://wise.example/' }] } } };
    const files = Object.fromEntries(Object.entries({ core, details: { schema_version: 1, run_date: day, products: {} } }).map(([key, value]) => {
      const name = `${key}.json.gz`, bytes = gzipSync(JSON.stringify(value)); writeFileSync(path.join(dir, name), bytes);
      return [key, { name, bytes: bytes.length, sha256: digest(bytes), url: `https://github.com/yanniedog/AR-local/releases/download/${tag}/${name}` }];
    }));
    const manifest = { schema_version: 1, run_date: day, repo: 'yanniedog/AR-local', tag, consumer_contract: 'observed-population-v1', files,
      payload_revision: { schema_version: 1, revision: 1, generation_id: 'test-generation', bundle_sha256: '', parent_revision: null } };
    manifest.payload_revision.bundle_sha256 = payloadBundleIdentity(manifest);
    const text = JSON.stringify(manifest); writeFileSync(path.join(dir, 'manifest.json'), text);
    const index = { schema_version: 1, channel: 'observed-population-v1', revision_protocol: 1, dates: [day], count: 1, min_date: day, latest_date: day,
      revision_heads: { [day]: { revision: 1, generation_id: 'test-generation', manifest_url: `https://github.com/yanniedog/AR-local/releases/download/${tag}/manifest.json`,
        manifest_sha256: digest(text), bundle_sha256: manifest.payload_revision.bundle_sha256 } } };
    writeFileSync(path.join(dir, 'dates-index.json'), JSON.stringify(index));
    const report = verify(dir);
    assert.equal(report.listed_asset_bytes_verified, true); assert.equal(report.service_isolation_verified, false);
    assert.equal(report.detached_capabilities_verified, false);
    assert.equal(report.publication_verified, false); assert.equal(report.runtime_verified, false);
    assert.deepEqual(report.affected_provider_ids, ['wise']);
    writeFileSync(path.join(dir, 'details.json.gz'), gzipSync('{"run_date":"2026-10-31"}'));
    assert.throws(() => verify(dir), /hash\/length mismatch/);
  } finally {
    if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('ar-observed-fixture-')) throw Error('Unexpected fixture cleanup path');
    rmSync(dir, { recursive: true, force: true });
  }
});
