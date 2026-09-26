import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import generator from './bundle-historical-bank-catalogue.cjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function input() {
  const directory = mkdtempSync(join(tmpdir(), 'historical-catalogue-test-'));
  for (const folder of ['manifests', 'cores', 'details']) mkdirSync(join(directory, folder));
  const day = '2026-09-26', tag = `app-payload-${day}-r000001`;
  const url = `https://github.com/yanniedog/AR-local/releases/download/${tag}/`;
  const files = {};
  for (const [key, folder] of [['core', 'cores'], ['details', 'details']]) {
    const bytes = gzipSync(JSON.stringify({ run_date: day })), sha256 = hash(bytes), name = `${key}.json.gz`;
    files[key] = { name, bytes: bytes.length, sha256, url: url + name };
    writeFileSync(join(directory, folder, sha256 + '.gz'), bytes);
  }
  const revision = { schema_version: 1, revision: 1, parent_revision: null, generation_id: 'sha256-' + files.core.sha256, bundle_sha256: files.core.sha256 };
  const manifest = { schema_version: 1, repo: 'yanniedog/AR-local', tag, run_date: day, payload_revision: revision, files };
  const bytes = JSON.stringify(manifest), manifest_sha256 = hash(bytes);
  writeFileSync(join(directory, 'manifests', day + '.json'), bytes);
  const index = { schema_version: 1, revision_protocol: 1, dates: [day], revision_heads: {
    [day]: { revision: 1, generation_id: revision.generation_id, bundle_sha256: revision.bundle_sha256, manifest_sha256, manifest_url: url + 'manifest.json' },
  } };
  writeFileSync(join(directory, 'dates-index.json'), JSON.stringify(index));
  const catalogue = { schema_version: 2, run_dates: [day], sources: {
    [day]: { kind: 'published_core', manifest_sha256, core_sha256: files.core.sha256, details_sha256: files.details.sha256 },
  }, unavailable_dates: {}, evidence: [{ status: 'unknown' }], sections: { Mortgage: [], Savings: [], TD: [] } };
  const filename = join(directory, 'catalogue.json');
  writeFileSync(filename, JSON.stringify(catalogue));
  return { directory, filename, catalogue, files, day };
}
function cleanup(directory) {
  assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
  assert.match(basename(directory), /^historical-catalogue-test-/);
  rmSync(directory, { recursive: true, force: true });
}

test('catalogue wrapper binds both assets and round-trips deterministic compressed bytes', () => {
  const data = input();
  try {
    const { snapshot, report } = generator.build(data.directory, data.filename);
    const decoded = gunzipSync(Buffer.from(snapshot.gzip_base64, 'base64'));
    assert.equal(hash(decoded), snapshot.sha256);
    assert.equal(decoded.length, snapshot.bytes);
    assert.deepEqual(JSON.parse(decoded), data.catalogue);
    assert.equal(report.observed_dates, 1);
    assert.deepEqual(generator.build(data.directory, data.filename).snapshot, snapshot);
  } finally { cleanup(data.directory); }
});

for (const failure of ['details bytes', 'source identity', 'unselected source']) test(`catalogue wrapper rejects ${failure}`, () => {
  const data = input();
  try {
    if (failure === 'details bytes') writeFileSync(join(data.directory, 'details', data.files.details.sha256 + '.gz'), '{}');
    else {
      if (failure === 'source identity') data.catalogue.sources[data.day].details_sha256 = 'f'.repeat(64);
      else data.catalogue.sources[data.day].kind = 'retained_legacy_export';
      writeFileSync(data.filename, JSON.stringify(data.catalogue));
    }
    assert.throws(() => generator.build(data.directory, data.filename));
  } finally { cleanup(data.directory); }
});
