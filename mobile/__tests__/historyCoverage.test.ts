import * as eligibilityGate from '../src/data/eligibilityGate';
import compiler from '../contracts/history-ready/compiler-manifest.json';
import { compileHistoricalBankRateReady } from '../src/data/historicalBankRateReadyCompiler';
import { installPreparedHistoricalBankRateCatalogue } from '../src/data/historicalBankRateCatalogueStore';
import * as productProjection from '../src/data/productHistoryModel';
import { makeHealthyCore } from '../__fixtures__/appHealth';
import { installHistoricalBankRateCatalogue } from '../src/data/historicalBankRateCatalogueStore';
import * as catalogueProjection from '../src/data/historicalBankRateCatalogue';
import { historyCoverageEvidence, reconcileHistoryCoverage, type HistoryCoverageEvidence } from '../src/lib/appHealth/historyCoverage';
import { toPublicAppHealthReport, finalizeAppHealthReport } from '../src/lib/appHealth/report';
import { APP_HEALTH_CHECK_CODES } from '../src/lib/appHealth/types';
import { encodeCompactDiagnosticJson, decodeCompactDiagnosticJson } from '../src/lib/compactDiagnosticJson';
import { type BankRateSnapshot } from '../src/data/bankRateOverview';

const evidence = (): HistoryCoverageEvidence => ({ available: true, runDate: '2026-10-24', days: 0,
  sourceGapDays: [], gaps: [], processingMismatches: 0, chartProjectionMismatches: 0, historicalPixelsVerified: false });
const counts = (count: number) => ({ Mortgage: { Bank: { ...stats, count } } });
const stats = { min: 5, mean: 6, median: 6, max: 7, count: 2 };

it('retains every unavailable and unprocessed day, even when current data works', () => {
  const days = ['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'];
  const result = reconcileHistoryCoverage(evidence(), days, { '2026-10-21': {}, '2026-10-23': {} },
    { '2026-10-22': 'Not retained' }, { '2026-10-21': counts(2), '2026-10-23': counts(3) }, {
      '2026-10-21': { Mortgage: { Bank: stats } }, '2026-10-23': { Mortgage: { Bank: stats } },
      '2026-10-24': { Mortgage: { Bank: stats } },
    });
  expect(result.days).toBe(4);
  expect(result.sourceGapDays).toEqual(['2026-10-22']);
  expect(result.gaps).not.toContainEqual(['2026-10-22', 'processed-day-missing', null, 1]);
  expect(result.gaps).toContainEqual(['2026-10-23', 'source-to-model-count-mismatch', 'Mortgage', 1, 'Bank']);
  expect(result).toMatchObject({ processingMismatches: 1, chartProjectionMismatches: 0, historicalPixelsVerified: false });
});

it('checks every projected statistic and detects non-finite chart values', () => {
  const snapshots: Record<string, BankRateSnapshot> = { '2026-10-24': { Mortgage: { Bank: { ...stats, mean: NaN } } } };
  const result = reconcileHistoryCoverage(evidence(), ['2026-10-24'], {}, {}, {}, snapshots);
  expect(result.gaps).toContainEqual(['2026-10-24', 'model-to-chart-mean-mismatch', 'Mortgage', 1, 'Bank']);
});

it('preserves all public daily gap evidence through compact upload round trips', () => {
  const gaps = Array.from({ length: 400 }, (_, index) => ['2025-10-01', 'source-to-model-count-mismatch', 'Mortgage', index]);
  const report = finalizeAppHealthReport({ sessionId: 'test', mode: 'local', startedAt: '2026-10-24T00:00:00Z',
    finishedAt: '2026-10-24T00:00:01Z', checks: [{ id: APP_HEALTH_CHECK_CODES.CATALOGUE_COVERAGE,
      code: APP_HEALTH_CHECK_CODES.CATALOGUE_COVERAGE, label: 'Catalogue', domain: 'data-completeness', status: 'fail',
      metrics: { historyGaps: JSON.stringify(gaps), historySourceGapDays: JSON.stringify(['2025-10-01']),
        historicalPixelsVerified: false } }], plannedCheckIds: [APP_HEALTH_CHECK_CODES.CATALOGUE_COVERAGE] });
  const publicReport = toPublicAppHealthReport(report);
  expect(decodeCompactDiagnosticJson(encodeCompactDiagnosticJson(publicReport))).toEqual(publicReport);
  expect(publicReport.checks[0].metrics.historyGaps).toBe(JSON.stringify(gaps));
});

