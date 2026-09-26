import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import generator from './bundle-portable-bank-rate-history.cjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function cleanup(directory) {
  assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
  assert.match(basename(directory), /^portable-rate-test-/);
  rmSync(directory, { recursive: true, force: true });
}
function input() {
  const directory = mkdtempSync(join(tmpdir(), 'portable-rate-test-'));
  mkdirSync(join(directory, 'manifests')); mkdirSync(join(directory, 'cores'));
  const index = { schema_version: 1, revision_protocol: 1, dates: ['2026-09-20', '2026-09-22'], revision_heads: {} };
  for (const day of index.dates) {
    const bytes = gzipSync(JSON.stringify({ schema_version: 1, run_date: day, sections: {
      Mortgage: { rates: [{ provider: 'Example', product_name: 'Loan', product_key: 'example', rate: '0.06' }] },
      Savings: { rates: [] }, TD: { rates: [] },
    } }));
    const sha = hash(bytes), tag = `app-payload-${day}-r000001`, base = `https://github.com/yanniedog/AR-local/releases/download/${tag}/`;
    const manifest = { schema_version: 1, repo: 'yanniedog/AR-local', run_date: day, tag,
      payload_revision: { schema_version: 1, revision: 1, parent_revision: null, generation_id: `sha256-${sha}`, bundle_sha256: sha },
      files: { core: { name: 'core.json.gz', bytes: bytes.length, sha256: sha, url: base + 'core.json.gz' },
        details: { name: 'details.json.gz', bytes: 1, sha256: sha, url: base + 'details.json.gz' } } };
    const manifestBytes = JSON.stringify(manifest);
    writeFileSync(join(directory, 'cores', `${sha}.gz`), bytes);
    writeFileSync(join(directory, 'manifests', `${day}.json`), manifestBytes);
    index.revision_heads[day] = { revision: 1, generation_id: `sha256-${sha}`, bundle_sha256: sha,
      manifest_sha256: hash(manifestBytes), manifest_url: base + 'manifest.json' };
  }
  writeFileSync(join(directory, 'dates-index.json'), JSON.stringify(index));
  return directory;
}

test('generator verifies published cores and retains unpublished calendar days as blanks', () => {
  const directory = input();
  try {
    const { snapshot, report } = generator.build(directory);
    assert.equal(report.observed_dates, 2);
    assert.equal(report.calendar_dates, 3);
    assert.equal(report.tiers.Mortgage, 1);
    assert.equal(snapshot.source_index.revision_heads['2026-09-21'], undefined);
    const compressed = Buffer.from(snapshot.gzip_base64, 'base64');
    const decoded = gunzipSync(compressed);
    assert.equal(hash(decoded), snapshot.history_sha256);
    assert.equal(decoded.length, snapshot.uncompressed_bytes);
    assert.equal(compressed.length, report.history_gzip_bytes);
    assert.equal(snapshot.gzip_hex, undefined);
    assert.deepEqual(generator.build(directory).snapshot, snapshot);
  } finally { cleanup(directory); }
});

for (const failure of ['manifest hash', 'core hash', 'missing publication']) test(`generator rejects ${failure} instead of declaring the date unpublished`, () => {
  const directory = input();
  try {
    const filename = join(directory, 'manifests', '2026-09-20.json');
    if (failure === 'manifest hash') writeFileSync(filename, '{}');
    else if (failure === 'missing publication') rmSync(filename);
    else {
      const manifest = JSON.parse(readFileSync(filename));
      writeFileSync(join(directory, 'cores', `${manifest.files.core.sha256}.gz`), new Uint8Array(manifest.files.core.bytes));
    }
    assert.throws(() => generator.build(directory));
  } finally { cleanup(directory); }
});
