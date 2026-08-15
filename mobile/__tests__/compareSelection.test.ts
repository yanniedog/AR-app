import {
  resolveCompareSelections,
  toggleCompareSelection,
  validateCompareSelections,
} from '../src/data/compareSelection';
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
const savingsRows: RateRow[] = [
  { provider: 'Saver', product_key: 'S', product_name: 'Saver', rate: '0.04', rate_index: 1 },
];
const core: CorePayload = {
  schema_version: 1,
  run_date: '2026-08-04',
  sections: {
    Mortgage: { rates: rows, ribbon },
    Savings: { rates: savingsRows, ribbon },
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

  it('rejects a fifth selection without evicting an existing product', () => {
    const expanded: CorePayload = {
      ...core,
      sections: {
        ...core.sections,
        Mortgage: {
          ...core.sections.Mortgage,
          rates: [
            ...rows,
            { provider: 'B2', product_key: 'P2', product_name: 'P2', rate: '0.05' },
            { provider: 'B3', product_key: 'P3', product_name: 'P3', rate: '0.05' },
            { provider: 'B4', product_key: 'P4', product_name: 'P4', rate: '0.05' },
          ],
        },
      },
    };
    const current = ['1#P', 'P2', 'P3', 'P4'];
    expect(toggleCompareSelection(expanded, current, '2#P')).toEqual({
      tokens: current,
      rejection: 'limit_reached',
    });
    expect(validateCompareSelections(expanded, [...current, '2#P']).issue).toBe('limit_reached');
    expect(toggleCompareSelection(expanded, current, 'P3')).toEqual({
      tokens: ['1#P', 'P2', 'P4'],
      rejection: null,
    });
  });

  it('requires one category and rejects mixed or stale deep-link selections', () => {
    expect(toggleCompareSelection(core, ['1#P'], '1#S')).toEqual({
      tokens: ['1#P'],
      rejection: 'category_mismatch',
    });
    expect(validateCompareSelections(core, ['1#P', '1#S']).issue).toBe('category_mismatch');
    expect(validateCompareSelections(core, ['1#P', '9#P']).issue).toBe('unavailable');
    expect(validateCompareSelections(core, ['1#P']).issue).toBe('too_few');
  });
});
