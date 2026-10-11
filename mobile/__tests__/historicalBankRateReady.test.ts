import { gunzipSync } from 'node:zlib';
import snapshot from '../src/data/historicalBankRateCatalogue.snapshot.json';
import compiler from '../contracts/history-ready/compiler-manifest.json';
import { unpackHistoricalBankRateCatalogue } from '../src/data/historicalBankRateCataloguePacked';
import { compileHistoricalBankRateReady } from '../src/data/historicalBankRateReadyCompiler';
import { validateHistoricalBankRateReady, type HistoricalBankRateReady } from '../src/data/historicalBankRateReadyWire';
import { historicalBankRateSnapshots, prepareHistoricalBankRateCatalogue, prepareHistoricalBankRateReady, prepareHistoricalBankRateReadySources, preparedReadySources, type HistoricalCatalogueFilters } from '../src/data/historicalBankRateCatalogue';
import { EMPTY_PROFILE, PROFILE_FEATURE_OPTIONS, type ProfileFilters } from '../src/data/profile';
import { bankRateScope } from '../src/data/bankRateOverview';
import { productRatesFromHistoricalCatalogue } from '../src/data/productHistoryCatalogue';
import type { HistoricalBankRateCatalogue } from '../src/data/historicalBankRateCatalogueWire';
import { SECTION_KEYS, type CorePayload } from '../src/types';

let raw: HistoricalBankRateCatalogue, ready: HistoricalBankRateReady;
beforeAll(() => {
  raw = unpackHistoricalBankRateCatalogue(JSON.parse(gunzipSync(Buffer.from(snapshot.gzip_base64, 'base64')).toString())) as HistoricalBankRateCatalogue;
  ready = compileHistoricalBankRateReady(raw, compiler.sha256);
}, 30_000);
const settings = (profileFilters: ProfileFilters = EMPTY_PROFILE, includeNonStandard = false): HistoricalCatalogueFilters => ({ profileFilters, includeNonStandard, interests: SECTION_KEYS });
function observations(catalogue: ReturnType<typeof prepareHistoricalBankRateCatalogue>, filters: HistoricalCatalogueFilters) {
  const date = new Date(Date.parse(raw.run_dates.at(-1)!) + 86_400_000).toISOString().slice(0, 10);
  const core = { run_date: date, sections: { Mortgage: { rates: [] }, Savings: { rates: [] }, TD: { rates: [] } } } as unknown as CorePayload;
  return historicalBankRateSnapshots(catalogue!, core, bankRateScope({ Mortgage: [], Savings: [], TD: [] }), filters);
}

test('real catalogue compiles below the decoded budget with exact default and full-catalogue summaries', () => {
  expect(Buffer.byteLength(JSON.stringify(ready))).toBeLessThan(4 * 1024 * 1024);
  for (const include of [false, true]) expect(observations(prepareHistoricalBankRateReady(ready), settings(EMPTY_PROFILE, include)))
    .toEqual(observations(prepareHistoricalBankRateCatalogue(raw), settings(EMPTY_PROFILE, include)));
});

test('every curated feature and observed structural dimension retain exact raw profile semantics', () => {
  const profiles: ProfileFilters[] = [...new Set(SECTION_KEYS.flatMap(section => PROFILE_FEATURE_OPTIONS[section]))]
    .map(feature => ({ ...EMPTY_PROFILE, accountFeatures: [feature] }));
  const dimensions: [keyof ProfileFilters, string[]][] = [
    ['loanPurposes', raw.sections.Mortgage.map(tier => tier.row.loan_purpose ?? tier.row.security_purpose ?? '')],
    ['rateTypes', raw.sections.Mortgage.map(tier => tier.row.rate_type ?? '')],
    ['repaymentTypes', raw.sections.Mortgage.map(tier => tier.row.ribbon_repayment_type ?? tier.row.repayment_type ?? '')],
    ['lvrTiers', raw.sections.Mortgage.map(tier => tier.row.lvr_tier ?? '')],
    ['depositKinds', raw.sections.Savings.map(tier => tier.row.ribbon_deposit_kind ?? '')],
    ['interestPayments', raw.sections.TD.map(tier => tier.row.interest_payment ?? '')],
  ];
  for (const [key, values] of dimensions) for (const value of new Set(values)) if (value) profiles.push({ ...EMPTY_PROFILE, [key]: [value] });
  for (const profile of profiles) for (const include of [false, true]) {
    const filter = settings(profile, include);
    expect(observations(prepareHistoricalBankRateReady(ready), filter)).toEqual(observations(prepareHistoricalBankRateCatalogue(raw), filter));
  }
}, 120_000);

test('ready sources assign dates without replaying a masked cohort twice; caches preserve identity', () => {
  const dates = Object.keys(ready.sources).filter(day => !ready.unavailable_dates[day]);
  const midpoint = Math.floor(dates.length / 2);
  const combined = prepareHistoricalBankRateReadySources([{ ready, acceptedDates: dates.slice(0, midpoint) }, { ready, acceptedDates: dates.slice(midpoint) }])!;
  expect(observations(combined, settings())).toEqual(observations(prepareHistoricalBankRateReady(ready), settings()));
  expect(preparedReadySources(combined)).toHaveLength(2);
  expect(prepareHistoricalBankRateReady(ready)).toBe(prepareHistoricalBankRateReady(ready));
  expect(prepareHistoricalBankRateReadySources([{ ready, acceptedDates: [dates[0]] }, { ready, acceptedDates: [dates[0]] }])).toBeNull();
  expect(prepareHistoricalBankRateReadySources([{ ready, acceptedDates: ['1900-01-01'] }])).toBeNull();
});

test('product best rates equal the rich catalogue on every public source date', async () => {
  const dates = Object.entries(raw.sources).filter(([, source]) => source.kind === 'published_core').map(([day]) => day);
  const index = { dates, revision_heads: Object.fromEntries(dates.map(day => [day, { manifest_sha256: (raw.sources[day] as { manifest_sha256: string }).manifest_sha256 }])) } as Parameters<typeof productRatesFromHistoricalCatalogue>[1];
  const rich = await productRatesFromHistoricalCatalogue(prepareHistoricalBankRateCatalogue(raw)!, index, dates, () => true, async () => {});
  const fast = await productRatesFromHistoricalCatalogue(prepareHistoricalBankRateReady(ready)!, index, dates, () => true, async () => {});
  expect(fast).toEqual(rich);
});

test.each(['pin', 'revision', 'negative', 'unterminated', 'duplicate', 'missing-source', 'feature', 'product-range'])(
  'bounded validator rejects malformed %s before adoption', defect => {
    const value = JSON.parse(JSON.stringify(ready)) as HistoricalBankRateReady;
    const cohort = value.sections.Mortgage[0];
    if (defect === 'pin') value.compiler_sha256 = 'f'.repeat(64);
    if (defect === 'revision') (value as { semantic_revision: string }).semantic_revision = 'future';
    if (defect === 'negative') cohort[5][0][1][0][1] = -1;
    if (defect === 'unterminated') cohort[5].pop();
    if (defect === 'duplicate') value.sections.Mortgage.push(cohort);
    if (defect === 'missing-source') delete value.sources[value.run_dates[cohort[5][0][0]]];
    if (defect === 'feature') cohort[4] = 2 ** PROFILE_FEATURE_OPTIONS.Mortgage.length;
    if (defect === 'product-range') value.products.Mortgage[0][1][0][1] = 5001;
    expect(validateHistoricalBankRateReady(value, compiler.sha256)).toBe(false);
  });
