import {
  isSavedRate,
  makeSavedRateRef,
  migrateSavedRateProductAliases,
  normalizeSavedRates,
  resolveSavedRates,
  toggleSavedRateRefs,
  unresolvedSavedRateRefs,
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

  it('fails closed for unindexed exact saves and malformed persisted exact refs', () => {
    expect(() => makeSavedRateRef({ ...row(2, '0.06'), rate_index: undefined }, 'rate')).toThrow(
      /integer rate_index/,
    );
    expect(normalizeSavedRates([
      { scope: 'rate', productKey: 'EX|HOME', rateIndex: null, savedAt: '2026-08-04' },
    ])).toEqual([]);
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

  it('surfaces a missing product-wide save for removal', () => {
    const productRef = normalizeSavedRates(undefined, ['REMOVED|PRODUCT'])[0];
    expect(unresolvedSavedRateRefs([productRef], resolveSavedRates(core, [productRef]))).toEqual([
      productRef,
    ]);
  });

  it('clears a migrated all-variant save when its selected rate star is tapped', () => {
    const legacy = normalizeSavedRates(undefined, ['EX|HOME']);
    expect(toggleSavedRateRefs(legacy, row(2, '0.06'))).toEqual([]);
  });

  it('replaces exact saves when the user explicitly saves all variants', () => {
    const exact = makeSavedRateRef(row(2, '0.06'));
    const refs = toggleSavedRateRefs([exact], row(1, '0.055'), 'product');
    expect(refs).toEqual([
      expect.objectContaining({ id: 'product:EX|HOME', scope: 'product' }),
    ]);
  });

  it('migrates legacy aliases without rebinding an unauthenticated exact tier', () => {
    const exact = makeSavedRateRef(row(2, '0.06'), 'rate', '2026-08-04T00:00:00.000Z');
    const product = makeSavedRateRef(row(1, '0.055'), 'product', '2026-08-05T00:00:00.000Z');
    const aliases = new Map([['EX|HOME', { productKey: 'product:v1:canonical' }]]);

    expect(migrateSavedRateProductAliases([exact], aliases)).toEqual([{
      ...exact,
      id: 'product:product:v1:canonical',
      scope: 'product',
      productKey: 'product:v1:canonical',
      rateIndex: null,
      savedRate: null,
    }]);
    expect(migrateSavedRateProductAliases([exact, product], aliases)).toEqual([
      {
        ...product,
        id: 'product:product:v1:canonical',
        scope: 'product',
        productKey: 'product:v1:canonical',
        rateIndex: null,
        savedRate: null,
      },
    ]);
  });
});
