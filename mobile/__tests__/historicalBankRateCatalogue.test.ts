import fixture from './fixtures/bankwest-easy-saver-eligibility-20260913.json';
import { cachedHistoricalBankRateSnapshots, historicalBankRateSnapshots, historicalBankRateSnapshotsAsync, prepareHistoricalBankRateCatalogue, prepareHistoricalBankRateCatalogueAsync, type HistoricalCatalogueFilters } from '../src/data/historicalBankRateCatalogue';
import { HISTORICAL_CATALOGUE_LIMITS, validateHistoricalBankRateCatalogue, validateHistoricalBankRateCatalogueAsync, type HistoricalBankRateCatalogue,
  type HistoricalCatalogueEvidence, type HistoricalCatalogueTier, type HistoricalRateDescriptor } from '../src/data/historicalBankRateCatalogueWire';
import { bankRateScope, buildBankRateChart, RATE_OBSERVATION_FIELDS, summarizeBankRates } from '../src/data/bankRateOverview';
import { EMPTY_PROFILE } from '../src/data/profile';
import { installMandatoryEligibility, mandatoryEligibleRows } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import { setSuitabilityAllowed } from '../src/data/suitabilityGate';
import { visibleAccountRows } from '../src/data/format';
import type { CorePayload, NormalizedProductFact, ProductDetail, RateRow, SectionKey } from '../src/types';

const day = ['2026-09-20', '2026-09-21', '2026-09-22'];
const hash = 'a'.repeat(64);
const source = { kind: 'published_core' as const, core_sha256: hash, details_sha256: hash, manifest_sha256: hash };
const descriptor = (extra: Partial<HistoricalRateDescriptor> = {}): HistoricalRateDescriptor => ({
  provider: 'Alpha', product_id: 'p', product_key: 'alpha-p', product_name: 'Ordinary loan', category: 'RESIDENTIAL_MORTGAGES',
  rate_type: 'VARIABLE', loan_purpose: 'OWNER_OCCUPIED', ribbon_repayment_type: 'PRINCIPAL_AND_INTEREST', lvr_tier: 'lvr_60-80%',
  account_class: 'standard', ...extra,
});
const fact = (extra: Partial<NormalizedProductFact> = {}): NormalizedProductFact => ({
  id: 'feature:offset', kind: 'feature', canonicalKey: 'OFFSET', sourceType: 'OFFSET', value: true, unit: 'boolean', ...extra,
});
const evidence = (row: HistoricalRateDescriptor, detail: ProductDetail = { description: 'An ordinary retail product.' }, section: SectionKey = 'Mortgage'): HistoricalCatalogueEvidence => ({
  status: 'known', identity: { provider: row.provider, product_id: row.product_id!, product_key: row.product_key, category: row.category!, dataset: section }, detail,
});
function pack(tiers: HistoricalCatalogueTier[] = [{ row: descriptor(), spans: [[0, 3, [5], 1]] }]): HistoricalBankRateCatalogue {
  return { schema_version: 2, run_dates: [...day], sources: Object.fromEntries(day.map(d => [d, source])), unavailable_dates: {},
    evidence: [{ status: 'unknown' }, evidence(tiers[0]?.row ?? descriptor())], sections: { Mortgage: tiers, Savings: [], TD: [] } };
}
const row = (value = '0.06', extra: Partial<RateRow> = {}): RateRow => ({ ...descriptor(), rate: value, ...extra });
const core = (rows: RateRow[] = [], date = day[2]): CorePayload => ({ run_date: date,
  sections: { Mortgage: { rates: rows }, Savings: { rates: [] }, TD: { rates: [] } } } as unknown as CorePayload);
const scope = (rows: RateRow[] = []) => bankRateScope({ Mortgage: rows, Savings: [], TD: [] });
const filters: HistoricalCatalogueFilters = { profileFilters: EMPTY_PROFILE, interests: ['Mortgage', 'Savings', 'TD'], includeNonStandard: false };
const snapshot = (catalogue: HistoricalBankRateCatalogue, settings = filters, current = core(), currentScope = scope()) =>
  historicalBankRateSnapshots(prepareHistoricalBankRateCatalogue(catalogue)!, current, currentScope, settings);

