import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import {
  publicCatalogueOfferRowsCooperatively,
  publicCatalogueOfferRows,
  publicCataloguePricingKey,
  publicRecommendationRows,
  publicRecommendationRowsCooperatively,
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

test('cooperative recommendation assembly matches the synchronous contract', async () => {
  const products = Array.from({ length: 16 }, (_, index) => ({
    ...product,
    productId: `p-${index}`,
    productKey: `p-${index}`,
    programmeIds: [`prog-${index}`],
    section: 'Savings' as const,
  }));
  const base = programme().components[0];
  const programmes = products.map((value, index) => programme({
    productId: value.productId,
    programmeId: `prog-${index}`,
    offerId: `offer-${index}`,
    section: 'Savings',
    components: [{ ...base, scopeId: value.productId, componentId: `base-${index}`, value: `0.0${(index % 9) + 1}` }],
  }));
  const view = catalogue(programmes, products);
  const source = products.map((value, index) => ({
    ...row, product_key: value.productKey, rate: `0.0${(index % 9) + 1}`, comparison_rate: undefined,
  }));
  const sync = publicRecommendationRows(source, view, 'Savings', {});
  const yields: number[] = [];
  const cooperative = await publicRecommendationRowsCooperatively(source, view, 'Savings', {}, {
    yieldControl: async () => { yields.push(1); },
    now: () => yields.length * 10,
  });
  expect(cooperative?.map(item => [item.product_key, item.public_offer_id, item.rate]))
    .toEqual(sync.map(item => [item.product_key, item.public_offer_id, item.rate]));
  expect(yields.length).toBeGreaterThan(1);
  expect(publicCataloguePricingKey(view)).toContain(`:${view.products.length}`);
});

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


test('a single high-fanout product yields between programmes and cancels before the next one', async () => {
  const programmes = Array.from({ length: 1200 }, (_, i) => programme({
    section: 'Savings', programmeId: `programme-${i}`, offerId: `offer-${i}`,
    components: programme().components.map(component => ({ ...component, scopeId: `offer-${i}` })),
  }));
  const view = catalogue(programmes, [{ ...product, section: 'Savings' }]);
  let clock = 0;
  let yields = 0;
  const result = await publicCatalogueOfferRowsCooperatively(view, 'Savings', {}, {
    now: () => ++clock * 7,
    yieldControl: async () => { yields += 1; },
  }, () => AS_OF);
  expect(result).toHaveLength(1200);
  expect(result).toEqual(publicCatalogueOfferRows(view, 'Savings', {}, () => AS_OF));
  expect(yields).toBe(1201);
  yields = 0;
  const cancelled = await publicCatalogueOfferRowsCooperatively(view, 'Savings', {}, {
    now: () => ++clock * 7,
    yieldControl: async () => { yields += 1; },
    cancelled: () => yields > 1,
  }, () => AS_OF);
  expect(cancelled).toBeNull();
  expect(yields).toBe(2);
});

test('same-cardinality catalogue replacement has a distinct source identity, wrapper republish does not', () => {
  const view = catalogue();
  expect(publicCataloguePricingKey({ ...view })).toBe(publicCataloguePricingKey(view));
  expect(publicCataloguePricingKey(catalogue())).not.toBe(publicCataloguePricingKey(view));
});
