#!/usr/bin/env node
/* eslint-env node */
'use strict';

// Reproduce the signed-app numerical baseline from a previously fetched public
// revision index and immutable assets. No network or device/cache access.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const ts = require('typescript');
const sourceRoot = path.resolve(__dirname, '../src');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
require.extensions['.ts'] = (module, filename) => {
  if (!filename.startsWith(sourceRoot + path.sep)) throw new Error('Only checked-in app sources may be loaded');
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
  });
  module._compile(output.outputText, filename);
};
const { mergePortableBankRateHistory, validatePortableBankRateHistory } = require('../src/data/portableBankRateHistory.ts');
const { parseDatesIndex } = require('../src/data/datesIndex.ts');
const { assertRevisionManifest } = require('../src/data/payloadRevision.ts');

function readBounded(filename, limit) {
  const stat = fs.statSync(filename);
  if (!stat.isFile() || stat.size > limit) throw new Error('Input is not a bounded regular file');
  const bytes = fs.readFileSync(filename);
  if (bytes.length > limit) throw new Error('Input exceeds byte budget');
  return bytes;
}

function build(directory) {
  const index = parseDatesIndex(JSON.parse(readBounded(path.join(directory, 'dates-index.json'), 4 * 1024 * 1024)));
  if (!index?.revision_heads || index.dates.some(day => !index.revision_heads[day])) throw new Error('Every published date needs an immutable revision head');
  let portable = null, lastManifest = null;
  for (const day of index.dates) {
    const head = index.revision_heads[day];
    const manifestBytes = readBounded(path.join(directory, 'manifests', `${day}.json`), 4 * 1024 * 1024);
    if (hash(manifestBytes) !== head.manifest_sha256) throw new Error(`${day}: selected manifest SHA-256 mismatch`);
    const manifest = JSON.parse(manifestBytes);
    assertRevisionManifest(manifest, head, day, 'yanniedog/AR-local');
    const descriptor = manifest.files.core;
    const compressed = readBounded(path.join(directory, 'cores', `${descriptor.sha256}.gz`), 64 * 1024 * 1024);
    if (compressed.length !== descriptor.bytes || hash(compressed) !== descriptor.sha256) throw new Error(`${day}: selected core bytes/SHA-256 mismatch`);
    const core = JSON.parse(zlib.gunzipSync(compressed, { maxOutputLength: 192 * 1024 * 1024 }));
    if (core.schema_version !== 1 || core.run_date !== day || !['Mortgage', 'Savings', 'TD'].every(section => Array.isArray(core.sections?.[section]?.rates))) {
      throw new Error(`${day}: selected core schema/date mismatch`);
    }
    // This calls the shipping app's exact rateTierSignature + SHA-256 and rate
    // parser; the generator has no parallel definition of tier identity.
    portable = mergePortableBankRateHistory(portable, core, head.manifest_sha256);
    lastManifest = manifest;
  }
  if (!validatePortableBankRateHistory(portable)) throw new Error('Generated portable history failed validation');
  const bytes = Buffer.from(JSON.stringify(portable));
  const compressed = zlib.gzipSync(bytes, { level: 9, mtime: 0 });
  const snapshot = { schema_version: 1, run_date: index.latest_date, core_sha256: lastManifest.files.core.sha256,
    source_index: index, history_sha256: hash(bytes), uncompressed_bytes: bytes.length,
    gzip_base64: compressed.toString('base64') };
  return { snapshot, report: { observed_dates: index.dates.length, calendar_dates: portable.run_dates.length,
    tiers: Object.fromEntries(Object.entries(portable.sections).map(([section, series]) => [section, Object.keys(series).length])),
    history_sha256: snapshot.history_sha256, history_json_bytes: bytes.length, history_gzip_bytes: compressed.length,
    source_core_sha256: snapshot.core_sha256 } };
}

if (require.main === module) {
  const [directory, output = path.join(sourceRoot, 'data/portableBankRateHistory.snapshot.json')] = process.argv.slice(2);
  if (!directory) throw new Error('Usage: node scripts/bundle-portable-bank-rate-history.cjs <verified-input-directory> [output.json]');
  const { snapshot, report } = build(path.resolve(directory));
  fs.writeFileSync(path.resolve(output), JSON.stringify(snapshot) + '\n', 'utf8');
  console.log(JSON.stringify(report));
}
module.exports = { build };
