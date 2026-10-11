#!/usr/bin/env node
/* eslint-env node */
'use strict';

// Real shipped observations, exact application algorithms; Node is a regression
// proxy, never evidence of the Android/Hermes or mobile-browser acceptance time.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { performance } = require('node:perf_hooks');
const ts = require('typescript');
const sourceRoot = path.resolve(__dirname, '../src');
require.extensions['.ts'] = (module, filename) => {
  if (!filename.startsWith(sourceRoot + path.sep)) throw new Error('Only checked-in app sources may be loaded');
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
  }).outputText, filename);
};

const codec = require('../src/data/historicalBankRateCatalogueCompression.ts');
const { getWebHistoryCodec } = require('../src/data/historicalBankRateCatalogueWeb.ts');
const { unpackHistoricalBankRateCatalogueAsync } = require('../src/data/historicalBankRateCataloguePacked.ts');
const { prepareHistoricalBankRateCatalogueAsync, historicalBankRateSnapshotsAsync,
  cachedHistoricalBankRateSnapshots } = require('../src/data/historicalBankRateCatalogue.ts');
const { bankRateScope } = require('../src/data/bankRateOverview.ts');
const { EMPTY_PROFILE } = require('../src/data/profile.ts');
const { encodeDetachedHistoryBytes, decodeDetachedHistoryBytes } = require('../src/data/detachedHistoricalCatalogueBytes.ts');