beforeEach(() => {
  installMandatoryEligibility(selectMandatoryEligibility(null, EMPTY_PROFILE, null));
  setSuitabilityAllowed(null);
});
afterEach(() => { installMandatoryEligibility(selectMandatoryEligibility(null, EMPTY_PROFILE, null)); setSuitabilityAllowed(null); });

test('all historical cohorts include withdrawn providers and retain exact multiplicity, zero and gaps', () => {
  const withdrawn = descriptor({ provider: 'Withdrawn Bank', product_key: 'old', product_id: 'old' });
  const catalogue = pack([{ row: descriptor(), spans: [[0, 2, [0, 2, 6, 12], 1]] }, { row: withdrawn, spans: [[0, 1, [8], 2]] }]);
  catalogue.evidence.push(evidence(withdrawn));
  const current = core([row()]);
  const result = snapshot(catalogue, filters, current, scope(current.sections.Mortgage.rates));
  expect(result[day[0]].Mortgage!.Alpha).toEqual({ min: 0, mean: 5, median: 4, max: 12, count: 4 });
  expect(result[day[0]].Mortgage!['Withdrawn Bank'].mean).toBe(8);
  expect(result[day[1]].Mortgage!['Withdrawn Bank']).toBeUndefined();
  expect(result[day[2]].Mortgage).toEqual(summarizeBankRates(current.sections.Mortgage.rates));
  expect(buildBankRateChart(result, 'Mortgage', 'mean', false, null).lines.map(l => l.provider)).toEqual(['Alpha', 'Withdrawn Bank']);
});

test('historical access and features use each span evidence, never the installed current gates', () => {
  const catalogue = pack([{ row: descriptor(), spans: [[0, 1, [5], 1], [1, 1, [5], 2]] }]);
  catalogue.evidence[1] = evidence(descriptor(), { facts: [fact()] });
  catalogue.evidence.push(evidence(descriptor(), { eligibility: [{ label: 'STAFF' }], facts: [fact({ value: false })] }));
  const current = core([row()]);
  const settings = { ...filters, profileFilters: { ...EMPTY_PROFILE, accountFeatures: ['OFFSET'] } };
  installMandatoryEligibility(selectMandatoryEligibility(current, settings.profileFilters, { 'alpha-p': { facts: [fact()] } }));
  setSuitabilityAllowed(new Set(['alpha-p']));
  expect(mandatoryEligibleRows([descriptor() as RateRow])).toEqual([]);
  const result = snapshot(catalogue, settings, current, scope(current.sections.Mortgage.rates));
  expect(result[day[0]].Mortgage!.Alpha.mean).toBe(5);
  expect(result[day[1]].Mortgage!.Alpha).toBeUndefined();
  expect(result[day[2]].Mortgage!.Alpha.mean).toBe(6);
  // Today's positive facts cannot admit the historical negative or staff-only edition.
  expect(snapshot(catalogue, filters)[day[1]].Mortgage!.Alpha).toBeUndefined();
});

test.each([
  ['missing facts', { description: 'An ordinary retail product.' }],
  ['conditional positive', { facts: [fact({ condition: 'Package required' })] }],
  ['contradiction', { facts: [fact(), fact({ id: 'conflict', value: false })] }],
  ['wrong scope', { facts: [fact({ appliesTo: ['FIXED'] })] }],
])('required feature excludes %s even in full-catalogue mode', (_label, detail) => {
  const catalogue = pack(); catalogue.evidence[1] = evidence(descriptor(), detail);
  const settings = { ...filters, includeNonStandard: true, profileFilters: { ...EMPTY_PROFILE, accountFeatures: ['OFFSET'] } };
  expect(snapshot(catalogue, settings)[day[0]].Mortgage!.Alpha).toBeUndefined();
});

