import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const { audit, options } = require('./audit-public-payload.cjs');
const { payloadBundleIdentity } = require('../src/data/payloadBundleIdentity.ts');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function candidate(t, mutateShard = value => value, splitDiscovery = false, mutateDiscovery = value => value) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-public-pricing-audit-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/sample/manifest.json')));
  manifest.tag = `app-payload-${manifest.run_date}-r000001`;
  const prefix = `https://github.com/${manifest.repo}/releases/download/${manifest.tag}/`;
  for (const file of Object.values(manifest.files)) {
    fs.copyFileSync(path.join(root, 'assets/sample', file.name), path.join(directory, file.name)); file.url = prefix + file.name;
  }
  manifest.source_observation = { generation_id: 'public-pricing-audit-generation' };
  const binding = { schemaVersion: 1, generationId: manifest.source_observation.generation_id, runDate: manifest.run_date,
    coreSha256: manifest.files.core.sha256, detailsSha256: manifest.files.details.sha256 };
  const captured = JSON.parse(fs.readFileSync(path.join(root, '__tests__/fixtures/public_rates/resolver-golden-v1.json'))).cases[2];
  const evidenceIds = new Set();
  function collect(value) {
    if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) { if (key === 'evidenceIds') item.forEach(id => evidenceIds.add(id)); else collect(item); }
  }
  collect(captured.programme);
  const shard = mutateShard({ ...binding, programmes: [captured.programme], referenceRates: [], evidence: [...evidenceIds].map(evidenceId => ({
    evidenceId, url: captured.publicSource.url, sha256: captured.publicSource.sha256, locator: '/data' })) });
  function write(kind, value) {
    const body = Buffer.from(JSON.stringify(value)), bytes = gzipSync(body), digest = hash(bytes);
    const name = `public-rate-${kind}-${manifest.run_date}-${digest.slice(0, 12)}.json.gz`;
    fs.writeFileSync(path.join(directory, name), bytes);
    return { name, url: prefix + name, sha256: digest, bytes: bytes.length, decodedBytes: body.length, encoding: 'gzip' };
  }
  const shardFile = write('shard-0000', shard);
  const { url: _url, ...route } = shardFile;
  const products = [{ productId: captured.programme.productId, productKey: 'ANZ::public-audit', providerId: 'ANZ', providerName: 'ANZ', name: captured.name, section: 'TD',
    aliases: [], status: 'current', programmeIds: [captured.programme.programmeId], referenceIds: [], reasonCodes: [] }];
  const index = { ...binding, products, coverage: [], shards: [{ ...route, productIds: [captured.programme.productId] }] };
  const assets = [shardFile];
  if (splitDiscovery) {
    const discovery = write('shard-0001', mutateDiscovery({ ...binding, products, programmes: [], referenceRates: [], evidence: [] }));
    assets.push(discovery);
    const { url: _discoveryUrl, ...descriptor } = discovery;
    index.products = []; index.shards.push({ ...descriptor, productIds: [] });
    index.routes = [{ name: shardFile.name, kind: 'pricing', providerIds: ['ANZ'], sections: ['TD'] },
      { name: discovery.name, kind: 'discovery', providerIds: ['ANZ'], sections: ['TD'] }];
  }
  const indexFile = write('index', index);
  manifest.public_rate_catalogue = { ...binding, index: indexFile, shards: assets };
  const digest = payloadBundleIdentity(manifest);
  manifest.payload_revision = { schema_version: 1, revision: 1, generation_id: `sha256-${digest}`, bundle_sha256: digest, parent_revision: null };
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
  return { manifest, directory, options: options(['--directory', directory]) };
}

test('candidate audit independently verifies detached public pricing bytes without changing startup assets', async t => {
  const value = candidate(t), report = await audit(value.options);
  assert.equal(report.assets.public_rate_catalogue.status, 'PASS');
  assert.equal(report.assets.public_rate_catalogue.products, 1);
  assert.equal(report.assets.public_rate_catalogue.pricing_supported, 1);
  assert.equal(report.publication_verified, false);
  assert.equal(report.assets.core.bytes, value.manifest.files.core.bytes);
});

test('candidate audit rejects mixed-generation pricing even when the compressed bytes and hashes agree', async t => {
  const value = candidate(t, shard => ({ ...shard, generationId: 'another-generation' }));
  const report = await audit(value.options);
  assert.equal(report.assets.public_rate_catalogue.status, 'FAIL');
  assert.equal(report.publication_verified, false);
});

test('pricing hashes remain part of the immutable bundle before any detached download', async t => {
  const value = candidate(t);
  value.manifest.public_rate_catalogue.shards[0].sha256 = 'f'.repeat(64);
  fs.writeFileSync(path.join(value.directory, 'manifest.json'), JSON.stringify(value.manifest));
  await assert.rejects(audit(value.options), /Invalid public rate capability|bundle identity/);
});

test('candidate audit loads hashed discovery before pricing regardless of manifest asset order', async t => {
  const value = candidate(t, undefined, true), report = await audit(value.options);
  assert.equal(report.assets.public_rate_catalogue.status, 'PASS');
  assert.equal(report.assets.public_rate_catalogue.products, 1);
  assert.equal(report.assets.public_rate_catalogue.programmes, 1);
  assert.equal(report.assets.public_rate_catalogue.discovery_shards, 1);
  assert.equal(report.publication_verified, false);
});

test('candidate audit rejects foreign discovery even with independently matching bytes and hashes', async t => {
  const value = candidate(t, undefined, true, shard => ({ ...shard, generationId: 'foreign-discovery' }));
  const report = await audit(value.options);
  assert.equal(report.assets.public_rate_catalogue.status, 'FAIL');
  assert.equal(report.publication_verified, false);
});
