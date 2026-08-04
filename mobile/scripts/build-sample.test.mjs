import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { installSample } from './build-sample.mjs';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

test('installs only a self-consistent producer sample contract', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ar-app-sample-consumer-'));
  try {
    const source = path.join(root, 'source');
    const target = path.join(root, 'target');
    await mkdir(source);
    const core = JSON.stringify({
      schema_version: 1,
      run_date: '2026-08-01',
      sections: { Mortgage: { rates: [], ribbon: {} }, Savings: { rates: [], ribbon: {} }, TD: { rates: [], ribbon: {} } },
      brands: {},
      rba: [],
      coverage: { limitations: ['Bundled sample only: test producer output.'] },
    });
    const details = JSON.stringify({ schema_version: 1, run_date: '2026-08-01', products: {} });
    const manifest = {
      schema_version: 1,
      run_date: '2026-08-01',
      repo: 'yanniedog/AR-local',
      tag: 'bundled-sample',
      counts: { products: 0, providers: 0, rates: 0 },
      files: {
        core: { name: 'core.json', bytes: Buffer.byteLength(core), sha256: sha256(core), url: 'bundled://sample/core.json' },
        details: { name: 'details.json', bytes: Buffer.byteLength(details), sha256: sha256(details), url: 'bundled://sample/details.json' },
      },
    };
    await Promise.all([
      writeFile(path.join(source, 'core.json'), core),
      writeFile(path.join(source, 'details.json'), details),
      writeFile(path.join(source, 'manifest.json'), JSON.stringify(manifest)),
    ]);
    await installSample(source, target);
    assert.equal(await readFile(path.join(target, 'core.json'), 'utf8'), core);
    const invalid = { ...manifest, files: { ...manifest.files, core: { ...manifest.files.core, sha256: 'bad' } } };
    await writeFile(path.join(source, 'manifest.json'), JSON.stringify(invalid));
    await assert.rejects(() => installSample(source, target), /SHA-256 mismatch/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