test('unknown metadata cannot pass broadly applicable or required-feature filters', () => {
  const catalogue = pack([{ row: descriptor({ feature_set: 'OFFSET' }), spans: [[0, 2, [5], 0]] }]);
  expect(snapshot(catalogue)[day[0]].Mortgage!.Alpha).toBeUndefined();
  expect(snapshot(catalogue, { ...filters, includeNonStandard: true })[day[0]].Mortgage!.Alpha.mean).toBe(5);
  expect(snapshot(catalogue, { ...filters, includeNonStandard: true, profileFilters: { ...EMPTY_PROFILE, accountFeatures: ['OFFSET'] } })[day[0]].Mortgage!.Alpha).toBeUndefined();
});

test('structural profile filters apply to historical descriptors, without current-tier membership', () => {
  const old = descriptor({ product_id: 'withdrawn', product_key: 'withdrawn', lvr_tier: 'lvr_80-90%' });
  const catalogue = pack([{ row: descriptor(), spans: [[0, 2, [5], 1]] }, { row: old, spans: [[0, 2, [7], 2]] }]);
  catalogue.evidence.push(evidence(old));
  const settings = { ...filters, profileFilters: { ...EMPTY_PROFILE, lvrTiers: ['lvr_80-90%'] } };
  expect(snapshot(catalogue, settings)[day[0]].Mortgage!.Alpha.mean).toBe(7);
  expect(snapshot(catalogue, { ...settings, interests: ['TD'] })[day[0]].Mortgage).toBeUndefined();
});

test('real Bankwest ordinary/prize siblings retain per-row historical restrictions', () => {
  const catalogue = pack([]);
  const rows = fixture.rates as RateRow[];
  const descriptors = rows.map(r => Object.fromEntries(Object.entries(r).filter(([key]) => !RATE_OBSERVATION_FIELDS.has(key))) as HistoricalRateDescriptor);
  const detail = { description: fixture.detail.description, eligibility: fixture.detail.eligibility, constraints: fixture.detail.constraints };
  catalogue.evidence = [{ status: 'unknown' }, evidence(descriptors[0], detail, 'Savings')];
  catalogue.sections.Savings = descriptors.map((r, i) => ({ row: r, spans: [[0, 2, [Number(rows[i].rate) * 100], 1]] }));
  setSuitabilityAllowed(new Set([rows[0].product_key]));
  const result = snapshot(catalogue);
  expect(result[day[0]].Savings!.Bankwest).toEqual({ min: 5, max: 5, mean: 5, median: 5, count: 1 });
  expect(snapshot(catalogue, { ...filters, includeNonStandard: true })[day[0]].Savings!.Bankwest.count).toBe(2);
  expect(visibleAccountRows(rows, false, { [rows[0].product_key]: detail })).toEqual([rows[0]]);
});

test('historical section quarantine rejects Savings-shaped term deposits before aggregation', () => {
  const catalogue = pack([]); const bad = descriptor({ product_name: 'Term Deposit Plus', category: 'TRANS_AND_SAVINGS_ACCOUNTS' });
  catalogue.sections.Savings = [{ row: bad, spans: [[0, 3, [50], 0]] }];
  const prepared = prepareHistoricalBankRateCatalogue(catalogue)!;
  expect(prepared.quarantinedTierCount).toBe(1);
  expect(snapshot(catalogue, { ...filters, includeNonStandard: true })[day[0]].Savings).toEqual({});
});

test('shared access cache cannot admit restricted names or rate siblings through an ordinary tier', () => {
  const catalogue = pack([
    { row: descriptor(), spans: [[0, 2, [5], 1]] },
    { row: descriptor({ lvr_tier: 'lvr_80-90%' }), spans: [[0, 2, [6], 1]] },
    { row: descriptor({ product_name: 'Staff Home Loan' }), spans: [[0, 2, [50], 1]] },
    { row: descriptor({ account_class: 'non_standard' }), spans: [[0, 2, [40], 1]] },
    { row: descriptor({ taxonomy_path: 'SAVINGS.BONUS' }), spans: [[0, 2, [30], 1]] },
  ]);
  expect(snapshot(catalogue)[day[0]].Mortgage!.Alpha).toEqual({ min: 5, max: 6, mean: 5.5, median: 5.5, count: 2 });
  expect(snapshot(catalogue, { ...filters, includeNonStandard: true })[day[0]].Mortgage!.Alpha.count).toBe(5);
});

