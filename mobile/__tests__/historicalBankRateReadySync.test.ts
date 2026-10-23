import * as compiler from '../contracts/history-ready/compiler-manifest.json';
import { prepareReadyBankRateHistory } from '../src/data/historicalBankRateReadySync';
import { cachedHistoricalBankRateCatalogue, missingHistoricalCatalogueDates } from '../src/data/historicalBankRateCatalogueStore';
import { historicalBankRateSnapshots } from '../src/data/historicalBankRateCatalogue';
import { bankRateScope } from '../src/data/bankRateOverview';
import { EMPTY_PROFILE } from '../src/data/profile';
import { sampleCore, sampleManifest } from '../src/data/sample';
import type { HistoricalBankRateReady } from '../src/data/historicalBankRateReadyWire';
import type { DatesIndex } from '../src/data/datesIndex';
import { cache } from '../src/data/cache';
import { getBundledHistoricalBankRateReady } from '../src/data/bundledHistoricalBankRateReady';

let mockBaseline: HistoricalBankRateReady | null;
let mockIndex: DatesIndex | null;
let mockRetention: string | null = null;
jest.mock('../src/data/bundledHistoricalBankRateReady', () => ({
  getBundledHistoricalBankRateReady: jest.fn(async () => mockBaseline),
  bundledHistoricalReadyBinding: { get index() { return mockIndex; } },
}));
jest.mock('../src/data/cache', () => ({ cache: { readMeta: jest.fn(async () => null),
  readRetainedReadyHistory: jest.fn(async (decode: (text: string) => Promise<unknown>) => mockRetention ? decode(mockRetention) : null),
  writeRetainedReadyHistory: jest.fn(async (text: string, isCurrent: () => boolean) => { if (isCurrent()) mockRetention = text; }),
} }));
jest.mock('../src/lib/yieldToUi', () => ({ yieldToUi: jest.fn(async () => {}) }));
jest.mock('../src/lib/debugLog', () => ({ debugLog: { debug: jest.fn(), info: jest.fn(), warn: jest.fn() } }));

const day = '2026-09-26';
function ready(hash = 'a'.repeat(64)): HistoricalBankRateReady {
  return { schema_version: 1, semantic_revision: 'ar-history-ready-v1', compiler_sha256: compiler.sha256,
    run_dates: [day], sources: { [day]: { kind: 'published_core', core_sha256: 'c'.repeat(64),
      details_sha256: 'd'.repeat(64), manifest_sha256: hash } }, unavailable_dates: {}, quarantined_tier_count: 0,
    sections: { Mortgage: [['Bank', [null, null, null, null], false, false, 0, [[0, [[5, 2]]], [1, [[5, -2]]]]]], Savings: [], TD: [] },
    products: { Mortgage: [['product', [[0, 1, 5]]]], Savings: [], TD: [] } };
}
function index(hash = 'a'.repeat(64), revision = 1): DatesIndex {
  return { schema_version: 1, dates: [day], count: 1, min_date: day, latest_date: day, revision_protocol: 1,
    revision_heads: { [day]: { revision, generation_id: `sha256-${hash}`, bundle_sha256: hash, manifest_sha256: hash,
      manifest_url: `https://github.com/yanniedog/AR-local/releases/download/app-payload-${day}-r${String(revision).padStart(6, '0')}/manifest.json` } } };
}
function current() {
  const core = { ...sampleCore, run_date: '2026-09-29', sections: { Mortgage: { ...sampleCore.sections.Mortgage, rates: [] },
    Savings: { ...sampleCore.sections.Savings, rates: [] }, TD: { ...sampleCore.sections.TD, rates: [] } } };
  return { core, manifest: { ...sampleManifest, run_date: core.run_date } };
}
beforeEach(() => { mockBaseline = ready(); mockIndex = index(); mockRetention = null; jest.clearAllMocks(); });

test('a failed same-owner retry keeps the installed catalogue and known gaps', async () => {
  const { core, manifest } = current();
  await prepareReadyBankRateHistory(core, manifest, null, null);
  const previous = cachedHistoricalBankRateCatalogue(core), missing = [...missingHistoricalCatalogueDates(core)];
  jest.mocked(getBundledHistoricalBankRateReady).mockRejectedValueOnce(new Error('fallback decode unavailable'));
  await expect(prepareReadyBankRateHistory(core, manifest, null, null)).rejects.toThrow('fallback decode unavailable');
  expect(cachedHistoricalBankRateCatalogue(core)).toBe(previous);
  expect(missingHistoricalCatalogueDates(core)).toEqual(missing);
});

