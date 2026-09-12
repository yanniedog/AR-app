import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { audit, options } = require('./audit-public-payload.cjs');
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