test('current day uses only original current rows and respects a newly closed mandatory gate', () => {
  const original = row(); const current = core([original]); const catalogue = pack();
  const before = JSON.stringify(current); const currentScope = scope([original, { ...original }, row('0.99')]);
  expect(snapshot(catalogue, filters, current, currentScope)[day[2]].Mortgage!.Alpha.count).toBe(1);
  installMandatoryEligibility(selectMandatoryEligibility(current, { ...EMPTY_PROFILE, rateTypes: ['FIXED'] }, null));
  expect(snapshot(catalogue, filters, current, currentScope)[day[2]].Mortgage).toEqual({});
  expect(current.sections.Mortgage.rates[0]).toBe(original);
  expect(JSON.stringify(current)).toBe(before);
  expect(Object.hasOwn(original, 'bank_rate_tier')).toBe(false);
});

test('cutoff excludes later catalogue observations; legacy newer core adds actual rates with calendar gaps', () => {
  const catalogue = pack(); const early = core([row('0.07')], day[1]);
  const result = snapshot(catalogue, filters, early, scope(early.sections.Mortgage.rates));
  expect(Object.keys(result)).toEqual(day.slice(0, 2));
  expect(result[day[1]].Mortgage!.Alpha.mean).toBeCloseTo(7);
  const newer = core([row('0.08')], '2026-09-25');
  const extended = snapshot(catalogue, filters, newer, scope(newer.sections.Mortgage.rates));
  expect(extended['2026-09-23']).toEqual({}); expect(extended['2026-09-24']).toEqual({});
  expect(extended['2026-09-25'].Mortgage!.Alpha.mean).toBe(8);
});

test('cache reuses all-bank snapshots for equivalent filters and never reuses corrected catalogue data', () => {
  const catalogue = pack(), current = core([row()]); const prepared = prepareHistoricalBankRateCatalogue(catalogue)!;
  expect(prepareHistoricalBankRateCatalogue(catalogue)).toBe(prepared);
  const selected = scope(current.sections.Mortgage.rates);
  const first = historicalBankRateSnapshots(prepared, current, selected, filters);
  expect(historicalBankRateSnapshots(prepared, current, scope([...current.sections.Mortgage.rates]), { ...filters, interests: ['TD', 'Savings', 'Mortgage', 'Mortgage'] })).toBe(first);
  const corrected = pack([{ row: descriptor(), spans: [[0, 1, [9], 1]] }]);
  const changed = snapshot(corrected, filters, current, selected);
  expect(changed[day[0]].Mortgage!.Alpha.mean).toBe(9);
  expect(changed[day[1]].Mortgage!.Alpha).toBeUndefined();
  expect(first[day[0]].Mortgage!.Alpha.mean).toBe(5);
});

test('async snapshots coalesce historical work, match synchronous statistics and populate render-only cache', async () => {
  const catalogue = pack(), preparation = prepareHistoricalBankRateCatalogue(catalogue)!;
  const current = core([row()]), selected = scope(current.sections.Mortgage.rates);
  let release!: () => void;
  const pause = jest.fn(() => new Promise<void>(resolve => { release = resolve; }));
  expect(cachedHistoricalBankRateSnapshots(preparation, current, selected, filters)).toBeNull();
  const first = historicalBankRateSnapshotsAsync(preparation, current, selected, filters, pause);
  const second = historicalBankRateSnapshotsAsync(preparation, current, selected, { ...filters, interests: ['TD', 'Mortgage', 'Savings'] }, pause);
  expect(pause).toHaveBeenCalledTimes(1);
  expect(cachedHistoricalBankRateSnapshots(preparation, current, selected, filters)).toBeNull();
  release();
  const [left, right] = await Promise.all([first, second]);
  expect(right).toBe(left);
  expect(left).toEqual(snapshot(pack(), filters, current, selected));
  expect(cachedHistoricalBankRateSnapshots(preparation, current, selected, filters)).toBe(left);
  expect(await historicalBankRateSnapshotsAsync(preparation, current, selected, filters, pause)).toBe(left);
  expect(pause).toHaveBeenCalledTimes(1);
  const restricted = { ...filters, profileFilters: { ...EMPTY_PROFILE, accountFeatures: ['OFFSET'] } };
  expect(cachedHistoricalBankRateSnapshots(preparation, current, selected, restricted)).toBeNull();
});

