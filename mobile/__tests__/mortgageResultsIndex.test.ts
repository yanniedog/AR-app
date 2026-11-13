import * as resolver from '../src/data/publicRateResolver';
import * as selectors from '../src/data/selectors';
import { prepareMortgageResultsIndex } from '../src/data/mortgageResultsIndex';
import { publicRecommendationRows, resolvedPublicRankingRows } from '../src/data/publicRateIntegration';
import { mortgageComparisonRows } from '../src/data/mortgageComparison';
import { AS_OF, catalogue, core, programme, row } from '../testUtils/publicRateJourney';
import { condition } from '../testUtils/publicRates';
import { EMPTY_FILTERS, filterRows, sortRows } from '../src/data/selectors';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';

beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date(AS_OF)); installMandatoryEligibility(selectMandatoryEligibility(null, null, null)); });
afterEach(() => jest.useRealTimers());
const context = { core: core(), details: null, manifest: null, coreIntegrity: null };
async function prepare(source = programme()) {
  const view = catalogue([source]);
  const pending = prepareMortgageResultsIndex({ source: [row], catalogue: view, context, includeNonStandard: false, cancelled: () => false });
  await jest.runAllTimersAsync();
  return { index: await pending, view };
}
test('prepared membership, source scope, prices and order equal the canonical pipeline at exact input boundaries', async () => {
  const { index, view } = await prepare(programme({ conditions: [
    condition('purpose', { operator: 'eq', value: 'OWNER_OCCUPIED' }),
    condition('repayment', { operator: 'eq', value: 'PRINCIPAL_AND_INTEREST' }),
    condition('amount', { operator: 'bounds', minimum: '100000', maximum: '1000000' }),
    condition('lvr', { operator: 'bounds', maximum: '0.8' }),
  ] }));
  expect(index).not.toBeNull();
  for (const amount of ['99999', '100000', '650000', '1000000', '1000001']) for (const lvr of ['0.6', '0.72', '0.8', '0.81']) {
    const scenario = { amount, lvr, purpose: 'OWNER_OCCUPIED', repayment: 'PRINCIPAL_AND_INTEREST' };
    const inputs = { loanAmount: amount, lvr: String(Number(lvr) * 100) };
    const expected = resolvedPublicRankingRows(publicRecommendationRows([row], view, 'Mortgage', scenario), view, () => scenario);
    const scoped = mortgageComparisonRows(expected.rows, inputs, context);
    const actual = index!.select(scenario, inputs)!;
    expect(actual.priced).toEqual(expected.rows);
    expect(actual.scope.rows).toEqual(scoped.rows);
    expect(actual.scope.unverified).toEqual(scoped.unverified);
    for (const sort of ['rate', 'comparison', 'bank'] as const) for (const metric of ['headline', 'comparison'] as const) {
      const filtered = filterRows(scoped.rows, EMPTY_FILTERS, undefined, null, 'Mortgage');
      expect(actual.filtered(EMPTY_FILTERS, sort, metric)).toEqual(sortRows(filtered, sort, 'Mortgage', 'max', metric));
    }
  }
});
test('unsupported dependent formulas and cancellation retain canonical fallback', async () => {
  expect((await prepare(programme({ formula: { op: 'tiered', field: 'amount', method: 'per_tier', tiers: [] } }))).index).toBeNull();
  const pending = prepareMortgageResultsIndex({ source: [row], catalogue: catalogue(), context, includeNonStandard: false, cancelled: () => true });
  await jest.runAllTimersAsync(); expect(await pending).toBeNull();
});
test('clock rollback, expiry and gate replacement reject an otherwise prepared quote', async () => {
  const { index } = await prepare(); expect(index).not.toBeNull();
  const scenario = { amount: '650000', lvr: '0.72', purpose: 'OWNER_OCCUPIED', repayment: 'PRINCIPAL_AND_INTEREST' };
  const inputs = { loanAmount: '650000', lvr: '72' };
  expect(index!.select(scenario, inputs)).not.toBeNull();
  jest.setSystemTime(new Date(Date.parse(AS_OF) - 1)); expect(index!.select(scenario, inputs)).toBeNull();
  jest.setSystemTime(new Date(index!.until)); expect(index!.select(scenario, inputs)).toBeNull();
});