async function main() {
  const args = process.argv.slice(2);
  let snapshotPath = path.join(sourceRoot, 'data/historicalBankRateCatalogue.snapshot.json');
  let mode = 'web-codec', maxMs = 5000, measureOnly = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--snapshot' && args[i + 1]) snapshotPath = path.resolve(args[++i]);
    else if (args[i] === '--max-ms' && args[i + 1]) maxMs = Number(args[++i]);
    else if (args[i] === '--portable') mode = 'portable';
    else if (args[i] === '--web-codec') mode = 'web-codec';
    else if (args[i] === '--measure-only') measureOnly = true;
    else throw new Error(`Unknown or incomplete argument: ${args[i]}`);
  }
  if (!Number.isFinite(maxMs) || maxMs <= 0) throw new Error('--max-ms must be positive');
  if (fs.statSync(snapshotPath).size > 24 * 1024 * 1024) throw new Error('Snapshot envelope exceeds input budget');
  const source = fs.readFileSync(snapshotPath, 'utf8');
  const native = mode === 'web-codec' ? getWebHistoryCodec() : null;
  if (mode === 'web-codec' && !native) throw new Error('This Node runtime lacks the browser codec APIs');
  codec.configureHistoricalCatalogueCodec(native);
  let yields = 0;
  // Model yieldToUi(0)'s macrotask boundary without importing React Native.
  const yieldControl = async () => {
    yields++;
    await new Promise(resolve => setTimeout(resolve, 0));
  };
  const timings = {};
  const measure = async (name, work) => {
    const started = performance.now();
    const result = await work();
    timings[name] = performance.now() - started;
    return result;
  };
  const coldStarted = performance.now();
  const envelope = await measure('envelope_parse_ms', () => JSON.parse(source));
  const decoded = await measure('decode_verify_parse_ms', () => codec.decompressCatalogueAsync(envelope, { yieldControl }));
  if (!decoded) throw new Error('Snapshot failed transport verification');
  const catalogue = await measure('unpack_ms', () => unpackHistoricalBankRateCatalogueAsync(decoded, { yieldControl }));
  const prepared = await measure('validate_prepare_ms', () => prepareHistoricalBankRateCatalogueAsync(catalogue, yieldControl));
  if (!prepared) throw new Error('Snapshot failed catalogue validation');
  // All real historical dates remain historical; no invented current-day rates.
  const nextDay = new Date(Date.parse(catalogue.run_dates.at(-1)) + 86_400_000).toISOString().slice(0, 10);
  const core = { run_date: nextDay, sections: { Mortgage: { rates: [] }, Savings: { rates: [] }, TD: { rates: [] } } };
  const scope = bankRateScope({ Mortgage: [], Savings: [], TD: [] });
  const filters = { profileFilters: EMPTY_PROFILE, interests: ['Mortgage', 'Savings', 'TD'], includeNonStandard: false };
  const ready = await measure('profile_aggregate_ms', () => historicalBankRateSnapshotsAsync(prepared, core, scope, filters, yieldControl));
  // The compressed snapshot approximates detached transport size. Exercise the
  // shipping cache byte codecs as well: fixed per-block timers previously hid
  // seconds of work outside this preparation budget. Disk IO is still excluded.
  const cacheInput = Buffer.from(envelope.gzip_base64, 'base64');
  const encodedCache = await measure('cache_encode_ms', () => encodeDetachedHistoryBytes(cacheInput, yieldControl));
  const decodedCache = await measure('cache_decode_ms', () => decodeDetachedHistoryBytes(encodedCache, yieldControl));
  if (!decodedCache || !Buffer.from(decodedCache).equals(cacheInput) || encodedCache !== cacheInput.toString('base64')) {
    throw new Error('Cache byte codecs must preserve the exact authenticated transport bytes');
  }
  timings.cold_ready_ms = performance.now() - coldStarted;
  const coldYields = yields;
  const warmPrepared = await measure('warm_prepare_ms', () => prepareHistoricalBankRateCatalogueAsync(catalogue, yieldControl));
  const warm = await measure('warm_ready_ms', () => historicalBankRateSnapshotsAsync(warmPrepared, core, scope, filters, yieldControl));
  const cached = await measure('cached_ready_ms', () => cachedHistoricalBankRateSnapshots(prepared, core, scope, filters));
  if (warmPrepared !== prepared || warm !== ready || cached !== ready || yields !== coldYields) {
    throw new Error('Warm preparation must reuse the exact ready result without more background work');
  }
  const featureFilters = { ...filters, interests: ['Mortgage'],
    profileFilters: { ...EMPTY_PROFILE, accountFeatures: ['OFFSET'] } };
  await measure('required_feature_profile_ms', () => historicalBankRateSnapshotsAsync(prepared, core, scope, featureFilters, yieldControl));
  const compressedBytes = Buffer.from(envelope.gzip_base64, 'base64').length;
  const budgets = { cold_ready_ms: maxMs, profile_change_ms: maxMs, decoded_bytes: 10 * 1024 * 1024, compressed_bytes: 3 * 1024 * 1024 };
  const checks = { processing: timings.cold_ready_ms <= maxMs,
    required_feature_profile: timings.required_feature_profile_ms <= maxMs,
    decoded_size: envelope.bytes <= budgets.decoded_bytes, compressed_size: compressedBytes <= budgets.compressed_bytes,
    warm_identity_reused: true, exact_cache_bytes_reused: true };
  const result = {
    kind: 'historical-catalogue-regression-proxy', timestamp: new Date().toISOString(),
    environment: { runtime: process.version, engine: `V8 ${process.versions.v8}`, platform: process.platform,
      arch: process.arch, cpu: os.cpus()[0]?.model, codec: mode, scheduler: 'one zero-delay timer per app work yield' },
    snapshot: { file: path.relative(path.resolve(__dirname, '..'), snapshotPath), sha256: envelope.sha256,
      format: decoded.format ?? `schema-${decoded.schema_version}`, decoded_bytes: envelope.bytes,
      compressed_bytes: compressedBytes, calendar_dates: catalogue.run_dates.length,
      observed_dates: Object.keys(catalogue.sources).length, evidence: catalogue.evidence.length,
      tiers: Object.fromEntries(Object.entries(catalogue.sections).map(([section, tiers]) => [section, tiers.length])) },
    timings: Object.fromEntries(Object.entries(timings).map(([key, value]) => [key, Number(value.toFixed(3))])),
    yields: { cold: coldYields, profile_change: yields - coldYields }, budgets, checks,
    cache_proxy: { bytes: cacheInput.length, source: 'compressed snapshot approximates detached transport size',
      included_in_processing_budget: ['encode', 'decode'] },
    passed: Object.values(checks).every(Boolean), measure_only: measureOnly,
    device_acceptance: 'unverified',
    exclusions: ['network', 'filesystem latency', 'module initialization', 'current-core classification', 'cache persistence', 'React rendering', 'Android/Hermes and mobile-browser runtime'],
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed && !measureOnly) process.exitCode = 1;
}

main().catch(error => { console.error(error.stack ?? error); process.exitCode = 1; });