test('async completion rechecks original current rows against a gate closed while yielding', async () => {
  const preparation = prepareHistoricalBankRateCatalogue(pack())!;
  const original = row(), current = core([original]), selected = scope([original, { ...original }]);
  let release!: () => void;
  const pending = historicalBankRateSnapshotsAsync(preparation, current, selected, filters,
    () => new Promise<void>(resolve => { release = resolve; }));
  installMandatoryEligibility(selectMandatoryEligibility(current, { ...EMPTY_PROFILE, rateTypes: ['FIXED'] }, null));
  release();
  const result = await pending;
  expect(result[day[0]].Mortgage!.Alpha.mean).toBe(5);
  expect(result[day[2]].Mortgage).toEqual({});
  expect(current.sections.Mortgage.rates[0]).toBe(original);
  expect(cachedHistoricalBankRateSnapshots(preparation, current, selected, filters)).toBe(result);
  installMandatoryEligibility(selectMandatoryEligibility(null, EMPTY_PROFILE, null));
  expect(cachedHistoricalBankRateSnapshots(preparation, current, selected, filters)).toBeNull();
});

test('cooperative tier and event aggregation retains the exact synchronous result across work slices', async () => {
  const catalogue = pack([]);
  catalogue.sections.Mortgage = Array.from({ length: 1000 }, (_, i) => ({
    row: descriptor({ product_id: String(i), product_key: `p${i}`, provider: `Bank ${i % 8}` }),
    spans: [[0, 1, [i % 10, i % 10 + 1], 0], [1, 2, [i % 12], 0]],
  }));
  const expected = snapshot(catalogue, { ...filters, includeNonStandard: true });
  const preparation = prepareHistoricalBankRateCatalogue(JSON.parse(JSON.stringify(catalogue)))!;
  const pause = jest.fn(async () => undefined);
  let time = 0;
  const now = jest.spyOn(Date, 'now').mockImplementation(() => time += 4);
  try {
    const actual = await historicalBankRateSnapshotsAsync(preparation, core(), scope(), { ...filters, includeNonStandard: true }, pause);
    expect(actual).toEqual(expected);
    expect(pause.mock.calls.length).toBeGreaterThan(10);
  } finally { now.mockRestore(); }
});

test('date-source gaps stay blank and cannot be bridged by an encoded span', () => {
  const catalogue = pack([{ row: descriptor(), spans: [[0, 1, [5], 1], [2, 1, [5], 1]] }]);
  delete catalogue.sources[day[1]];
  expect(snapshot(catalogue)[day[1]].Mortgage).toEqual({});
  catalogue.sections.Mortgage[0].spans = [[0, 3, [5], 1]];
  expect(validateHistoricalBankRateCatalogue(catalogue)).toBe(false);
});

