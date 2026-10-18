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

let mockSelection: unknown;
jest.mock('../src/data/historicalBankRateReadySync', () => ({
  prepareReadyBankRateHistory: jest.fn(async () => true), selectedPreparedHistoryHeads: () => mockSelection,
}));
jest.mock('../src/data/bundledHistoricalBankRateCatalogue', () => { throw new Error('Obsolete raw APK archive must stay unreachable'); });
jest.mock('../src/lib/yieldToUi', () => ({ yieldToUi: jest.fn(async () => {}) }));
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
  expect(products.has(older)).toBe(true);
  expect(products.has(latest)).toBe(true);
  expect(products.has(rejected)).toBe(false);
  expect(readyProductHistoryIdentity(combined, index, older)).toMatch(/^revision:/);
  expect(readyProductHistoryIdentity(combined, index, latest)).toBe(`catalogue:${'b'.repeat(64)}`);
  expect(readyProductHistoryIdentity(combined, index, rejected)).toBeUndefined();
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
