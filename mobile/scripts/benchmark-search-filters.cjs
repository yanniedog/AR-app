#!/usr/bin/env node
/* eslint-env node */
'use strict';

// Exact application algorithms over a captured publication. Node timings are
// a regression proxy; they do not establish Android/Hermes acceptance.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src');
require.extensions['.ts'] = (module, filename) => {
  if (!filename.startsWith(src + path.sep)) throw Error('Only checked-in app sources may be loaded');
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
  }).outputText, filename);
};
// The measured preparation receives an explicit Node scheduler. Never load RN
// or fall back silently to an unmeasured mobile scheduling implementation.
const yieldModule = path.join(src, 'lib/yieldToUi.ts');
require.cache[yieldModule] = { id: yieldModule, filename: yieldModule, loaded: true,
  exports: { yieldToUi: () => { throw Error('Benchmark must supply its scheduler'); } } };
// selectors imports Expo configuration for unrelated token-rate rules. Facet
// generation does not consult it; retain the checked-in configuration defaults.
const constantsModule = require.resolve('expo-constants');
require.cache[constantsModule] = { id: constantsModule, filename: constantsModule, loaded: true,
  exports: { default: { expoConfig: { extra: {} } } } };
const { prepareSearchFilterOptions, searchFilterGroupsFor } = require('../src/data/searchFilterOptions.ts');
const { distinctProviders, distinctValues } = require('../src/data/selectors.ts');
const { distinctAccountFeatures } = require('../src/data/features.ts');
const { distinctEligibilityCriteria } = require('../src/data/eligibility.ts');
const { publishedFactFilterOptions } = require('../src/data/productFacts.ts');
const { compareLvrTiers } = require('../src/data/lvrTier.ts');

async function main() {
  let corePath = path.join(root, 'assets/sample/core.json');
  let detailsPath = path.join(root, 'assets/sample/details.json');
  for (let i = 2; i < process.argv.length; i += 1) {
    if (process.argv[i] === '--core' && process.argv[i + 1]) corePath = path.resolve(process.argv[++i]);
    else if (process.argv[i] === '--details' && process.argv[i + 1]) detailsPath = path.resolve(process.argv[++i]);
    else throw Error(`Unknown or incomplete argument: ${process.argv[i]}`);
  }
  const load = filename => {
    const bytes = fs.readFileSync(filename);
    return { payload: JSON.parse(bytes.toString('utf8')),
      sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
  };
  const core = load(corePath), details = load(detailsPath);
  assert.equal(core.payload.run_date, details.payload.run_date, 'Use matching real publication dates');
  const sections = [];
  for (const section of ['Mortgage', 'Savings', 'TD']) {
    const rows = core.payload.sections[section].rates, lookup = details.payload.products;
    const baselineStarted = performance.now();
    const baseline = {
      groups: searchFilterGroupsFor(section).map(g => {
        const options = distinctValues(rows, g.field);
        if (g.field === 'lvr_tier') options.sort(compareLvrTiers);
        return { g, options };
      }).filter(({ options }) => options.length > 0),
      providers: distinctProviders(rows),
      accountFeatures: distinctAccountFeatures(rows, lookup, section),
      eligibilityCriteria: distinctEligibilityCriteria(rows, lookup),
      publishedDetails: publishedFactFilterOptions(rows, lookup, section),
    };
    const synchronousBaselineMs = performance.now() - baselineStarted;
    const slices = [];
    const started = performance.now();
    let sliceStarted = started;
    let yields = 0;
    const model = await prepareSearchFilterOptions(rows, lookup, section, {
      yieldControl: async () => {
        slices.push(performance.now() - sliceStarted);
        yields += 1;
        await new Promise(resolve => setImmediate(resolve));
        sliceStarted = performance.now();
      },
    });
    slices.push(performance.now() - sliceStarted);
    const elapsedMs = performance.now() - started;
    assert.deepEqual(model, baseline, `${section} must retain complete facet membership, ordering and scopes`);
    sections.push({ section, rows: rows.length, providers: model.providers.length,
      featureOptions: model.accountFeatures.length, eligibilityOptions: model.eligibilityCriteria.length,
      publishedOptions: model.publishedDetails.length, exactModelPreserved: true, yields,
      timings: { synchronousBaselineMs, chunkedElapsedMs: elapsedMs,
        chunkedCpuMs: slices.reduce((sum, value) => sum + value, 0),
        largestCpuSliceMs: Math.max(...slices) } });
  }
  const round = (_, value) => typeof value === 'number' && !Number.isInteger(value) ? +value.toFixed(3) : value;
  console.log(JSON.stringify({ kind: 'search-filter-regression-proxy', timestamp: new Date().toISOString(),
    runtime: process.version, engine: `V8 ${process.versions.v8}`, platform: process.platform,
    fixture: { publicationDate: core.payload.run_date, core: { bytes: core.bytes, sha256: core.sha256 },
      details: { bytes: details.bytes, sha256: details.sha256 } }, sections,
    exclusions: ['JSON parse', 'module initialization', 'React rendering', 'native scheduler', 'Android/Hermes'],
    deviceAcceptance: 'unverified' }, round, 2));
}
main().catch(error => { console.error(error.stack ?? error); process.exitCode = 1; });
