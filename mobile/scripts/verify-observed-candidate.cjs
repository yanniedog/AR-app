#!/usr/bin/env node
/* global __dirname */
'use strict';

// Private, zero-network candidate proof. Reuses consumer validators; never installs or publishes.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { TextDecoder } = require('node:util');
const ts = require('typescript');
const sourceRoot = path.resolve(__dirname, '../src');
require.extensions['.ts'] = (module, filename) => {
  if (!filename.startsWith(sourceRoot + path.sep)) throw Error('Only app validators may be loaded');
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
  }).outputText, filename);
};
const { parseObservedPopulationIndex, admitObservedPopulationManifest, observedPopulationTransportUrl,
  OBSERVED_POPULATION_CAPABILITY } = require('../src/data/observedPopulationChannel.ts');
const { validatePopulationAssessment, validatePopulationEdition } = require('../src/data/populationAssessment.ts');
const { automaticDataUrl } = require('../src/lib/automaticDataAccess.ts');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function verify(directory) {
  const root = fs.realpathSync(directory);
  const read = (name, maximum) => {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(name) || name.includes('..')) throw Error('Invalid candidate filename');
    const target = fs.realpathSync(path.join(root, name));
    if (!target.startsWith(root + path.sep) || !fs.statSync(target).isFile() || fs.statSync(target).size > maximum) throw Error('Candidate file is outside the directory or exceeds the byte limit');
    const bytes = fs.readFileSync(target);
    if (bytes.length > maximum) throw Error('Candidate file exceeds byte limit');
    return bytes;
  };
  const index = parseObservedPopulationIndex(JSON.parse(read('dates-index.json', 1024 * 1024).toString('utf8')));
  const selected = admitObservedPopulationManifest(read('manifest.json', 4 * 1024 * 1024).toString('utf8'), index);
  const documents = {}, assets = [];
  for (const [key, file] of Object.entries(selected.manifest.files)) {
    const bytes = read(file.name, 64 * 1024 * 1024);
    if (bytes.length !== file.bytes || hash(bytes) !== file.sha256) throw Error(`Candidate ${key} hash/length mismatch`);
    if (bytes.subarray(0, 3).toString('ascii') === 'ARE') throw Error('Candidate fixture must contain service-opened domain bytes; no key access');
    const decoded = bytes[0] === 0x1f && bytes[1] === 0x8b ? zlib.gunzipSync(bytes, { maxOutputLength: 192 * 1024 * 1024 }) : bytes;
    const document = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decoded));
    if (!document || typeof document !== 'object' || Array.isArray(document) ||
      (key !== 'rba_calendar' && document.run_date !== selected.manifest.run_date)) throw Error(`Candidate ${key} date/structure mismatch`);
    if (automaticDataUrl(file.url) !== null) throw Error('Candidate asset unexpectedly matches legacy transport');
    documents[key] = document;
    assets.push({ key, name: file.name, bytes: bytes.length, sha256: file.sha256,
      candidate_transport_url: observedPopulationTransportUrl(file.url, OBSERVED_POPULATION_CAPABILITY) });
  }
  const assessment = validatePopulationAssessment(documents.core);
  if (!assessment) throw Error('Candidate core is missing population assessment');
  validatePopulationEdition(documents.core, selected.manifest);
  if (!documents.details?.products || typeof documents.details.products !== 'object' || Array.isArray(documents.details.products)) throw Error('Candidate product details missing');
  const rows = Object.values(documents.core.sections).flatMap(section => section.rates);
  if (rows.some(row => !Object.hasOwn(documents.details.products, row.product_key))) throw Error('Candidate details omit an observed product');
  return { schema_version: 1, listed_asset_bytes_verified: true, publication_verified: false,
    detached_capabilities_verified: false, service_isolation_verified: false, runtime_verified: false,
    channel: OBSERVED_POPULATION_CAPABILITY, run_date: selected.manifest.run_date, tag: selected.manifest.tag,
    manifest_sha256: selected.manifestSha256, bundle_sha256: selected.manifest.payload_revision.bundle_sha256,
    cache_key: selected.cacheKey, population_scope: assessment.scope, total_population: null, missing_product_count: null,
    observed_counts: assessment.observed_counts, affected_provider_ids: assessment.affected_providers.map(provider => provider.provider_id), assets };
}
module.exports = { verify };
if (require.main === module) {
  try {
    if (process.argv.length !== 3) throw Error('Usage: node scripts/verify-observed-candidate.cjs <private fixture directory>');
    process.stdout.write(JSON.stringify(verify(process.argv[2]), null, 2) + '\n');
  } catch (error) { process.stderr.write(String(error) + '\n'); process.exitCode = 2; }
}
