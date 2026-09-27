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
const { upsertHistoricalCatalogueDay } = require('../src/data/historicalBankRateCatalogueMerge.ts');
const sample = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/sample');
const hash = (body) => createHash('sha256').update(body).digest('hex');

function candidate(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-app-private-audit-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const manifest = JSON.parse(fs.readFileSync(path.join(sample, 'manifest.json')));
  // Unmodified retained CDR bytes; only publication descriptor metadata changes.
  manifest.tag = `app-payload-${manifest.run_date}`;
  for (const file of Object.values(manifest.files)) {
    fs.copyFileSync(path.join(sample, file.name), path.join(directory, file.name));
    file.url = `https://github.com/${manifest.repo}/releases/download/${manifest.tag}/${file.name}`;
  }
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
  return { directory, manifest, opts: options(['--directory', directory]) };
}

test('private candidates verify local bytes without claiming public publication', async (t) => {
  const { directory, manifest, opts } = candidate(t);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Private audit attempted a network request'); };
  t.after(() => { globalThis.fetch = originalFetch; });
  const report = await audit(opts);
  assert.equal(report.acquisition, 'private_candidate');
  assert.equal(report.publication_verified, false);
  assert.equal(report.manifest_url, null);
  assert.equal(report.dates_index_sha256, null);
  assert.equal(report.manifest_sha256, hash(fs.readFileSync(path.join(directory, 'manifest.json'))));
  for (const [key, file] of Object.entries(manifest.files)) {
    assert.equal(report.assets[key].status, 'PASS');
    assert.equal(report.assets[key].sha256, file.sha256);
    assert.equal(report.assets[key].url, null);
  }
  // Retained historical freshness/coverage warnings must remain visible.
  assert.notEqual(report.status, 'PASS');
});

test('private audit rejects a changed candidate asset without downloading a fallback', async (t) => {
  const { directory, manifest, opts } = candidate(t);
  fs.appendFileSync(path.join(directory, manifest.files.core.name), ' ');
  const report = await audit(opts);
  assert.equal(report.status, 'FAIL');
  assert.equal(report.assets.core.status, 'FAIL');
});

test('private audit binds an explicitly requested date', async (t) => {
  const { opts } = candidate(t);
  await assert.rejects(audit({ ...opts, date: '2026-08-06' }), /Manifest run\/repository mismatch/);
});

test('private audit rejects unsafe descriptor paths before reading them', async (t) => {
  const { directory, manifest, opts } = candidate(t);
  manifest.files.core.name = '../core.json';
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
  const report = await audit(opts);
  assert.equal(report.status, 'FAIL');
  assert.equal(report.assets.core.status, 'FAIL');
});

function detachedCandidate(t, editEnvelope = () => {}) {
  const result = candidate(t), { directory, manifest } = result;
  const core = JSON.parse(fs.readFileSync(path.join(directory, manifest.files.core.name)));
  const details = JSON.parse(fs.readFileSync(path.join(directory, manifest.files.details.name)));
  const catalogue = upsertHistoricalCatalogueDay(null, core, details, { kind: 'published_core',
    core_sha256: manifest.files.core.sha256, details_sha256: manifest.files.details.sha256,
    manifest_sha256: hash(fs.readFileSync(path.join(directory, 'manifest.json'))) });
  const inner = Buffer.from(JSON.stringify(catalogue));
  const envelope = { schema_version: 1, run_date: manifest.run_date, core_sha256: manifest.files.core.sha256,
    catalogue: { sha256: hash(inner), bytes: inner.length, gzip_base64: gzipSync(inner).toString('base64') } };
  editEnvelope(envelope);
  const outer = gzipSync(Buffer.from(JSON.stringify(envelope)));
  const sha256 = hash(outer), name = `bank-rate-history-catalogue-${manifest.run_date}-${sha256.slice(0, 12)}.json.gz`;
  manifest.bank_rate_history_catalogue = { schema_version: 1, file: { name, sha256, bytes: outer.length,
    url: `https://github.com/${manifest.repo}/releases/download/${manifest.tag}/${name}` } };
  fs.writeFileSync(path.join(directory, name), outer);
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
  return { ...result, catalogue };
}

test('private candidate audits detached history bytes and retained real catalogue outside legacy files', async (t) => {
  const { opts, manifest, catalogue } = detachedCandidate(t);
  assert.equal(manifest.files.bank_rate_history_catalogue, undefined);
  const report = await audit(opts), proof = report.assets.bank_rate_history_catalogue;
  assert.equal(proof.status, 'PASS');
  assert.equal(proof.sha256, manifest.bank_rate_history_catalogue.file.sha256);
  assert.equal(proof.catalogue_sha256, hash(Buffer.from(JSON.stringify(catalogue))));
  assert.equal(proof.observed_dates, 1);
  assert.equal(proof.acquisition, 'local_file');
  assert.equal(report.publication_verified, false);
});

for (const [label, change] of [
  ['different core', value => { value.core_sha256 = 'f'.repeat(64); }],
  ['different day', value => { value.run_date = '2026-08-06'; }],
  ['inner digest mismatch', value => { value.catalogue.sha256 = 'f'.repeat(64); }],
  ['invalid base64', value => { value.catalogue.gzip_base64 += '\n'; }],
]) test(`private candidate rejects detached history ${label}`, async t => {
  const { opts } = detachedCandidate(t, change);
  const report = await audit(opts);
  assert.equal(report.status, 'FAIL');
  assert.equal(report.assets.bank_rate_history_catalogue.status, 'FAIL');
});
