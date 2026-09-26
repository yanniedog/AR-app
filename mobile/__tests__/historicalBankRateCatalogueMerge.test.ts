import { upsertHistoricalCatalogueDay } from '../src/data/historicalBankRateCatalogueMerge';
import { historicalBankRateSnapshots, prepareHistoricalBankRateCatalogue } from '../src/data/historicalBankRateCatalogue';
import { validateHistoricalBankRateCatalogue } from '../src/data/historicalBankRateCatalogueWire';
import { bankRateScope } from '../src/data/bankRateOverview';
import { EMPTY_PROFILE } from '../src/data/profile';
import type { CorePayload, DetailsPayload, ProductDetail, RateRow } from '../src/types';

const source = { kind: 'published_core' as const, core_sha256: 'a'.repeat(64), details_sha256: 'b'.repeat(64), manifest_sha256: 'c'.repeat(64) };
const row = (extra: Partial<RateRow> = {}): RateRow => ({ provider: 'Alpha', product_id: 'p', product_key: 'Alpha|p',
  product_name: 'Ordinary loan', category: 'RESIDENTIAL_MORTGAGES', rate: '0.05', rate_type: 'VARIABLE', ...extra });
const core = (date: string, rows: RateRow[] = [row()]) => ({ run_date: date,
  sections: { Mortgage: { rates: rows }, Savings: { rates: [] }, TD: { rates: [] } } } as unknown as CorePayload);
const detail: ProductDetail = { description: 'Ordinary retail home loan.', displayIdentity: { name: 'Ordinary loan', provider: 'Alpha', productCategory: 'RESIDENTIAL_MORTGAGES' },
  facts: [{ id: 'offset', canonicalKey: 'OFFSET', sourceType: 'OFFSET', kind: 'feature', value: true, unit: 'boolean' }] };
const details = (date: string, value: ProductDetail = detail): DetailsPayload => ({ schema_version: 1, run_date: date, products: { 'Alpha|p': value } });
const day1 = '2026-09-20', day2 = '2026-09-21', day3 = '2026-09-22';

test('upsert extends and prepends a complete calendar while retaining original core identities', () => {
  const original = row(); const current = core(day3, [original]);
  const before = JSON.stringify(current);
  const first = upsertHistoricalCatalogueDay(null, current, details(day3), source);
  const saved = JSON.stringify(first);
  const earlier = upsertHistoricalCatalogueDay(first, core(day1), details(day1), source);
  expect(earlier.run_dates).toEqual([day1, day2, day3]);
  expect(earlier.sections.Mortgage[0].spans).toEqual([[0, 1, [5], 1], [2, 1, [5], 1]]);
  expect(earlier.sources[day2]).toBeUndefined();
  expect(earlier.evidence).toHaveLength(2);
  expect(JSON.stringify(first)).toBe(saved); expect(JSON.stringify(current)).toBe(before);
  expect(current.sections.Mortgage.rates[0]).toBe(original);
  expect(Object.hasOwn(original, 'bank_rate_tier')).toBe(false);
});

test('changed historical features split unchanged rates; same evidence coalesces adjoining observations', () => {
  const first = upsertHistoricalCatalogueDay(null, core(day1), details(day1), source);
  const second = upsertHistoricalCatalogueDay(first, core(day2), details(day2), source);
  expect(second.sections.Mortgage[0].spans).toEqual([[0, 2, [5], 1]]);
  const denied = { ...detail, facts: detail.facts!.map(f => ({ ...f, value: false })) };
  const third = upsertHistoricalCatalogueDay(second, core(day3), details(day3, denied), source);
  expect(third.sections.Mortgage[0].spans).toEqual([[0, 2, [5], 1], [2, 1, [5], 2]]);
  const settings = { includeNonStandard: false, interests: ['Mortgage' as const], profileFilters: { ...EMPTY_PROFILE, accountFeatures: ['OFFSET'] } };
  const output = historicalBankRateSnapshots(prepareHistoricalBankRateCatalogue(third)!, core('2026-09-23', []), bankRateScope({ Mortgage: [], Savings: [], TD: [] }), settings);
  expect(output[day2].Mortgage!.Alpha.mean).toBe(5);
  expect(output[day3].Mortgage!.Alpha).toBeUndefined();
});

