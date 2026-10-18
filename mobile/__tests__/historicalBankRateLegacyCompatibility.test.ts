import fixture from './fixtures/public_rates/history-rich-producer-6d33142.json';
import compiler from '../contracts/history-ready/compiler-manifest.json';
import { compileHistoricalBankRateReady } from '../src/data/historicalBankRateReadyCompiler';
import { historicalBankRateSnapshots, prepareHistoricalBankRateCatalogue, prepareHistoricalBankRateReady, selectHistoricalCatalogueDates } from '../src/data/historicalBankRateCatalogue';
import { prepareLegacyBankRateHistory } from '../src/data/historicalBankRateLegacyCompatibility';
import { cachedHistoricalBankRateCatalogue } from '../src/data/historicalBankRateCatalogueStore';
import { readyProductHistoryIdentity, productRatesFromHistoricalCatalogue } from '../src/data/productHistoryCatalogue';
import { bankRateScope } from '../src/data/bankRateOverview';
import { EMPTY_PROFILE } from '../src/data/profile';
import { sampleManifest } from '../src/data/sample';
import { SECTION_KEYS, type CorePayload } from '../src/types';
import type { DatesIndex } from '../src/data/datesIndex';
import type { PayloadRevisionHead } from '../src/data/payloadRevision';
import { historicalSourceIdentity } from '../src/data/historyIdentity';
import { syncProductHistoryFromDailyPayloads } from '../src/data/productHistorySync';
import { downloadDatedCore, fetchDatesIndexJson } from '../src/data/historyDaily';
import { HISTORY_DERIVATION_VERSION } from '../src/data/historyDerivation';
import { sampleCore } from '../src/data/sample';

let mockSelection: unknown;
jest.mock('../src/data/historicalBankRateReadySync', () => ({
  prepareReadyBankRateHistory: jest.fn(async () => true), selectedPreparedHistoryHeads: () => mockSelection,
}));
jest.mock('../src/data/bundledHistoricalBankRateCatalogue', () => { throw new Error('Obsolete raw APK archive must stay unreachable'); });
jest.mock('../src/lib/yieldToUi', () => ({ yieldToUi: jest.fn(async () => {}) }));
jest.mock('../src/data/historyDaily', () => ({ ...jest.requireActual('../src/data/historyDaily'),
  downloadDatedCore: jest.fn(), fetchDatesIndexJson: jest.fn() }));
const raw = prepareHistoricalBankRateCatalogue(fixture)!.catalogue;
const [older, rejected, latest] = Object.keys(raw.sources);
const heads = new Map(Object.entries(raw.sources).map(([day, source]) => [day, {
  revision: 1, manifest_sha256: source.kind === 'published_core' ? source.manifest_sha256 : '',
  bundle_sha256: 'a'.repeat(64), generation_id: 'fixture',
} as PayloadRevisionHead]));
const index = { dates: [...heads.keys()], revision_heads: Object.fromEntries(heads) } as DatesIndex;
const scope = bankRateScope({ Mortgage: [], Savings: [], TD: [] });
const core = (): CorePayload => ({ run_date: '2026-09-27', sections: {
  Mortgage: { rates: [] }, Savings: { rates: [] }, TD: { rates: [] },
} } as unknown as CorePayload);
const filters = { profileFilters: EMPTY_PROFILE, interests: SECTION_KEYS, includeNonStandard: true };
const oldProduct = 'AMP - My AMP|AMP_SAVER|TRANS_AND_SAVINGS_ACCOUNTS|AMP Saver Account';
const latestProduct = 'AMP Bank GO|7c034be5-b76d-4b26-959a-29ef8e045b7f|TRANS_AND_SAVINGS_ACCOUNTS|AMP Bank GO Save';