test('conditional generated alternatives preserve first applicable offer and source-first core deduplication', async () => {
  const common = [condition('purpose', { operator: 'eq', value: 'OWNER_OCCUPIED' }), condition('repayment', { operator: 'eq', value: 'PRINCIPAL_AND_INTEREST' })];
  const first = programme({ programmeId: 'low', conditions: [...common, condition('lvr', { operator: 'bounds', maximum: '0.6' })] });
  const second = programme({ programmeId: 'high', conditions: [...common, condition('lvr', { operator: 'bounds', maximum: '0.8' })], components: [{ ...first.components[0], value: '0.07' }] });
  const view = catalogue([first, second]);
  const pending = prepareMortgageResultsIndex({ source: [], catalogue: view, context, includeNonStandard: false, cancelled: () => false });
  await jest.runAllTimersAsync(); const index = await pending; expect(index).not.toBeNull();
  for (const lvr of ['0.5', '0.6', '0.72', '0.8', '0.81']) {
    const scenario = { amount: '650000', lvr, purpose: 'OWNER_OCCUPIED', repayment: 'PRINCIPAL_AND_INTEREST' };
    const expected = resolvedPublicRankingRows(publicRecommendationRows([], view, 'Mortgage', scenario), view, () => scenario);
    expect(index!.select(scenario, { loanAmount: '650000', lvr: String(Number(lvr) * 100) })!.priced).toEqual(expected.rows);
  }
});
test('published replacement rebuilds the quote; eligibility changes invalidate both selection and retained filters', async () => {
  const { index } = await prepare();
  const scenario = { amount: '650000', lvr: '0.72', purpose: 'OWNER_OCCUPIED', repayment: 'PRINCIPAL_AND_INTEREST' }, inputs = { loanAmount: '650000', lvr: '72' };
  const selected = index!.select(scenario, inputs)!;
  installMandatoryEligibility({ active: true, loading: true, rows: new WeakSet(), productKeys: new Set() });
  expect(index!.select(scenario, inputs)).toBeNull(); expect(selected.filtered(EMPTY_FILTERS, 'rate', 'headline')).toBeNull();
  const replacement = await prepare(programme({ components: [{ ...programme().components[0], value: '0.03' }] }));
  expect(replacement.index!.select(scenario, inputs)!.priced[0].rate).toBe('0.03');
  expect(replacement.index!.select(scenario, inputs)!.filtered(EMPTY_FILTERS, 'rate', 'headline')).toEqual([]);
});
test('ambiguous generated semantic bindings never bypass the canonical unique-owner guard', async () => {
  const conditions = [condition('purpose', { operator: 'eq', value: 'OWNER_OCCUPIED' }), condition('repayment', { operator: 'eq', value: 'PRINCIPAL_AND_INTEREST' })];
  const first = programme({ conditions }), duplicate = programme({ conditions, components: [{ ...first.components[0], value: '0.07' }] });
  const pending = prepareMortgageResultsIndex({ source: [], catalogue: catalogue([first, duplicate]), context, includeNonStandard: false, cancelled: () => false });
  await jest.runAllTimersAsync(); expect(await pending).toBeNull();
});


test.each(['component', 'phase', 'unknown-field'])('scenario-dependent %s books retain full canonical fallback', async kind => {
  const source = programme();
  if (kind === 'component') source.components[0].conditions = [condition('amount', { operator: 'bounds', minimum: '100000' })];
  if (kind === 'phase') source.phases = [{ phaseId: 'later', startMonth: 12, formula: source.formula!, conditions: [condition('package')], evidenceIds: [] }];
  if (kind === 'unknown-field') source.conditions = [condition('package')];
  expect((await prepare(source)).index).toBeNull();
});

test('an explicitly bound core variant is never replaced by another same-offer programme when its conditions are unmet', async () => {
  const common = [condition('purpose', { operator: 'eq', value: 'OWNER_OCCUPIED' }), condition('repayment', { operator: 'eq', value: 'PRINCIPAL_AND_INTEREST' })];
  const low = programme({ programmeId: 'low', conditions: [...common, condition('lvr', { operator: 'bounds', maximum: '0.6' })] });
  const high = programme({ programmeId: 'high', conditions: [...common, condition('lvr', { operator: 'bounds', maximum: '0.8' })] });
  const source = [{ ...row, public_programme_id: 'low', public_offer_id: low.offerId }], view = catalogue([low, high]);
  const pending = prepareMortgageResultsIndex({ source, catalogue: view, context, includeNonStandard: false, cancelled: () => false });
  await jest.runAllTimersAsync(); const index = await pending; expect(index).not.toBeNull();
  for (const purpose of ['OWNER_OCCUPIED', 'INVESTMENT']) for (const repayment of ['PRINCIPAL_AND_INTEREST', 'INTEREST_ONLY']) {
    const scenario = { amount: '650000', lvr: '0.72', purpose, repayment };
    const expected = resolvedPublicRankingRows(publicRecommendationRows(source, view, 'Mortgage', scenario), view, () => scenario);
    expect(index!.select(scenario, { loanAmount: '650000', lvr: '72' })!.priced).toEqual(expected.rows);
    expect(expected.rows).toEqual([]);
  }
});


test('filter selection on a prepared book neither reprices programmes nor sorts the catalogue again', async () => {
  const pricing = jest.spyOn(resolver, 'resolvePublicRate'), sorting = jest.spyOn(selectors, 'sortRowsCooperatively');
  try {
    const { index } = await prepare(); expect(index).not.toBeNull(); expect(pricing).toHaveBeenCalled(); expect(sorting).toHaveBeenCalled();
    pricing.mockClear(); sorting.mockClear();
    for (const amount of ['650000', '650001', '1000000', '650000']) {
      const selected = index!.select({ amount, lvr: '0.72', purpose: 'OWNER_OCCUPIED', repayment: 'PRINCIPAL_AND_INTEREST' }, { loanAmount: amount, lvr: '72' });
      expect(selected!.filtered(EMPTY_FILTERS, 'rate', 'headline')).toHaveLength(1);
    }
    expect(pricing).not.toHaveBeenCalled(); expect(sorting).not.toHaveBeenCalled();
  } finally { pricing.mockRestore(); sorting.mockRestore(); }
});