it('detects entirely missing intermediate calendar days and equal-count wrong values', () => {
  const result = reconcileHistoryCoverage(evidence(), ['2026-10-21', '2026-10-24'], { '2026-10-21': {} }, {},
    { '2026-10-21': { Mortgage: { Bank: { ...stats, mean: 5.5 } } } },
    { '2026-10-21': { Mortgage: { Bank: stats } }, '2026-10-24': {} });
  expect(result.sourceGapDays).toEqual(['2026-10-22', '2026-10-23']);
  expect(result.gaps).toContainEqual(['2026-10-21', 'source-to-model-mean-mismatch', 'Mortgage', 1, 'Bank']);
  expect(result.days).toBe(4);
});

it('does not call the payload stale for a Hobart date that is still the previous UTC day', () => {
  const core = makeHealthyCore();
  core.run_date = '2026-10-25';
  const result = historyCoverageEvidence(core, null, Date.parse('2026-10-25T13:44:48.359Z'));
  expect(result.observedDay).toBe('2026-10-25');
  expect(result.sourceGapDays).not.toContain('2026-10-26');
  expect(result.gaps.filter(gap => gap[1] === 'current-payload-stale')).toEqual([]);
});

it('does not report explicit savings term deposits as source-to-model count mismatches', () => {
  const core = makeHealthyCore();
  core.run_date = '2026-10-24';
  const catalogue = { schema_version: 2, run_dates: ['2026-10-22', '2026-10-23', '2026-10-24'],
    sources: Object.fromEntries(['2026-10-22', '2026-10-23'].map(day => [day,
      { kind: 'retained_legacy_export', banks_sha256: 'a'.repeat(64), bytes: 100 }])),
    unavailable_dates: { '2026-10-24': 'Current core owns today' }, evidence: [{ status: 'unknown' }],
    sections: { Mortgage: [], Savings: [
      { row: { provider: 'Bank', product_key: 'saver', product_name: 'Online saver' }, spans: [[0, 2, [5], 0]] },
      { row: { provider: 'Bank', product_key: 'td', product_name: 'Term Deposit 6 month' }, spans: [[0, 2, [4], 0]] },
    ], TD: [] } };
  expect(installHistoricalBankRateCatalogue(core, catalogue)).toBe(true);
  const result = historyCoverageEvidence(core, null, Date.parse('2026-10-24T01:00:00Z'));
  expect(result.gaps.filter(gap => gap[1] === 'source-to-model-count-mismatch')).toEqual([]);
  expect(result.processingMismatches).toBe(0);
  expect(result.gaps).toContainEqual(['2026-10-24', 'historical-quarantined-tiers', null, 1]);
  expect(result.gaps).toContainEqual(['2026-10-22', 'historical-detail-evidence-unknown', 'Savings', 1]);
});

it('reconciles original source spans and detects a wrong reducer value with unchanged counts', () => {
  const core = makeHealthyCore();
  core.run_date = '2026-10-24';
  const catalogue = { schema_version: 2, run_dates: ['2026-10-22', '2026-10-23', '2026-10-24'],
    sources: Object.fromEntries(['2026-10-22', '2026-10-23'].map(day => [day,
      { kind: 'retained_legacy_export', banks_sha256: 'a'.repeat(64), bytes: 100 }])),
    unavailable_dates: { '2026-10-24': 'Current core owns today' }, evidence: [{ status: 'unknown' }],
    sections: { Mortgage: [{ row: { provider: 'Bank', product_key: 'mortgage', product_name: 'Home loan' },
      spans: [[0, 2, [5, 7], 0]] }], Savings: [], TD: [] } };
  expect(installHistoricalBankRateCatalogue(core, catalogue)).toBe(true);
  expect(historyCoverageEvidence(core, null, Date.parse('2026-10-24T01:00:00Z'))).toMatchObject({ processingMismatches: 0, chartProjectionMismatches: 0, days: 3 });
  expect(historyCoverageEvidence(core, null, Date.parse('2026-10-24T01:00:00Z')).gaps).toContainEqual(['2026-10-22', 'historical-detail-evidence-unknown', 'Mortgage', 2]);
  const another = { ...core };
  expect(installHistoricalBankRateCatalogue(another, catalogue)).toBe(true);
  const original = catalogueProjection.historicalBankRateSnapshots;
  const spy = jest.spyOn(catalogueProjection, 'historicalBankRateSnapshots').mockImplementation((...args) => {
    const model = original(...args);
    return { ...model, '2026-10-22': { ...model['2026-10-22'], Mortgage: {
      ...model['2026-10-22'].Mortgage, Bank: { ...model['2026-10-22'].Mortgage!.Bank, mean: 6.5 },
    } } };
  });
  try {
    expect(historyCoverageEvidence(another, null, Date.parse('2026-10-24T01:00:00Z')).gaps).toContainEqual(['2026-10-22', 'source-to-model-mean-mismatch', 'Mortgage', 1, 'Bank']);
  } finally { spy.mockRestore(); }
});

