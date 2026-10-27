import { AS_OF, catalogue, core, product, programme, row } from '../testUtils/publicRateJourney';
import { publicRecommendationRows, publicRecommendationRowsForProduct } from '../src/data/publicRateIntegration';
import { makeLegacySavedRateRef, makeSavedRateRef, resolveSavedRates } from '../src/data/savedRates';
import type { RateRow } from '../src/types';

beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date(AS_OF)); });
afterEach(() => jest.useRealTimers());
function largeBook(count = 1000) {
  const products = Array.from({ length: count }, (_, index) => ({ ...product, productId: `product-${index}`, productKey: `key-${index}`, programmeIds: [`programme-${index}`] }));
  const programmes = products.map((p, index) => programme({ productId: p.productId, programmeId: p.programmeIds[0], offerId: `offer-${index}`,
    components: programme().components.map(c => ({ ...c, scopeId: `offer-${index}` })), sourceBindings: [{ rateIndex: index, pointer: `/rates/${index}` }] }));
  const productsByKey = new Map(products.map(p => [p.productKey, p]));
  const programmesById = new Map(products.map((p, index) => [p.productId, [programmes[index]]]));
  const view = { ...catalogue(programmes, products), getProduct: (key: string) => productsByKey.get(key), getProgrammes: jest.fn((id: string) => programmesById.get(id) ?? []) };
  const rows = products.map((p, index) => ({ ...row, product_key: p.productKey, rate_index: index }));
  return { view, rows, products };
}
test.each([false, true])('one product retains full candidate semantics without unrelated expansion, legacy=%s', legacy => {
  const { view, rows, products } = largeBook();
  if (legacy) products[4].status = 'legacy';
  const expected = publicRecommendationRows(rows, view, 'Mortgage', {}, legacy, () => AS_OF).filter(r => r.product_key === 'key-4');
  const baselineBooks = new Set(view.getProgrammes.mock.calls.map(([id]) => id));
  expect(baselineBooks.size).toBe(1000);
  view.getProgrammes.mockClear();
  expect(publicRecommendationRowsForProduct(rows, view, 'Mortgage', {}, 'key-4', legacy, () => AS_OF)).toEqual(expected);
  expect([...new Set(view.getProgrammes.mock.calls.map(([id]) => id))]).toEqual(['product-4']);
});
test('core-only and unavailable products retain exact source rows without unrelated lookups', () => {
  const { view, rows } = largeBook(10);
  const source: RateRow = { ...row, product_key: 'unpublished', rate_index: 100 };
  const input = [...rows, source];
  expect(publicRecommendationRowsForProduct(input, view, 'Mortgage', {}, source.product_key)).toEqual([source]);
  expect(publicRecommendationRowsForProduct(input, { ...view, status: 'unavailable' }, 'Mortgage', {}, 'key-2')).toEqual([rows[2]]);
});
test('empty Saved does no catalogue or scenario work; exact/product refs inspect only saved products', () => {
  const { view, rows } = largeBook(); const payload = core(rows), scenario = jest.fn(() => ({}));
  expect(resolveSavedRates(payload, [], view, scenario)).toEqual([]);
  expect(view.getProgrammes).not.toHaveBeenCalled(); expect(scenario).not.toHaveBeenCalled();
  const exact = publicRecommendationRowsForProduct(rows, view, 'Mortgage', {}, 'key-4', true)[0];
  const ref = makeSavedRateRef(exact), productRef = makeLegacySavedRateRef('key-7');
  view.getProgrammes.mockClear();
  const result = resolveSavedRates(payload, [ref, productRef, { ...ref, id: 'missing-offer', offerId: 'absent' }], view, scenario);
  expect(result.map(item => item.ref.id)).toEqual([ref.id, productRef.id]);
  expect(result.map(item => item.row.product_key)).toEqual(['key-4', 'key-7']);
  expect(new Set(view.getProgrammes.mock.calls.map(([id]) => id))).toEqual(new Set(['product-4', 'product-7']));
});
