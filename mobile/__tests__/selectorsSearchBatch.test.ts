import {
  prepareRowSearchQuery,
  productKeysMatchingIndex,
  resetDetailSearchIndexCache,
  rowMatchesSearchQuery,
  type SearchIndexPayload,
} from '../src/data/detailSearch';
import { EMPTY_FILTERS, filterRows, filterRowsCooperatively } from '../src/data/selectors';
import type { RateRow } from '../src/types';
import * as suitabilityGate from '../src/data/suitabilityGate';

const rows: RateRow[] = Array.from({ length: 1000 }, (_, i) => ({
  provider: i % 2 ? 'Bank A' : 'Bank B',
  product_name: i % 3 ? 'Home loan' : 'Solar loan',
  product_key: `batch-search-${i % 200}`,
  rate: '0.05',
}));
const index: SearchIndexPayload = {
  schema_version: 1,
  run_date: '2026-10-12',
  products: Object.fromEntries(Array.from({ length: 200 }, (_, i) => [
    `batch-search-${i}`, i < 100 ? 'solar home offset' : 'fixed home loan',
  ])),
};
const filters = { ...EMPTY_FILTERS, includeNonStandard: true };

afterEach(() => {
  jest.restoreAllMocks();
  resetDetailSearchIndexCache();
});

test('cooperative filter counts preserve exact membership and yield before scanning', async () => {
  let ticks = 0;
  const accessed = new Set<number>();
  const observedRows = new Proxy(rows, { get(target, key, receiver) {
    if (typeof key === 'string' && /^\d+$/.test(key)) accessed.add(Number(key));
    return Reflect.get(target, key, receiver);
  } });
  const atYield: number[] = [];
  const yieldControl = jest.fn(async () => { atYield.push(accessed.size); });
  const selected = { ...filters, query: 'solar', providers: ['Bank A'] };
  const result = await filterRowsCooperatively(observedRows, selected, null, index, 'Mortgage', {
    yieldControl, now: () => ++ticks * 7,
  });
  expect(result).toEqual(filterRows(rows, selected, null, index, 'Mortgage'));
  expect(yieldControl.mock.calls.length).toBeGreaterThan(10);
  expect(atYield[0]).toBe(0);
  expect(atYield.some(count => count > 0 && count < rows.length)).toBe(true);
  let cancelled = false;
  expect(await filterRowsCooperatively(rows, selected, null, index, 'Mortgage', {
    yieldControl: async () => { cancelled = true; }, cancelled: () => cancelled,
  })).toBeNull();
});

test('cooperative counting rejects a membership gate that changes between slices', async () => {
  let revision = 1;
  jest.spyOn(suitabilityGate, 'getSuitabilityRevision').mockImplementation(() => revision);
  expect(await filterRowsCooperatively(rows, filters, null, null, 'Mortgage', {
    yieldControl: async () => { revision++; },
  })).toBeNull();
});

test('a filtering pass copies the cached matching set once, independent of the row count', () => {
  const hits = productKeysMatchingIndex(index, 'solar')!;
  const expected = rows.filter((row) => hits.has(row.product_key));
  const iterate = Set.prototype[Symbol.iterator];
  let copiedMatchingKeys = 0;
  const iteratorSpy = jest.spyOn(Set.prototype, Symbol.iterator).mockImplementation(function (this: Set<unknown>) {
    if (this.has('batch-search-0')) copiedMatchingKeys += this.size;
    return iterate.call(this);
  });

  const result = filterRows(rows, { ...filters, query: 'solar' }, null, index);
  iteratorSpy.mockRestore();

  expect(result).toEqual(expected);
  expect(copiedMatchingKeys).toBe(hits.size);
  hits.clear();
  expect(filterRows(rows, { ...filters, query: 'solar' }, null, index)).toEqual(expected);
});

test.each(['', ' BANK A ', 'solar', ' SOLAR  OFFSET ', 'solar missing'])('batch query %j preserves indexed and basic row semantics', (query) => {
  for (const payloadIndex of [index, null]) {
    const expected = rows.filter((row) => rowMatchesSearchQuery(row, query, payloadIndex));
    expect(filterRows(rows, { ...filters, query }, null, payloadIndex)).toEqual(expected);
  }
});

test('each pass sees a corrected same-date index, including removed matches', () => {
  const query = 'solar';
  expect(filterRows(rows, { ...filters, query }, null, index)).toHaveLength(500);
  const corrected = { ...index, products: { 'batch-search-150': 'solar offset' } };
  const result = filterRows(rows, { ...filters, query }, null, corrected);
  expect(result).toEqual(rows.filter((row) => row.product_key === 'batch-search-150'));
});

test('basic search does not gain detail-only matches from loaded suitability details', () => {
  const details = Object.fromEntries(rows.map((row) => [row.product_key, { description: 'exclusive-feature' }]));
  expect(filterRows(rows, { ...filters, query: 'exclusive-feature' }, details)).toEqual([]);
  const matches = prepareRowSearchQuery('exclusive-feature');
  expect(matches(rows[0], 'exclusive-feature')).toBe(true);
  expect(matches(rows[0])).toBe(false);
  expect(prepareRowSearchQuery('solar offset')(rows[0], 'solar home offset')).toBe(false);
  expect(prepareRowSearchQuery('solar', { ...index, products: {} })(rows[0], 'solar')).toBe(false);
});

test('empty row batches do not prepare an unused index', () => {
  const products = jest.fn(() => index.products);
  const lazyIndex = Object.defineProperty({ ...index }, 'products', { get: products });
  expect(filterRows([], { ...filters, query: 'solar' }, null, lazyIndex)).toEqual([]);
  expect(products).not.toHaveBeenCalled();
});
