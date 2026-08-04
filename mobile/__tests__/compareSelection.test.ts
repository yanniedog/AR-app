import { resolveCompareSelections } from '../src/data/compareSelection';
import type { CorePayload, RateRow } from '../src/types';

const ribbon = {
  counts: { rates: 2, products: 1, providers: 1 },
  range: { min: null, max: null, mean: null, median: null },
  providers: [],
};
const rows: RateRow[] = [
  { provider: 'Bank', product_key: 'P', product_name: 'Product', rate: '0.05', rate_index: 1 },
  { provider: 'Bank', product_key: 'P', product_name: 'Product', rate: '0.06', rate_index: 2 },
];
const core: CorePayload = {
  schema_version: 1,
  run_date: '2026-08-04',
  sections: {
    Mortgage: { rates: rows, ribbon },
    Savings: { rates: [], ribbon },
    TD: { rates: [], ribbon },
  },
  brands: {},
  rba: [],
};

describe('compare exact selection', () => {
  it('resolves the requested rate and rejects a stale sibling index', () => {
    expect(resolveCompareSelections(core, ['2#P'])[0]?.row.rate_index).toBe(2);
    expect(resolveCompareSelections(core, ['9#P'])).toEqual([]);
  });
});