function capturedDay(position: number) {
  const day = raw.run_dates[position];
  return prepareHistoricalBankRateCatalogue({ ...raw, run_dates: [day], sources: { [day]: raw.sources[day] },
    sections: Object.fromEntries(SECTION_KEYS.map(section => [section, raw.sections[section].flatMap(tier => {
      const spans = tier.spans.filter(([start, count]) => position >= start && position < start + count)
        .map(([, , rates, evidence]) => [0, 1, rates, evidence]);
      return spans.length ? [{ ...tier, spans }] : [];
    })])) })!;
}

test('legacy observations and selected prepared fallback retain exact summaries without duplicate dates', async () => {
  const current = core(), ready = compileHistoricalBankRateReady(raw, compiler.sha256);
  const fallback = prepareHistoricalBankRateReady(ready, [older])!;
  mockSelection = { prepared: fallback, heads, conflicts: new Set([rejected]) };
  const archive = { ...raw, sources: { ...raw.sources,
    [older]: { ...raw.sources[older], manifest_sha256: 'd'.repeat(64) },
    [latest]: { kind: 'selected_contract' as const, banks_sha256: 'b'.repeat(64), bytes: 100,
      generation_id: 'verified-producer', contract_digest: 'c'.repeat(64) } } };
  // Protocol-only availability change; the masked source is never plotted.
  const prepared = prepareHistoricalBankRateCatalogue(raw)!;
  const expected = historicalBankRateSnapshots(prepared, current, scope, filters);
  expect(await prepareLegacyBankRateHistory(current, { ...sampleManifest, run_date: current.run_date }, index, archive, () => true)).toBe(true);
  const combined = cachedHistoricalBankRateCatalogue(current)!;
  const actual = historicalBankRateSnapshots(combined, current, scope, filters);
  expect(actual[older]).toEqual(expected[older]);
  expect(actual[latest]).toEqual(expected[latest]);
  expect(actual[rejected].sectionTotals).toBeUndefined();
  for (const section of SECTION_KEYS) expect(Object.keys(actual[rejected][section] ?? {})).toHaveLength(0);
  const products = await productRatesFromHistoricalCatalogue(combined, index, [older, rejected, latest], () => true, async () => {});
  expect(products.get(older)?.get(oldProduct)).toBe(0.0025);
  expect(products.get(latest)?.get(latestProduct)).toBe(0.0525);
  expect(products.has(rejected)).toBe(false);
  expect(readyProductHistoryIdentity(combined, index, older)).toBe(historicalSourceIdentity(index, older));
  expect(readyProductHistoryIdentity(combined, index, latest)).toMatch(/^catalogue:[a-f0-9]{64}$/);
  expect(readyProductHistoryIdentity(combined, index, rejected)).toBeUndefined();
});

test('accepted public observations retain exact rates and identities with no external index offline', async () => {
  const current = core(), fallback = prepareHistoricalBankRateReady(compileHistoricalBankRateReady(raw, compiler.sha256))!;
  mockSelection = { prepared: fallback, heads, conflicts: new Set() };
  await prepareLegacyBankRateHistory(current, sampleManifest, null, raw, () => true);
  const result = await syncProductHistoryFromDailyPayloads({ targetRunDate: current.run_date, currentCore: current,
    catalogue: cachedHistoricalBankRateCatalogue(current), preparedOnly: true, allowNetwork: false });
  expect(result.products[oldProduct][result.run_dates.indexOf(older)]).toBe(0.0025);
  expect(result.products[latestProduct][result.run_dates.indexOf(latest)]).toBe(0.0525);
  expect(result.source_identities?.[older]).toBe(historicalSourceIdentity(index, older));
  expect(downloadDatedCore).not.toHaveBeenCalled();
  expect(fetchDatesIndexJson).not.toHaveBeenCalled();
});

