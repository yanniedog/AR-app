#!/usr/bin/env node
/* eslint-env node */
'use strict';
// Controlled algorithm proxy. This does not measure navigation, React Native,
// chart decode, Hermes, touch latency or on-device acceptance.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { performance } = require('node:perf_hooks');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const ts = require('typescript');
const file = path.resolve(__dirname, '../src/data/rateRowIndex.ts');
const source = fs.readFileSync(file, 'utf8');
const loaded = new Module(file, module);
loaded.filename = file;
loaded._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { rowsForProvider } = loaded.exports;
const rows = Array.from({ length: 8124 }, (_, i) => {
  const product = Math.floor(i * 1417 / 8124);
  return Object.freeze({ provider: `Bank ${product % 91}`, product_key: `product-${product}`,
    product_name: `Product ${product}`, rate_index: i, rate: '0.05' });
});
Object.freeze(rows);
const providers = Array.from({ length: 14 }, (_, i) => `Bank ${i}`);
const baseline = (rows, provider) => rows.filter(row => row.provider === provider);
const timed = operation => { const start = performance.now(); operation(); return performance.now() - start; };
const cold = { baselineMs: timed(() => baseline(rows, providers[0])), indexedMs: timed(() => rowsForProvider(rows, providers[0])) };
for (const provider of providers) assert.deepEqual(rowsForProvider(rows, provider), baseline(rows, provider));
const runs = { baseline: [], indexed: [] };
for (let iteration = 0; iteration < 40; iteration++) {
  // Alternate order so warming/GC does not always favour the same implementation.
  for (const name of iteration % 2 ? ['indexed', 'baseline'] : ['baseline', 'indexed']) {
    runs[name].push(timed(() => { for (const provider of providers) (name === 'indexed' ? rowsForProvider : baseline)(rows, provider); }));
  }
}
const summary = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return { medianMs: sorted[Math.floor(sorted.length / 2)], p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1], samples: sorted.length };
};
const corrected = rows.map(row => ({ ...row, rate: '0.051' }));
assert.deepEqual(rowsForProvider(corrected, providers[0]), baseline(corrected, providers[0]));
const report = { kind: 'controlled-lender-lookup-proxy', runtime: process.version, engine: process.versions.v8,
  fixture: { rates: rows.length, products: 1417, banks: 91, seed: 'deterministic-ar-rates-ux-v1',
    sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex') },
  algorithmSourceSha256: createHash('sha256').update(source).digest('hex'), providers,
  cold, repeated14Lookups: { baseline: summary(runs.baseline), indexed: summary(runs.indexed) },
  semanticsIdentical: true, replacementEditionVerified: true,
  rowVisits: { baselinePer14Lookups: rows.length * 14, indexedColdBuild: rows.length, indexedWarmCatalogueScans: 0 },
  exclusions: ['React and native rendering', 'chart preparation/decoding', 'Android/Hermes', 'physical device', 'production audit timing'],
  physicalLenderOpeningAcceptance: 'pending; this does not establish that the production 670.3ms stalls are fixed' };
console.log(JSON.stringify(report, (_, value) => typeof value === 'number' && !Number.isInteger(value) ? +value.toFixed(4) : value, 2));
