import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { separateExportSymbols } from './separate-export-symbols.mjs';
import { collectArtifactSizes } from './report-artifact-sizes.mjs';

async function fixture(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ar-symbols-'));
  const dist = path.join(root, 'dist'), symbols = path.join(root, 'symbols');
  const folder = path.join(dist, '_expo/static/js/android');
  await mkdir(folder, { recursive: true });
  try { await run({ dist, symbols, folder }); } finally { await rm(root, { recursive: true, force: true }); }
}
const map = JSON.stringify({ version: 3, sources: ['input.js'], mappings: 'AAAA' });
test('separates verified symbols, preserves every runtime file, binds symbols to exact bytecode', async () => fixture(async ({ dist, symbols, folder }) => {
  await writeFile(path.join(folder, 'entry.hbc'), 'bytecode');
  await writeFile(path.join(folder, 'entry.hbc.map'), map);
  await writeFile(path.join(folder, 'unrecognized.runtime'), 'count me');
  await separateExportSymbols(dist, symbols);
  const report = await collectArtifactSizes({ distDir: dist, symbolsDir: symbols });
  assert.equal(report.androidBundleBytes, 16);
  assert.equal(report.debugSymbolBytes, Buffer.byteLength(map));
  await assert.rejects(readFile(path.join(folder, 'entry.hbc.map')), { code: 'ENOENT' });
  await writeFile(path.join(folder, 'entry.hbc'), 'changed');
  await assert.rejects(collectArtifactSizes({ distDir: dist, symbolsDir: symbols }), /identity mismatch/);
}));
test('unrecognized maps are rejected rather than excluded from size accounting', async () => fixture(async ({ dist, symbols, folder }) => {
  await writeFile(path.join(folder, 'unknown.map'), map);
  await assert.rejects(separateExportSymbols(dist, symbols), /Unrecognized/);
  assert.equal((await collectArtifactSizes({ distDir: dist, symbolsDir: symbols })).androidBundleBytes, Buffer.byteLength(map));
}));
test('missing runtime or malformed symbols are retained and fail export', async () => fixture(async ({ dist, symbols, folder }) => {
  await writeFile(path.join(folder, 'entry.hbc.map'), map);
  await assert.rejects(separateExportSymbols(dist, symbols), { code: 'ENOENT' });
  assert.equal(await readFile(path.join(folder, 'entry.hbc.map'), 'utf8'), map);
  await writeFile(path.join(folder, 'entry.hbc'), 'bytecode');
  await writeFile(path.join(folder, 'entry.hbc.map'), '{}');
  await assert.rejects(separateExportSymbols(dist, symbols), /Invalid source map/);
}));