test('offline selected heads cannot resurrect a public date below a retained revision high-water mark', async () => {
  const current = { ...sampleCore, run_date: '2026-09-27' };
  mockSelection = { prepared: prepareHistoricalBankRateReady(compileHistoricalBankRateReady(raw, compiler.sha256))!, heads, conflicts: new Set() };
  await prepareLegacyBankRateHistory(current, sampleManifest, null, raw, () => true);
  const high = `revision:2:${'b'.repeat(64)}:${'c'.repeat(64)}`;
  const result = await syncProductHistoryFromDailyPayloads({ targetRunDate: current.run_date, currentCore: current,
    catalogue: cachedHistoricalBankRateCatalogue(current), preparedOnly: true, allowNetwork: false,
    existing: { schema_version: 3, derivation_version: HISTORY_DERIVATION_VERSION, run_date: current.run_date,
      run_dates: [older], products: {}, revision_high_water: { [older]: high } } });
  expect(result.source_identities?.[older]).toBeUndefined();
  expect(result.revision_high_water?.[older]).toBe(high);
  expect(Object.values(result.products).every(series => series[result.run_dates.indexOf(older)] === null)).toBe(true);
});

test('a superseded legacy request cannot install its history', async () => {
  const current = core();
  expect(await prepareLegacyBankRateHistory(current, sampleManifest, index, raw, () => false)).toBe(false);
  expect(cachedHistoricalBankRateCatalogue(current)).toBeNull();
});

test('a short legacy archive preserves later prepared fallback dates and reuses identical selection caches', () => {
  const current = core(), ready = compileHistoricalBankRateReady(raw, compiler.sha256);
  const fallback = prepareHistoricalBankRateReady(ready)!;
  const short = prepareHistoricalBankRateCatalogue({ ...raw, run_dates: [older], sources: { [older]: raw.sources[older] },
    sections: Object.fromEntries(SECTION_KEYS.map(section => [section, raw.sections[section].flatMap(tier => {
      const spans = tier.spans.filter(([start]) => start === 0);
      return spans.length ? [{ ...tier, spans }] : [];
    })])) })!;
  expect(short).not.toBeNull();
  const selected = selectHistoricalCatalogueDates(short, new Set([older]), fallback);
  expect(selectHistoricalCatalogueDates(short, new Set([older]), fallback)).toBe(selected);
  const actual = historicalBankRateSnapshots(selected, current, scope, filters);
  const expected = historicalBankRateSnapshots(fallback, current, scope, filters);
  expect(actual[latest]).toEqual(expected[latest]);
});

test('fallback-only unavailable dates remain explicit even when the primary covers every fallback observation', () => {
  const primary = capturedDay(raw.run_dates.indexOf(latest));
  const fallback = prepareHistoricalBankRateReady(compileHistoricalBankRateReady(raw, compiler.sha256), [latest])!;
  const combined = selectHistoricalCatalogueDates(primary, new Set([latest]), fallback);
  const snapshots = historicalBankRateSnapshots(combined, core(), scope, filters);
  expect(snapshots[older]).toEqual({});
  expect(Object.hasOwn(snapshots, raw.run_dates[1])).toBe(true);
  expect(snapshots[latest].sectionTotals).toBeDefined();
});

test('existing fallback dates do not consume the budget for newly inserted unknown dates', () => {
  const primary = capturedDay(0);
  const date = (offset: number) => new Date(Date.parse(older) + offset * 86_400_000).toISOString().slice(0, 10);
  // Only the first day is a captured observation; all added calendar days are unknown.
  const extended = { ...primary.catalogue, run_dates: Array.from({ length: 4997 }, (_, position) => date(position)) };
  const fallback = prepareHistoricalBankRateReady(compileHistoricalBankRateReady(extended, compiler.sha256))!;
  const combined = selectHistoricalCatalogueDates(primary, new Set([older]), fallback);
  const current = { ...core(), run_date: date(4999) };
  const snapshots = historicalBankRateSnapshots(combined, current, scope, filters);
  expect(snapshots[date(4997)]).toEqual({});
  expect(snapshots[date(4998)]).toEqual({});
  expect(Object.keys(snapshots)).toHaveLength(5000);
});