test('prepared fallback retains trailing calendar gaps and reuses warm preparation', async () => {
  const { core, manifest } = current();
  expect(await prepareReadyBankRateHistory(core, manifest, null, null)).toBe(true);
  const prepared = cachedHistoricalBankRateCatalogue(core)!;
  expect(missingHistoricalCatalogueDates(core)).toEqual(['2026-09-27', '2026-09-28']);
  const snapshots = historicalBankRateSnapshots(prepared, core, bankRateScope({ Mortgage: [], Savings: [], TD: [] }),
    { profileFilters: EMPTY_PROFILE, includeNonStandard: true, interests: ['Mortgage'] });
  expect(snapshots[day].Mortgage?.Bank.count).toBe(2);
  expect(snapshots['2026-09-27']).toEqual({});
  await prepareReadyBankRateHistory(core, manifest, null, null);
  expect(cachedHistoricalBankRateCatalogue(core)).toBe(prepared);
});

test('a stale detached publication cannot replace a newer bundled revision', async () => {
  const { core, manifest } = current();
  mockBaseline = ready('b'.repeat(64)); mockIndex = index('b'.repeat(64), 2);
  await prepareReadyBankRateHistory(core, manifest, index(), ready());
  expect(cachedHistoricalBankRateCatalogue(core)?.catalogue.sources[day]).toEqual(mockBaseline.sources[day]);
});

test('equal-revision equivocation becomes a gap', async () => {
  const { core, manifest } = current();
  await prepareReadyBankRateHistory(core, manifest, index('b'.repeat(64)), ready('b'.repeat(64)));
  expect(cachedHistoricalBankRateCatalogue(core)?.catalogue.sources[day]).toBeUndefined();
  expect(missingHistoricalCatalogueDates(core)).toContain(day);
});

test('a primary prepared observation is not counted twice through its fallback', async () => {
  const { core, manifest } = current();
  await prepareReadyBankRateHistory(core, manifest, mockIndex, ready());
  const prepared = cachedHistoricalBankRateCatalogue(core)!;
  const snapshots = historicalBankRateSnapshots(prepared, core, bankRateScope({ Mortgage: [], Savings: [], TD: [] }),
    { profileFilters: EMPTY_PROFILE, includeNonStandard: true, interests: ['Mortgage'] });
  expect(snapshots[day].Mortgage?.Bank.count).toBe(2);
});

test('cancelled preparation cannot install or clear a successor', async () => {
  const { core, manifest } = current();
  await prepareReadyBankRateHistory(core, manifest, mockIndex, ready());
  const installed = cachedHistoricalBankRateCatalogue(core);
  expect(await prepareReadyBankRateHistory(core, manifest, null, null, () => false)).toBe(false);
  expect(cachedHistoricalBankRateCatalogue(core)).toBe(installed);
});

test('missing prepared sources do not decode an embedded raw catalogue', async () => {
  const { core, manifest } = current();
  mockBaseline = null; mockIndex = null;
  Object.defineProperty(core, 'bank_rate_history_catalogue', { get() { throw new Error('Raw catalogue must not be opened'); } });
  expect(await prepareReadyBankRateHistory(core, manifest, null, null)).toBe(false);
  expect(cachedHistoricalBankRateCatalogue(core)).toBeNull();
});

