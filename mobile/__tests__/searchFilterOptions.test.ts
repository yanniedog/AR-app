import coreSample from '../assets/sample/core.json';
import detailsSample from '../assets/sample/details.json';
import { prepareSearchFilterOptions, searchFilterGroupsFor } from '../src/data/searchFilterOptions';
import { distinctEligibilityCriteria } from '../src/data/eligibility';
import { distinctAccountFeatures } from '../src/data/features';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { compareLvrTiers } from '../src/data/lvrTier';
import { publishedFactFilterOptions } from '../src/data/productFacts';
import { distinctProviders, distinctValues } from '../src/data/selectors';
import type { CorePayload, DetailsPayload, ProductDetail, RateRow, SectionKey } from '../src/types';

const core = coreSample as unknown as CorePayload;
const details = detailsSample as unknown as DetailsPayload;
const yieldControl = jest.fn(async () => {});
const inactive = { active: false, loading: false, rows: new WeakSet<RateRow>(), productKeys: new Set<string>() };
beforeEach(() => { yieldControl.mockClear(); installMandatoryEligibility(inactive); });
afterEach(() => { installMandatoryEligibility(inactive); });

test.each<SectionKey>(['Mortgage', 'Savings', 'TD'])('chunked %s facets equal the complete historical catalogue model', async section => {
  const rows = core.sections[section].rates;
  const expectedGroups = searchFilterGroupsFor(section).map(g => {
    const options = distinctValues(rows, g.field);
    if (g.field === 'lvr_tier') options.sort(compareLvrTiers);
    return { g, options };
  }).filter(({ options }) => options.length > 0);
  let clock = 0;
  const result = await prepareSearchFilterOptions(rows, details.products, section, {
    yieldControl, now: () => (clock += 9),
  });
  expect(result).toEqual({
    groups: expectedGroups,
    providers: distinctProviders(rows),
    accountFeatures: distinctAccountFeatures(rows, details.products, section),
    eligibilityCriteria: distinctEligibilityCriteria(rows, details.products),
    publishedDetails: publishedFactFilterOptions(rows, details.products, section),
  });
  expect(yieldControl.mock.calls.length).toBe(Math.ceil(rows.length / 16));
});

test('same-product tier scopes remain distinct across CPU slices', async () => {
  const base = core.sections.Mortgage.rates[0];
  const rows = Array.from({ length: 48 }, (_, index) => ({ ...base, rate_index: index + 1,
    rate_type: index >= 32 ? 'FIXED' : 'VARIABLE' }));
  const lookup: Record<string, ProductDetail> = { [base.product_key]: { facts: [
    { id: 'negative', kind: 'feature', canonicalKey: 'OFFSET', value: false, unit: 'boolean', appliesTo: ['VARIABLE'] },
    { id: 'positive', kind: 'feature', canonicalKey: 'OFFSET', value: true, unit: 'boolean', appliesTo: ['FIXED'] },
    { id: 'redraw', kind: 'feature', canonicalKey: 'REDRAW', value: true, unit: 'boolean' },
    { id: 'age', kind: 'eligibility', canonicalKey: 'MIN_AGE', value: 18, unit: 'year' },
  ] } };
  let clock = 0;
  const result = await prepareSearchFilterOptions(rows, lookup, 'Mortgage', {
    yieldControl, now: () => (clock += 9),
  });
  expect(result?.accountFeatures).toEqual(distinctAccountFeatures(rows, lookup, 'Mortgage'));
  expect(result?.accountFeatures).toContain('OFFSET');
  expect(result?.publishedDetails).toEqual(publishedFactFilterOptions(rows, lookup, 'Mortgage'));
  expect(yieldControl).toHaveBeenCalledTimes(3);
});

test('mandatory profile gates exclude unapproved facet rows', async () => {
  const rows = core.sections.Mortgage.rates;
  const allowed = rows.slice(0, 7);
  installMandatoryEligibility({ active: true, loading: false, rows: new WeakSet(allowed),
    productKeys: new Set(allowed.map(row => row.product_key)) });
  const result = await prepareSearchFilterOptions(rows, details.products, 'Mortgage', { yieldControl });
  expect(result?.providers).toEqual(distinctProviders(allowed));
  expect(result?.accountFeatures).toEqual(distinctAccountFeatures(allowed, details.products, 'Mortgage'));
});

test('an in-flight model is cancelled when the mandatory gate changes between slices', async () => {
  const rows = core.sections.Mortgage.rates;
  let clock = 0;
  let calls = 0;
  const result = await prepareSearchFilterOptions(rows, details.products, 'Mortgage', {
    now: () => (clock += 9),
    yieldControl: async () => {
      calls += 1;
      if (calls === 2) installMandatoryEligibility({ active: true, loading: false,
        rows: new WeakSet(), productKeys: new Set() });
    },
  });
  expect(calls).toBe(2);
  expect(result).toBeNull();
});

test('cancelled preparations never publish a partial facet catalogue', async () => {
  let cancelled = false;
  const result = await prepareSearchFilterOptions(core.sections.TD.rates, details.products, 'TD', {
    cancelled: () => cancelled,
    yieldControl: async () => { cancelled = true; },
  });
  expect(result).toBeNull();
});