it('checks product source rates, preserves unknown nulls and reports stale current days', () => {
  const core = makeHealthyCore(); core.run_date = '2026-10-24';
  const source = { schema_version: 2, run_dates: ['2026-10-22', '2026-10-23', '2026-10-24'],
    sources: Object.fromEntries(['2026-10-22', '2026-10-23'].map(day => [day,
      { kind: 'retained_legacy_export', banks_sha256: 'a'.repeat(64), bytes: 100 }])),
    unavailable_dates: { '2026-10-24': 'Current core owns today' }, evidence: [{ status: 'unknown' }],
    sections: { Mortgage: [{ row: { provider: 'Bank', product_key: 'mortgage', product_name: 'Home loan' },
      spans: [[0, 2, [5, 7], 0]] }], Savings: [], TD: [] } };
  const prepared = catalogueProjection.prepareHistoricalBankRateReady(compileHistoricalBankRateReady(source, compiler.sha256))!;
  installPreparedHistoricalBankRateCatalogue(core, prepared);
  const history: productProjection.ProductHistoryPayload = { schema_version: 3, run_date: core.run_date,
    run_dates: source.run_dates, products: { mortgage: [0.05, 0.06, null] } };
  const before = JSON.stringify(history);
  const result = historyCoverageEvidence(core, history, Date.parse('2026-10-25T14:30:00Z'));
  expect(result.gaps).toContainEqual(['2026-10-23', 'product-source-to-model-mismatch', 'Mortgage', 1, 'mortgage']);
  expect(result.gaps).toContainEqual(['2026-10-25', 'current-payload-stale', null, 1]);
  expect(result.gaps).not.toContainEqual(['2026-10-26', 'current-payload-stale', null, 1]);
  expect(historyCoverageEvidence(core, history, Date.parse('2026-10-26T02:00:00Z')).gaps)
    .toContainEqual(['2026-10-26', 'current-payload-stale', null, 1]);
  expect(JSON.stringify(history)).toBe(before);
  const another = { ...core }; installPreparedHistoricalBankRateCatalogue(another, prepared);
  const original = productProjection.productSeriesRecordForChart;
  const spy = jest.spyOn(productProjection, 'productSeriesRecordForChart').mockImplementation((...args) =>
    ({ ...original(...args), '2026-10-24': args[1] === 'mortgage' ? 0.05 : original(...args)['2026-10-24'] }));
  try {
    expect(historyCoverageEvidence(another, history, Date.parse('2026-10-24T01:00:00Z')).gaps)
      .toContainEqual(['2026-10-24', 'product-model-to-chart-mismatch', null, 1, 'mortgage']);
  } finally { spy.mockRestore(); }
});

