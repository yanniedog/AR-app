import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import { publicRecommendationRows, resolvedPublicRankingRows, resolvedPublicRankingRowsCooperatively, resolveRowPublicRate, rowWithPublicResolution } from '../src/data/publicRateIntegration';
import { mortgageComparisonRows, mortgageComparisonRowsCooperatively } from '../src/data/mortgageComparison';
import { sortRows } from '../src/data/selectors';
import { AS_OF, catalogue, product, programme, row } from '../testUtils/publicRateJourney';

beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(new Date(AS_OF));
  installMandatoryEligibility(selectMandatoryEligibility(null, null, null));
});
afterEach(() => jest.useRealTimers());

test('payable ordering uses the resolved sum and excludes unmet conditional offers', () => {
  const products = [product, { ...product, productId: 'other', productKey: 'other', programmeIds: ['other'] },
    { ...product, productId: 'unmet', productKey: 'unmet', programmeIds: ['unmet'] }];
  const base = programme().components[0];
  const programmes = [programme({ section: 'Savings', components: [
    { ...base, componentId: 'base', value: '0.01' }, { ...base, componentId: 'bonus', value: '0.04' }],
    formula: { op: 'add', operands: [{ op: 'component', componentId: 'base' }, { op: 'component', componentId: 'bonus' }] } }),
  programme({ productId: 'other', programmeId: 'other', offerId: 'other', section: 'Savings', components: [{ ...base, scopeId: 'other', value: '0.03' }] }),
  programme({ productId: 'unmet', programmeId: 'unmet', offerId: 'unmet', section: 'Savings',
    components: [{ ...base, scopeId: 'unmet' }], conditions: [{ conditionId: 'qualification', field: 'qualification', operator: 'eq', value: true, evidenceIds: ['unit-evidence'] }] })];
  const view = catalogue(programmes, products.map(value => ({ ...value, section: 'Savings' })));
  const source = products.map((value, i) => ({ ...row, product_key: value.productKey, rate: i ? '0.03' : '0.01', comparison_rate: undefined }));
  const candidates = publicRecommendationRows(source, view, 'Savings', { qualification: false });
  const ranked = resolvedPublicRankingRows(candidates, view, () => ({ qualification: false }));
  expect(sortRows(ranked.rows, 'rate', 'Savings', 'max').map(value => [value.product_key, value.rate]))
    .toEqual([[product.productKey, '0.05'], ['other', '0.03']]);
  expect(ranked.unresolved).toBe(1);
  expect(source[0].rate).toBe('0.01');
});

test('comparison fields follow the resolved programme and clear stale source values', () => {
  const base = programme().components[0];
  const withComparison = catalogue([programme({ components: [base, { ...base, componentId: 'comparison', role: 'comparison', value: '0.071' }] })]);
  const result = rowWithPublicResolution(row, resolveRowPublicRate(row, withComparison, {}, AS_OF));
  expect(result).toMatchObject({ rate: '0.06', comparison_rate: '0.071' });
  const noComparison = rowWithPublicResolution(row, resolveRowPublicRate(row, catalogue(), {}, AS_OF));
  expect(noComparison.comparison_rate).toBeUndefined();
  const loading = rowWithPublicResolution(row, resolveRowPublicRate(row, { ...catalogue(), status: 'loading' }, {}, AS_OF));
  expect(loading.rate).toBe(''); expect(loading.comparison_rate).toBeUndefined();
  expect(row.comparison_rate).toBe('0.09');
});

test('cooperative public ranking matches the sync contract and yields between slices', async () => {
  const products = [product, { ...product, productId: 'other', productKey: 'other', programmeIds: ['other'] }];
  const base = programme().components[0];
  const programmes = [
    programme({ section: 'Savings', components: [
      { ...base, componentId: 'base', value: '0.01' }, { ...base, componentId: 'bonus', value: '0.04' }],
      formula: { op: 'add', operands: [{ op: 'component', componentId: 'base' }, { op: 'component', componentId: 'bonus' }] } }),
    programme({ productId: 'other', programmeId: 'other', offerId: 'other', section: 'Savings',
      components: [{ ...base, scopeId: 'other', value: '0.03' }] }),
  ];
  const view = catalogue(programmes, products.map(value => ({ ...value, section: 'Savings' })));
  const source = products.map((value, i) => ({ ...row, product_key: value.productKey, rate: i ? '0.03' : '0.01', comparison_rate: undefined }));
  const candidates = publicRecommendationRows(source, view, 'Savings', { qualification: false });
  const sync = resolvedPublicRankingRows(candidates, view, () => ({ qualification: false }));
  let yields = 0;
  const cooperative = await resolvedPublicRankingRowsCooperatively(
    candidates, view, () => ({ qualification: false }),
    { yieldControl: async () => { yields += 1; }, now: (() => { let t = 0; return () => (t += 10); })() },
  );
  expect(cooperative).toEqual(sync);
  expect(yields).toBeGreaterThan(0);
});

test('cooperative mortgage scope matching matches the sync contract', async () => {
  const rows = [
    { ...row, product_key: 'in-range', lvr_tier: '70-80', balance_min: '100000', balance_max: '800000' },
    { ...row, product_key: 'outside', lvr_tier: '60-70', balance_min: '100000', balance_max: '400000' },
  ];
  const inputs = { loanAmount: '500000', lvr: '75' };
  const sync = mortgageComparisonRows(rows, inputs);
  const cooperative = await mortgageComparisonRowsCooperatively(rows, inputs, undefined, {
    yieldControl: async () => undefined,
    now: (() => { let t = 0; return () => (t += 10); })(),
  });
  expect(cooperative?.rows.map(item => item.product_key)).toEqual(sync.rows.map(item => item.product_key));
  expect(cooperative?.invalid).toBe(sync.invalid);
});
