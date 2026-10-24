import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import {
  publicRecommendationRows,
  resolvedPublicRankingRows,
  resolvedPublicRankingRowsCooperatively,
} from '../src/data/publicRateIntegration';
import { mortgageComparisonRows, mortgageComparisonRowsCooperatively } from '../src/data/mortgageComparison';
import { AS_OF, catalogue, product, programme, row } from '../testUtils/publicRateJourney';

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(AS_OF));
  installMandatoryEligibility(selectMandatoryEligibility(null, null, null));
});
afterEach(() => jest.useRealTimers());

test('cooperative public ranking matches the synchronous contract', async () => {
  const products = [product, { ...product, productId: 'other', productKey: 'other', programmeIds: ['other'] }];
  const base = programme().components[0];
  const programmes = [
    programme({ section: 'Savings', components: [{ ...base, componentId: 'base', value: '0.01' }] }),
    programme({
      productId: 'other', programmeId: 'other', offerId: 'other', section: 'Savings',
      components: [{ ...base, scopeId: 'other', value: '0.03' }],
    }),
  ];
  const view = catalogue(programmes, products.map(value => ({ ...value, section: 'Savings' })));
  const source = products.map((value, i) => ({
    ...row, product_key: value.productKey, rate: i ? '0.03' : '0.01', comparison_rate: undefined,
  }));
  const candidates = publicRecommendationRows(source, view, 'Savings', {});
  const sync = resolvedPublicRankingRows(candidates, view, () => ({}));
  const yields: number[] = [];
  const cooperative = await resolvedPublicRankingRowsCooperatively(candidates, view, () => ({}), {
    yieldControl: async () => { yields.push(1); },
    now: () => yields.length * 10,
  });
  expect(cooperative).toEqual(sync);
  expect(yields.length).toBeGreaterThan(0);
});

test('cooperative mortgage scope matches the synchronous contract and yields under load', async () => {
  const rows = Array.from({ length: 40 }, (_, index) => ({
    ...row,
    product_key: `p-${index}`,
    rate_index: index,
    lvr_tier: 'lvr_<=80%',
    balance_min: '100000',
    balance_max: '800000',
  }));
  const value = { loanAmount: '500000', lvr: '75' };
  const sync = mortgageComparisonRows(rows, value);
  const yields: number[] = [];
  const cooperative = await mortgageComparisonRowsCooperatively(rows, value, undefined, {
    yieldControl: async () => { yields.push(1); },
    now: () => yields.length * 10,
  });
  expect(cooperative?.rows.map(item => item.product_key)).toEqual(sync.rows.map(item => item.product_key));
  expect(cooperative?.unverified).toBe(sync.unverified);
  expect(cooperative?.invalid).toBe(sync.invalid);
  expect(yields.length).toBeGreaterThan(0);
});