test('public observations newer than the APK survive a later partial core and a cold cache restore', async () => {
  const { core, manifest } = current();
  const nextDay = '2026-09-28', publicReady = ready('b'.repeat(64));
  publicReady.run_dates = [nextDay]; publicReady.sources = { [nextDay]: publicReady.sources[day] };
  const selected = index(); selected.dates.push(nextDay);
  selected.revision_heads![nextDay] = { ...index('b'.repeat(64), 2).revision_heads![day],
    manifest_url: `https://github.com/yanniedog/AR-local/releases/download/app-payload-${nextDay}-r000002/manifest.json` };
  await prepareReadyBankRateHistory(core, manifest, selected, publicReady);
  expect(mockRetention).not.toBeNull();
  const nextCore = { ...core, run_date: '2026-09-30' }, nextManifest = { ...manifest, run_date: nextCore.run_date };
  await prepareReadyBankRateHistory(nextCore, nextManifest, selected, ready());
  expect(cachedHistoricalBankRateCatalogue(nextCore)?.catalogue.sources[nextDay]).toEqual(publicReady.sources[nextDay]);
  // A new owner has no in-memory installed receipt. Only the serialized cache
  // (decoded afresh by the mock) can restore the absent detached observation.
  const cold = { ...nextCore };
  await prepareReadyBankRateHistory(cold, nextManifest, null, null);
  expect(cachedHistoricalBankRateCatalogue(cold)?.catalogue.sources[nextDay]).toEqual(publicReady.sources[nextDay]);
  expect(missingHistoricalCatalogueDates(cold)).not.toContain(nextDay);
  expect(cache.writeRetainedReadyHistory).toHaveBeenCalledTimes(1);
  const revised = { ...selected, revision_heads: { ...selected.revision_heads, [nextDay]: { ...selected.revision_heads![nextDay],
    revision: 3, manifest_sha256: 'f'.repeat(64), manifest_url: `https://github.com/yanniedog/AR-local/releases/download/app-payload-${nextDay}-r000003/manifest.json` } } };
  await prepareReadyBankRateHistory(cold, nextManifest, revised, null);
  expect(cachedHistoricalBankRateCatalogue(cold)?.catalogue.sources[nextDay]).toBeUndefined();
  const afterRestart = { ...cold };
  await prepareReadyBankRateHistory(afterRestart, nextManifest, selected, publicReady);
  expect(cachedHistoricalBankRateCatalogue(afterRestart)?.catalogue.sources[nextDay]).toBeUndefined();
});

test('independent producer observations never carry across core payloads', async () => {
  const { core, manifest } = current();
  const value = ready();
  value.run_dates = ['2026-09-28']; value.sources = { '2026-09-28': { kind: 'selected_contract',
    banks_sha256: 'b'.repeat(64), bytes: 100, contract_digest: 'c'.repeat(64), generation_id: 'independent' } };
  await prepareReadyBankRateHistory(core, manifest, mockIndex, value);
  expect(cachedHistoricalBankRateCatalogue(core)?.catalogue.sources['2026-09-28']).toBeDefined();
  const nextCore = { ...core, run_date: '2026-09-30' };
  await prepareReadyBankRateHistory(nextCore, { ...manifest, run_date: nextCore.run_date }, mockIndex, null);
  expect(cachedHistoricalBankRateCatalogue(nextCore)?.catalogue.sources['2026-09-28']).toBeUndefined();
});

test('a temporary independent producer overlay cannot erase retained public history', async () => {
  const { core, manifest } = current();
  mockBaseline = null;
  const published = ready();
  await prepareReadyBankRateHistory(core, manifest, index(), published);
  const independent = ready(); independent.sources[day] = { kind: 'retained_legacy_export', banks_sha256: 'b'.repeat(64), bytes: 100 };
  const second = { ...core };
  await prepareReadyBankRateHistory(second, manifest, index(), independent);
  expect(cachedHistoricalBankRateCatalogue(second)?.catalogue.sources[day].kind).toBe('retained_legacy_export');
  const third = { ...core };
  await prepareReadyBankRateHistory(third, manifest, null, null);
  expect(cachedHistoricalBankRateCatalogue(third)?.catalogue.sources[day]).toEqual(published.sources[day]);
  expect(cache.writeRetainedReadyHistory).toHaveBeenCalledTimes(1);
});

test('a failed checkpoint write preserves the previous durable public observations', async () => {
  const { core, manifest } = current(); mockBaseline = null;
  await prepareReadyBankRateHistory(core, manifest, index(), ready());
  const previous = mockRetention;
  jest.mocked(cache.writeRetainedReadyHistory).mockRejectedValueOnce(new Error('capacity'));
  const newer = ready('b'.repeat(64));
  await prepareReadyBankRateHistory({ ...core }, manifest, index('b'.repeat(64), 2), newer);
  expect(mockRetention).toBe(previous);
  expect(cache.writeRetainedReadyHistory).toHaveBeenCalledTimes(2);
});
