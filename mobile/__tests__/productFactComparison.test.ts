import { comparableProductFacts } from '../src/data/productFactComparison';
import retained from './fixtures/product-criteria-retained-20260519.json';
import type { ProductDetail } from '../src/types';

test('retained comparable fields align by canonical identity while every occurrence survives', () => {
  const products = Object.entries(retained.products).map(([key, detail]) => ({ key, detail: detail as ProductDetail }));
  const groups = comparableProductFacts(products);
  const count = groups.reduce((sum, group) => sum + Object.values(group.cells).reduce((n, facts) => n + facts.length, 0), 0);
  expect(count).toBe(products.reduce((sum, product) => sum + product.detail.facts!.length, 0));
  expect(groups.some(group => group.representative.kind === 'fee')).toBe(true);
  expect(groups.some(group => group.representative.kind === 'eligibility')).toBe(true);
});
test('identically priced monthly and annual fees are different comparison rows', () => {
  const base = { id: 'control', kind: 'fee' as const, canonicalKey: 'fee.periodic', value: '5', unit: 'AUD' };
  const groups = comparableProductFacts([{ key: 'monthly', detail: { facts: [{ ...base, cadence: 'P1M' }] } },
    { key: 'annual', detail: { facts: [{ ...base, cadence: 'P1Y' }] } }]);
  expect(groups).toHaveLength(2);
  expect(groups.every(group => Object.keys(group.cells).length === 1)).toBe(true);
});