test.each([
  ['wrong schema', (p: any) => { p.schema_version = 1; }],
  ['missing calendar date', (p: any) => { p.run_dates.splice(1, 1); }],
  ['invalid calendar date', (p: any) => { p.run_dates[0] = '2026-02-30'; }],
  ['invalid source SHA', (p: any) => { p.sources[day[0]] = { ...source, details_sha256: 'invalid' }; }],
  ['source outside axis', (p: any) => { p.sources['2026-09-19'] = source; }],
  ['unavailable observation', (p: any) => { p.unavailable_dates[day[0]] = 'unresolved'; }],
  ['wrong evidence product', (p: any) => { p.evidence[1].identity.product_id = 'other'; }],
  ['wrong evidence section', (p: any) => { p.evidence[1].identity.dataset = 'Savings'; }],
  ['unknown with donated detail', (p: any) => { p.evidence[0].detail = {}; }],
  ['empty known detail', (p: any) => { p.evidence[1].detail = {}; }],
  ['missing descriptor name', (p: any) => { delete p.sections.Mortgage[0].row.product_name; }],
  ['observation in descriptor', (p: any) => { p.sections.Mortgage[0].row.rate = '0.05'; }],
  ['duplicate descriptor', (p: any) => { p.sections.Mortgage.push(p.sections.Mortgage[0]); }],
  ['overlapping spans', (p: any) => { p.sections.Mortgage[0].spans.push([2, 1, [5], 1]); }],
  ['negative rate', (p: any) => { p.sections.Mortgage[0].spans[0][2] = [-1]; }],
  ['nonfinite rate', (p: any) => { p.sections.Mortgage[0].spans[0][2] = [Infinity]; }],
  ['overflowing finite rate', (p: any) => { p.sections.Mortgage[0].spans[0][2] = [Number.MAX_VALUE]; }],
  ['unsorted rates', (p: any) => { p.sections.Mortgage[0].spans[0][2] = [5, 4]; }],
  ['missing evidence ID', (p: any) => { p.sections.Mortgage[0].spans[0][3] = 99; }],
  ['invalid feature variant', (p: any) => { p.evidence[1].detail.facts = [fact(), { ...fact(), id: '' }]; }],
  ['oversized metadata field', (p: any) => { p.evidence[1].detail.description = 'x'.repeat(65_537); }],
  ['too many tiers', (p: any) => { p.sections.Mortgage = Array(HISTORICAL_CATALOGUE_LIMITS.tiers + 1).fill(p.sections.Mortgage[0]); }],
])('rejects malformed catalogue: %s', async (_label, mutate) => {
  const catalogue = pack(); mutate(catalogue);
  expect(validateHistoricalBankRateCatalogue(catalogue)).toBe(false);
  expect(await validateHistoricalBankRateCatalogueAsync(catalogue, async () => {})).toBe(false);
  expect(await prepareHistoricalBankRateCatalogueAsync(catalogue, async () => {})).toBeNull();
  expect(prepareHistoricalBankRateCatalogue(catalogue)).toBeNull();
});

test('cooperative preparation yields before work, coalesces callers and shares the synchronous cache', async () => {
  const catalogue = pack();
  let release!: () => void;
  const pause = jest.fn(() => new Promise<void>(resolve => { release = resolve; }));
  const first = prepareHistoricalBankRateCatalogueAsync(catalogue, pause);
  const second = prepareHistoricalBankRateCatalogueAsync(catalogue, pause);
  expect(pause).toHaveBeenCalledTimes(1);
  release();
  const [left, right] = await Promise.all([first, second]);
  expect(left).not.toBeNull();
  expect(right).toBe(left);
  expect(prepareHistoricalBankRateCatalogue(catalogue)).toBe(left);
  expect(historicalBankRateSnapshots(left!, core(), scope(), filters)[day[0]].Mortgage!.Alpha.mean).toBe(5);
});

test('rejects expanded observations exceeding budget without expanding them', () => {
  const catalogue = pack();
  catalogue.run_dates = Array.from({ length: 5000 }, (_, i) => new Date(Date.UTC(2010, 0, 1 + i)).toISOString().slice(0, 10));
  catalogue.sources = Object.fromEntries(catalogue.run_dates.map(d => [d, source]));
  catalogue.sections.Mortgage[0].spans = [[0, 5000, Array(2001).fill(5), 1]];
  expect(validateHistoricalBankRateCatalogue(catalogue)).toBe(false);
});

test('accepts bounded selected and legacy source receipts', () => {
  const catalogue = pack();
  catalogue.sources[day[0]] = { kind: 'selected_contract', generation_id: 'obs-day', contract_digest: hash, banks_sha256: hash, bytes: 128 * 1024 * 1024 };
  catalogue.sources[day[1]] = { kind: 'retained_legacy_export', banks_sha256: hash, bytes: 1 };
  expect(validateHistoricalBankRateCatalogue(catalogue)).toBe(true);
  catalogue.sources[day[0]] = { kind: 'retained_legacy_export', banks_sha256: hash, bytes: 128 * 1024 * 1024 + 1 };
  expect(validateHistoricalBankRateCatalogue(catalogue)).toBe(false);
});