it('reuses immutable raw statistics across gate changes but recomputes for a distinct selection wrapper', () => {
  const core = makeHealthyCore(); core.run_date = '2026-10-24';
  let spanReads = 0;
  const tier = { row: { provider: 'Bank', product_key: 'mortgage', product_name: 'Home loan' },
    get spans() { spanReads++; return [[0, 2, [5, 7], 0]]; } };
  const source = { schema_version: 2, run_dates: ['2026-10-22', '2026-10-23', '2026-10-24'],
    sources: Object.fromEntries(['2026-10-22', '2026-10-23'].map(day => [day,
      { kind: 'retained_legacy_export', banks_sha256: 'a'.repeat(64), bytes: 100 }])),
    unavailable_dates: { '2026-10-24': 'Current core owns today' }, evidence: [{ status: 'unknown' }],
    sections: { Mortgage: [tier], Savings: [], TD: [] } };
  const prepared = catalogueProjection.prepareHistoricalBankRateCatalogue(source)!;
  expect(prepared).not.toBeNull(); installPreparedHistoricalBankRateCatalogue(core, prepared);
  let revision = 10;
  const gate = jest.spyOn(eligibilityGate, 'getMandatoryEligibilityRevision').mockImplementation(() => revision);
  const projection = jest.spyOn(catalogueProjection, 'historicalBankRateSnapshots').mockReturnValue({
    '2026-10-22': { Mortgage: { Bank: stats } }, '2026-10-23': { Mortgage: { Bank: stats } }, '2026-10-24': {},
  });
  try {
    const now = Date.parse('2026-10-24T01:00:00Z');
    const first = historyCoverageEvidence(core, null, now), reads = spanReads;
    revision++;
    const second = historyCoverageEvidence(core, null, now);
    expect(second).not.toBe(first);
    expect(spanReads).toBe(reads);
    expect(projection).toHaveBeenCalledTimes(2);
    const selected = catalogueProjection.selectHistoricalCatalogueDates(prepared, new Set(['2026-10-22']), null);
    expect(selected.catalogue).toBe(prepared.catalogue);
    expect(selected).not.toBe(prepared);
    installPreparedHistoricalBankRateCatalogue(core, selected);
    historyCoverageEvidence(core, null, now);
    expect(spanReads).toBeGreaterThan(reads);
    expect(projection).toHaveBeenCalledTimes(3);
  } finally { gate.mockRestore(); projection.mockRestore(); }
});

it('reuses raw product reconciliation while checking real product chart projection again after gate changes', () => {
  const core = makeHealthyCore(); core.run_date = '2026-10-24';
  const source = { schema_version: 2, run_dates: ['2026-10-22', '2026-10-23', '2026-10-24'],
    sources: Object.fromEntries(['2026-10-22', '2026-10-23'].map(day => [day,
      { kind: 'retained_legacy_export', banks_sha256: 'a'.repeat(64), bytes: 100 }])),
    unavailable_dates: { '2026-10-24': 'Current core owns today' }, evidence: [{ status: 'unknown' }],
    sections: { Mortgage: [{ row: { provider: 'Bank', product_key: 'mortgage', product_name: 'Home loan' },
      spans: [[0, 2, [5, 7], 0]] }], Savings: [], TD: [] } };
  const ready = compileHistoricalBankRateReady(source, compiler.sha256);
  const prepared = catalogueProjection.prepareHistoricalBankRateReady(ready)!;
  const products = ready.products.Mortgage;
  let rawReads = 0;
  Object.defineProperty(ready.products, 'Mortgage', { get() { rawReads++; return products; } });
  installPreparedHistoricalBankRateCatalogue(core, prepared);
  const history: productProjection.ProductHistoryPayload = { schema_version: 3, run_date: core.run_date,
    run_dates: source.run_dates, products: { mortgage: [0.05, 0.06, null] } };
  let revision = 20;
  const gate = jest.spyOn(eligibilityGate, 'getMandatoryEligibilityRevision').mockImplementation(() => revision);
  const projection = jest.spyOn(productProjection, 'productSeriesRecordForChart');
  try {
    const now = Date.parse('2026-10-24T01:00:00Z');
    const first = historyCoverageEvidence(core, history, now), reads = rawReads, calls = projection.mock.calls.length;
    expect(reads).toBeGreaterThan(0);
    revision++;
    const second = historyCoverageEvidence(core, history, now);
    expect(second).not.toBe(first);
    expect(rawReads).toBe(reads);
    expect(projection.mock.calls.length).toBeGreaterThan(calls);
    expect(second.gaps).toEqual(first.gaps);
    const updated = { ...history, products: { mortgage: [0.05, 0.05, null] } };
    const third = historyCoverageEvidence(core, updated, now);
    expect(rawReads).toBeGreaterThan(reads);
    expect(third.gaps).not.toContainEqual(['2026-10-23', 'product-source-to-model-mismatch', 'Mortgage', 1, 'mortgage']);
  } finally { gate.mockRestore(); projection.mockRestore(); }
});

