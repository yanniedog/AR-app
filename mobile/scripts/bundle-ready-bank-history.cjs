#!/usr/bin/env node
'use strict';
// The rich bundle already has independently verified publication/observation
// receipts. Compile it on the build machine, never on the phone.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { gzipSync } = require('fflate');
const { spawnSync } = require('node:child_process');
const { unpackHistoricalBankRateCatalogue } = require('./bundle-historical-bank-catalogue.cjs');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const root = path.resolve(__dirname, '..');

function buildReadySnapshot(snapshot) {
  const bytes = zlib.gunzipSync(Buffer.from(snapshot.gzip_base64, 'base64'), { maxOutputLength: 128 * 1024 * 1024 });
  if (bytes.length !== snapshot.bytes || hash(bytes) !== snapshot.sha256) throw new Error('Historical bundle receipt mismatch');
  const catalogue = unpackHistoricalBankRateCatalogue(JSON.parse(bytes));
  const raw = JSON.stringify(catalogue);
  if (!catalogue || (snapshot.catalogue_sha256 && hash(raw) !== snapshot.catalogue_sha256)) throw new Error('Historical catalogue receipt mismatch');
  const compiler = path.join(root, 'contracts/history-ready/compiler.cjs');
  const pin = JSON.parse(fs.readFileSync(path.join(root, 'contracts/history-ready/compiler-manifest.json'), 'utf8'));
  if (hash(fs.readFileSync(compiler)) !== pin.compiler_sha256) throw new Error('Ready compiler receipt mismatch');
  const result = spawnSync(process.execPath, [compiler], { input: raw, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`Ready compiler failed: ${result.stderr}`);
  const ready = JSON.parse(result.stdout);
  const compiled = Buffer.from(JSON.stringify(ready));
  if (compiled.length > 4 * 1024 * 1024) throw new Error('Prepared history exceeds the app processing budget');
  // The pinned JS codec is reproducible across build hosts. Native zlib embeds
  // an OS byte and can change deflate output between Node patch releases.
  const compressed = Buffer.from(gzipSync(compiled, { level: 9, mtime: 0 }));
  if (compressed.length > 1024 * 1024) throw new Error('Prepared history exceeds the compressed app budget');
  return { schema_version: 1, run_date: snapshot.run_date, core_sha256: snapshot.core_sha256,
    source_index: snapshot.source_index, source_catalogue_sha256: hash(raw),
    sha256: hash(compiled), bytes: compiled.length, gzip_base64: compressed.toString('base64') };
}

if (require.main === module) {
  const source = path.join(root, 'src/data/historicalBankRateCatalogue.snapshot.json');
  const output = path.join(root, 'src/data/historicalBankRateReady.snapshot.json');
  const snapshot = buildReadySnapshot(JSON.parse(fs.readFileSync(source, 'utf8')));
  const text = JSON.stringify(snapshot) + '\n';
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(output, 'utf8') !== text) throw new Error('Prepared history is stale; rebuild it from the pinned compiler');
  } else fs.writeFileSync(output, text, 'utf8');
  console.log(JSON.stringify({ decoded_bytes: snapshot.bytes, gzip_bytes: Buffer.from(snapshot.gzip_base64, 'base64').length, sha256: snapshot.sha256 }));
}
module.exports = { buildReadySnapshot };