test('corrected date replaces all old observations and source identity without stacking or resurrecting removed products', () => {
  const old = row({ product_id: 'removed', product_key: 'removed', product_name: 'Withdrawn' });
  let history = upsertHistoricalCatalogueDay(null, core(day1, [row(), old]), details(day1), source);
  history = upsertHistoricalCatalogueDay(history, core(day2, [row(), old]), details(day2), source);
  history = upsertHistoricalCatalogueDay(history, core(day3, [row(), old]), details(day3), source);
  const before = JSON.stringify(history);
  const correctedSource = { ...source, core_sha256: 'd'.repeat(64), manifest_sha256: 'e'.repeat(64) };
  const corrected = upsertHistoricalCatalogueDay(history, core(day2, [row({ rate: '0.09' })]), details(day2), correctedSource);
  expect(corrected.sections.Mortgage[0].spans).toEqual([[0, 1, [5], 1], [1, 1, [9], 1], [2, 1, [5], 1]]);
  expect(corrected.sections.Mortgage[1].spans).toEqual([[0, 1, [5], 0], [2, 1, [5], 0]]);
  expect(corrected.sources[day2]).toEqual(correctedSource);
  expect(JSON.stringify(history)).toBe(before);
  const removed = upsertHistoricalCatalogueDay(corrected, core(day2, []), details(day2), correctedSource);
  expect(removed.sections.Mortgage[0].spans).toEqual([[0, 1, [5], 1], [2, 1, [5], 1]]);
  expect(validateHistoricalBankRateCatalogue(removed)).toBe(true);
});

test.each([
  ['missing details', null],
  ['wrong date', details(day1)],
  ['wrong display provider', details(day2, { ...detail, displayIdentity: { provider: 'Other' } })],
  ['wrong display name', details(day2, { ...detail, displayIdentity: { name: 'Other' } })],
  ['wrong display category', details(day2, { ...detail, displayIdentity: { productCategory: 'OTHER' } })],
  ['malformed display identity', details(day2, { ...detail, displayIdentity: 'bad' } as unknown as ProductDetail)],
  ['empty projected detail', details(day2, {})],
  ['invalid feature variant', details(day2, { ...detail, facts: [...detail.facts!, { ...detail.facts![0], id: '' }] })],
])('%s produces unknown evidence without borrowing earlier positive facts', (_label, available) => {
  const history = upsertHistoricalCatalogueDay(null, core(day1), details(day1), source);
  const next = upsertHistoricalCatalogueDay(history, core(day2), available, source);
  expect(next.sections.Mortgage[0].spans).toEqual([[0, 1, [5], 1], [1, 1, [5], 0]]);
});

test('legacy same-manifest details without displayIdentity remain usable; present fields normalize whitespace and case', () => {
  const legacy = { ...detail }; delete legacy.displayIdentity;
  const first = upsertHistoricalCatalogueDay(null, core(day1), details(day1, legacy), source);
  expect(first.sections.Mortgage[0].spans[0][3]).toBe(1);
  const identity = { name: '  ORDINARY   LOAN ', provider: ' alpha ', productCategory: 'residential_mortgages' };
  const second = upsertHistoricalCatalogueDay(first, core(day2), details(day2, { ...detail, displayIdentity: identity }), source);
  expect(second.evidence).toHaveLength(2);
  expect(second.sections.Mortgage[0].spans).toEqual([[0, 2, [5], 1]]);
});

test('empty published detail arrays do not duplicate equivalent producer evidence', () => {
  const first = upsertHistoricalCatalogueDay(null, core(day1), details(day1), source);
  const next = upsertHistoricalCatalogueDay(first, core(day2), details(day2, { ...detail, eligibility: [], constraints: [] }), source);
  expect(next.evidence).toHaveLength(2);
  expect(next.sections.Mortgage[0].spans).toEqual([[0, 2, [5], 1]]);
});

test('conflicting row identities for a shared product key cannot donate details to either tier', () => {
  const rows = [row(), row({ provider: 'Other', product_id: 'other' })];
  const result = upsertHistoricalCatalogueDay(null, core(day1, rows), details(day1), source);
  expect(result.sections.Mortgage.map(t => t.spans[0][3])).toEqual([0, 0]);
  expect(result.evidence).toEqual([{ status: 'unknown' }]);
});

test('multiplicity survives distinct source rates while observation-only fields never change the tier', () => {
  const rows = [row(), row({ rate: '0.04', last_updated: 'now', rate_index: 8 }), row()];
  const result = upsertHistoricalCatalogueDay(null, core(day1, rows), details(day1), source);
  expect(result.sections.Mortgage).toHaveLength(1);
  expect(result.sections.Mortgage[0].spans[0][2]).toEqual([4, 5, 5]);
  expect(Object.hasOwn(result.sections.Mortgage[0].row, 'rate_index')).toBe(false);
});

test('a verified replacement clears that date missing marker and rejects invalid source identities', () => {
  const history = upsertHistoricalCatalogueDay(null, core(day1), details(day1), source);
  const gap = { ...history, sections: { ...history.sections, Mortgage: [] }, unavailable_dates: { [day1]: 'unresolved' } };
  const result = upsertHistoricalCatalogueDay(gap, core(day1), details(day1), source);
  expect(result.unavailable_dates).toEqual({});
  expect(() => upsertHistoricalCatalogueDay(history, core(day2), details(day2), { ...source, manifest_sha256: 'invalid' })).toThrow('identity');
  expect(() => upsertHistoricalCatalogueDay(history, core('2000-01-01'), null, source)).toThrow('budget');
});