it('retains earlier selected fallback dates, source statistics and unknown metadata without false chart failures', () => {
  const core = makeHealthyCore(); core.run_date = '2026-10-24';
  const source = (dates: string[], provider: string, rates: number[]) => ({ schema_version: 2, run_dates: dates,
    sources: Object.fromEntries(dates.map(day => [day, { kind: 'retained_legacy_export', banks_sha256: 'a'.repeat(64), bytes: 100 }])),
    unavailable_dates: {}, evidence: [{ status: 'unknown' }],
    sections: { Mortgage: [{ row: { provider, product_key: provider, product_name: 'Home loan' },
      spans: [[0, dates.length, rates, 0]] }], Savings: [], TD: [] } });
  const primary = catalogueProjection.prepareHistoricalBankRateCatalogue(source(['2026-10-23'], 'Recent bank', [6]))!;
  const older = catalogueProjection.prepareHistoricalBankRateCatalogue(source(['2026-10-21', '2026-10-22'], 'Older bank', [5, 7]))!;
  const selected = catalogueProjection.selectHistoricalCatalogueDates(primary, new Set(['2026-10-23']), older);
  installPreparedHistoricalBankRateCatalogue(core, selected);
  const result = historyCoverageEvidence(core, null, Date.parse('2026-10-24T01:00:00Z'));
  expect(result).toMatchObject({ days: 4, sourceGapDays: [], processingMismatches: 0, chartProjectionMismatches: 0 });
  expect(result.gaps).toContainEqual(['2026-10-21', 'historical-detail-evidence-unknown', 'Mortgage', 2]);
  expect(result.gaps).toContainEqual(['2026-10-22', 'historical-detail-evidence-unknown', 'Mortgage', 2]);
  expect(result.gaps).toContainEqual(['2026-10-23', 'historical-detail-evidence-unknown', 'Mortgage', 1]);
  expect(result.gaps.some(([, reason]) => reason.startsWith('unexpected-chart'))).toBe(false);
});

it.each(['null', 'missing-product', 'missing-date'])(
  'keeps a missing current product-history observation explicit despite headline fallback: %s', kind => {
    const core = makeHealthyCore(); core.run_date = '2026-10-24';
    const key = core.sections.Mortgage.rates[0].product_key;
    const history: productProjection.ProductHistoryPayload = { schema_version: 3, run_date: core.run_date,
      run_dates: kind === 'missing-date' ? ['2026-10-23'] : ['2026-10-23', core.run_date],
      products: kind === 'missing-product' ? {} : { [key]: [0.061, null] } };
    const baseline = JSON.stringify(history);
    const result = historyCoverageEvidence(core, history, Date.parse('2026-10-24T01:00:00Z'));
    expect(result.gaps).toContainEqual(['2026-10-24', 'current-product-observation-missing', 'Mortgage', 1, key]);
    expect(result.gaps).not.toContainEqual(['2026-10-24', 'product-model-to-chart-mismatch', 'Mortgage', 1, key]);
    expect(result.chartProjectionMismatches).toBe(0);
    expect(JSON.stringify(history)).toBe(baseline);
  },
);

it('unavailable input and future stale days never create app processing gaps', () => {
  const result = reconcileHistoryCoverage({ ...evidence(), observedDay: '2026-10-26' },
    ['2026-10-23', '2026-10-24'], {}, { '2026-10-23': 'Not available' }, {}, { '2026-10-24': {} });
  expect(result.processingMismatches).toBe(0);
  expect(result.gaps.filter(([, reason]) => reason === 'processed-day-missing')).toEqual([]);
  expect(result.gaps).toContainEqual(['2026-10-23', 'historical-source-unavailable', null, 1]);
});

it('returned cached evidence cannot be corrupted through exposed arrays, tuples or counters', () => {
  const core = makeHealthyCore(); core.run_date = '2026-10-24';
  const now = Date.parse('2026-10-25T01:00:00Z');
  const first = historyCoverageEvidence(core, null, now), expected = JSON.stringify(first);
  expect(() => { first.gaps.push(['2026-10-25', 'processed-day-missing', null, 99]); }).toThrow(TypeError);
  expect(Reflect.set(first.gaps[0], '1', 'mutated')).toBe(false);
  expect(() => { first.sourceGapDays.push('2099-01-01'); }).toThrow(TypeError);
  expect(Reflect.set(first, 'processingMismatches', 99)).toBe(false);
  expect(JSON.stringify(historyCoverageEvidence(core, null, now))).toBe(expected);
});
