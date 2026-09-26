#!/usr/bin/env node
/* eslint-env node */
'use strict';

// Wrap AR-local's canonical prepack for the signed app. Inputs stay local;
// every historical source must match a selected immutable public edition.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const ts = require('typescript');
const sourceRoot = path.resolve(__dirname, '../src');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
require.extensions['.ts'] = (module, filename) => {
  if (!filename.startsWith(sourceRoot + path.sep)) throw new Error('Only checked-in app sources may be loaded');
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
  }).outputText, filename);
};
const { validateHistoricalBankRateCatalogue } = require('../src/data/historicalBankRateCatalogueWire.ts');
const { parseDatesIndex } = require('../src/data/datesIndex.ts');
const { assertRevisionManifest } = require('../src/data/payloadRevision.ts');

function readBounded(filename, limit) {
  const stat = fs.statSync(filename);
  if (!stat.isFile() || stat.size > limit) throw new Error('Input is not a bounded regular file');
  const bytes = fs.readFileSync(filename);
  if (bytes.length > limit) throw new Error('Input exceeds byte budget');
  return bytes;
}

function build(directory, cataloguePath) {
  const index = parseDatesIndex(JSON.parse(readBounded(path.join(directory, 'dates-index.json'), 4 * 1024 * 1024)));
  if (!index?.revision_heads || index.dates.some(day => !index.revision_heads[day])) throw new Error('Every observation requires an immutable revision');
  const catalogueBytes = readBounded(cataloguePath, 128 * 1024 * 1024);
  const catalogue = JSON.parse(catalogueBytes);
  if (!validateHistoricalBankRateCatalogue(catalogue)) throw new Error('Canonical catalogue failed app schema validation');
  if (catalogue.run_dates.at(-1) !== index.latest_date || Object.keys(catalogue.sources).length !== index.dates.length) throw new Error('Catalogue and index date coverage differ');
  let lastManifest;
  for (const day of index.dates) {
    const head = index.revision_heads[day];
    const manifestBytes = readBounded(path.join(directory, 'manifests', `${day}.json`), 4 * 1024 * 1024);
    if (hash(manifestBytes) !== head.manifest_sha256) throw new Error(`${day}: selected manifest digest mismatch`);
    const manifest = JSON.parse(manifestBytes);
    assertRevisionManifest(manifest, head, day, 'yanniedog/AR-local');
    const source = catalogue.sources[day];
    if (source?.kind !== 'published_core' || source.manifest_sha256 !== head.manifest_sha256 ||
        source.core_sha256 !== manifest.files.core.sha256 || source.details_sha256 !== manifest.files.details.sha256) throw new Error(`${day}: catalogue source mismatch`);
    for (const [key, folder] of [['core', 'cores'], ['details', 'details']]) {
      const file = manifest.files[key];
      const compressed = readBounded(path.join(directory, folder, `${file.sha256}.gz`), 64 * 1024 * 1024);
      if (compressed.length !== file.bytes || hash(compressed) !== file.sha256) throw new Error(`${day}: ${key} byte/digest mismatch`);
      const decoded = JSON.parse(zlib.gunzipSync(compressed, { maxOutputLength: 192 * 1024 * 1024 }));
      if (decoded.run_date !== day) throw new Error(`${day}: ${key} date mismatch`);
    }
    lastManifest = manifest;
  }
  const compressed = zlib.gzipSync(catalogueBytes, { level: 9, mtime: 0 });
  if (compressed.length > 16 * 1024 * 1024) throw new Error('Catalogue exceeds compressed app budget');
  const snapshot = { schema_version: 2, run_date: index.latest_date, core_sha256: lastManifest.files.core.sha256,
    source_index: index, sha256: hash(catalogueBytes), bytes: catalogueBytes.length, gzip_base64: compressed.toString('base64') };
  return { snapshot, report: { observed_dates: index.dates.length, calendar_dates: catalogue.run_dates.length,
    tiers: Object.fromEntries(Object.entries(catalogue.sections).map(([section, tiers]) => [section, tiers.length])),
    evidence: catalogue.evidence.length, sha256: snapshot.sha256, bytes: snapshot.bytes, gzip_bytes: compressed.length,
    source_core_sha256: snapshot.core_sha256 } };
}

if (require.main === module) {
  const [directory, cataloguePath, output = path.join(sourceRoot, 'data/historicalBankRateCatalogue.snapshot.json')] = process.argv.slice(2);
  if (!directory || !cataloguePath) throw new Error('Usage: node scripts/bundle-historical-bank-catalogue.cjs <verified-input-directory> <canonical-catalogue.json> [output.json]');
  const { snapshot, report } = build(path.resolve(directory), path.resolve(cataloguePath));
  fs.writeFileSync(path.resolve(output), JSON.stringify(snapshot) + '\n', 'utf8');
  console.log(JSON.stringify(report));
}
module.exports = { build };
