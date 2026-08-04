import {
  isSavedRate,
  makeSavedRateRef,
  normalizeSavedRates,
  resolveSavedRates,
  toggleSavedRateRefs,
} from '../src/data/savedRates';
import type { CorePayload, RateRow } from '../src/types';

const row = (rateIndex: number, rate: string): RateRow => ({
  provider: 'Example Bank',
  product_key: 'EX|HOME',
  product_name: 'Variable home loan',
  rate_index: rateIndex,
  rate,
});

const ribbon = {
  counts: { rates: 0, products: 0, providers: 0 },
  range: { min: null, max: null, mean: null, median: null },
  providers: [],
};

const core: CorePayload = {
  schema_version: 1,
  run_date: '2026-08-04',
  sections: {
    Mortgage: { rates: [row(1, '0.055'), row(2, '0.06')], ribbon },
    Savings: { rates: [], ribbon },
    TD: { rates: [], ribbon },
  },
  brands: {},
  rba: [],
};

describe('saved rate references', () => {
  it('saves an exact rate identity and observed rate', () => {
    const ref = makeSavedRateRef(row(2, '0.06'), 'rate', '2026-08-04T00:00:00.000Z');
    expect(ref).toMatchObject({
      id: 'rate:EX|HOME:2',
      scope: 'rate',
      rateIndex: 2,
      savedRate: 0.06,
    });
    expect(isSavedRate([ref], 'EX|HOME', 2)).toBe(true);
    expect(isSavedRate([ref], 'EX|HOME', 1)).toBe(false);
  });

  it('migrates legacy favourites as explicit all-variant references', () => {
    expect(normalizeSavedRates(undefined, ['EX|HOME'])).toEqual([
      expect.objectContaining({
        id: 'product:EX|HOME',
        scope: 'product',
        productKey: 'EX|HOME',
        rateIndex: null,
      }),
    ]);
  });

  it('resolves the saved variant rather than the first product row', () => {
    const ref = makeSavedRateRef(row(2, '0.06'));
    expect(resolveSavedRates(core, [ref])[0]?.row.rate_index).toBe(2);
  });

  it('does not substitute another tier when an exact saved rate disappears', () => {
    const ref = makeSavedRateRef(row(9, '0.07'));
    expect(resolveSavedRates(core, [ref])).toEqual([]);
  });

  it('clears a migrated all-variant save when its selected rate star is tapped', () => {
    const legacy = normalizeSavedRates(undefined, ['EX|HOME']);
    expect(toggleSavedRateRefs(legacy, row(2, '0.06'))).toEqual([]);
  });
});
