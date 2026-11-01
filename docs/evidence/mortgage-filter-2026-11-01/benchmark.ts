import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { bindVerifiedDetails } from '../src/data/detailsIdentity';
import { normalizeCoreWithIntegrity } from '../src/data/sectionIntegrity';
import { mortgageComparisonRows, mortgageComparisonRowsCooperatively } from '../src/data/mortgageComparison';
import { prepareMortgageResultsIndex } from '../src/data/mortgageResultsIndex';
import { EMPTY_FILTERS, filterRows, prepareSearchRows, sortRows } from '../src/data/selectors';
import { getPublicRateCatalogueSnapshot } from '../src/data/publicRateCatalogue';

test('measure current public mortgage publication locally', async () => {
  const root = join(__dirname, '../../tmp');
  const manifest = JSON.parse(readFileSync(join(root, 'live-manifest.json'), 'utf8'));
  const normalized = normalizeCoreWithIntegrity(JSON.parse(readFileSync(join(root, 'live-core.json'), 'utf8')), { coreSha256: manifest.files.core.sha256 });
  const details = bindVerifiedDetails(JSON.parse(readFileSync(join(root, 'live-details.json'), 'utf8')), manifest.files.details.sha256);
  const context = { core: normalized.core, coreIntegrity: normalized.integrity, details, manifest };
  const source = context.core.sections.Mortgage.rates;
  const catalogue = getPublicRateCatalogueSnapshot(manifest);
  const filters = { ...EMPTY_FILTERS, loanPurposes: ['OWNER_OCCUPIED'], repaymentTypes: ['PRINCIPAL_AND_INTEREST'] };
  const inputs = { loanAmount: '650000', lvr: '72' };
  const started = performance.now();
  const scope = await mortgageComparisonRowsCooperatively(source, inputs, context);
  const scoped = performance.now();
  const result = await prepareSearchRows(scope!.rows, filters, 'rate', 'Mortgage', details.products, null, 'max', 'headline');
  const filtered = performance.now();
  const index = await prepareMortgageResultsIndex({source, catalogue, context, includeNonStandard: false, cancelled: () => false});
  const prepared = performance.now();
  const selected = index?.select({amount: '650000', lvr: '0.72', purpose: 'OWNER_OCCUPIED', repayment: 'PRINCIPAL_AND_INTEREST'}, inputs);
  const indexed = selected?.filtered(filters, 'rate', 'headline');
  const finished = performance.now();
  if (indexed) expect(indexed).toEqual(result);
  const canonical = sortRows(filterRows(mortgageComparisonRows(source, inputs, context).rows, filters, details.products, null, 'Mortgage'), 'rate', 'Mortgage', 'max', 'headline');
  expect(result).toEqual(canonical);
  const samples = [];
  if (index) for (let sample = 0; sample < 12; sample++) {
    const start = performance.now();
    const current = index.select({amount: '650000', lvr: '0.72', purpose: 'OWNER_OCCUPIED', repayment: 'PRINCIPAL_AND_INTEREST'}, inputs)!.filtered(filters, 'rate', 'headline');
    samples.push(performance.now() - start);
    expect(current).toEqual(canonical);
  }
  const receipt = { sourceRows: source.length, catalogue: catalogue.status, scopeMs: scoped-started, filterMs: filtered-scoped,
    totalMs: filtered-started, matchingRows: result?.length, preparationMs: prepared-filtered, indexAvailable: !!index,
    indexedSelectionMs: finished-prepared, indexedRows: indexed?.length, repeatedSelectionMs: samples,
    orderedResultSha256: createHash('sha256').update(JSON.stringify(canonical.map(row => [row.product_key, row.rate_index, row.rate]))).digest('hex'),
    canonicalUnchangedOracleMatched: true,
    payload: {runDate: manifest.run_date, coreSha256: manifest.files.core.sha256, detailsSha256: manifest.files.details.sha256},
    runtime: {node: process.version, platform: process.platform, arch: process.arch},
    measured: 'Jest/Node application data pipeline; verified payloads loaded in memory; no Android/Hermes, network, input debounce or graphical frame measurement',
    sourceHashes: Object.fromEntries(['data/mortgageComparison.ts', 'data/mortgageResultsIndex.ts', 'data/rateConditions.ts', 'hooks/useMortgageResultsIndex.ts'].map(file => [file, createHash('sha256').update(readFileSync(join(__dirname, '../src', file))).digest('hex')])) };
  console.log(JSON.stringify(receipt));
  writeFileSync(join(root, process.env.MORTGAGE_BENCHMARK_OUTPUT ?? 'live-latency-baseline.json'), JSON.stringify(receipt, null, 2));
}, 180000);
