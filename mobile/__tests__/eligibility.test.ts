import {
  distinctEligibilityCriteria,
  eligibilityTypeKey,
  productHasAllEligibilityCriteria,
} from '../src/data/eligibility';
import { EMPTY_FILTERS, activeFilterCount, filterRows } from '../src/data/selectors';
import type { ProductDetail, RateRow } from '../src/types';

const mk = (over: Partial<RateRow>): RateRow => ({
  provider: 'Bank A',
  product_key: 'k',
  product_name: 'Product',
  rate: '0.05',
  ...over,
});

describe('eligibility', () => {
  test('eligibilityTypeKey prefers label then name', () => {
    expect(eligibilityTypeKey({ label: 'MIN_AGE', name: 'Age' })).toBe('MIN_AGE');
    expect(eligibilityTypeKey({ name: 'RESIDENCY_STATUS' })).toBe('RESIDENCY_STATUS');
  });

  test('productHasAllEligibilityCriteria uses AND logic', () => {
    const lookup: Record<string, ProductDetail> = {
      'A|1': {
        eligibility: [
          { label: 'MIN_AGE', value: '18' },
          { label: 'RESIDENCY_STATUS', info: 'Australian resident' },
        ],
      },
      'B|1': { eligibility: [{ label: 'MIN_AGE', value: '18' }] },
    };
    expect(productHasAllEligibilityCriteria('A|1', [], lookup)).toBe(true);
    expect(productHasAllEligibilityCriteria('A|1', ['MIN_AGE'], lookup)).toBe(true);
    expect(productHasAllEligibilityCriteria('A|1', ['MIN_AGE', 'RESIDENCY_STATUS'], lookup)).toBe(true);
    expect(productHasAllEligibilityCriteria('B|1', ['MIN_AGE', 'RESIDENCY_STATUS'], lookup)).toBe(false);
    expect(productHasAllEligibilityCriteria('A|1', ['MIN_AGE'], null)).toBe(false);
  });

  test('distinctEligibilityCriteria sorts alphabetically by display label', () => {
    const rows = [
      mk({ product_key: 'A|1' }),
      mk({ product_key: 'A|1', rate_index: 2 }),
      mk({ product_key: 'B|1' }),
    ];
    const lookup: Record<string, ProductDetail> = {
      'A|1': { eligibility: [{ label: 'MIN_AGE' }, { label: 'OTHER' }] },
      'B|1': { eligibility: [{ label: 'MIN_AGE' }] },
    };
    expect(distinctEligibilityCriteria(rows, lookup)).toEqual(['MIN_AGE', 'OTHER']);
  });

  test('filterRows applies eligibilityCriteria with details lookup', () => {
    const rows = [
      mk({ product_key: 'A|1' }),
      mk({ product_key: 'B|1' }),
      mk({ product_key: 'C|1' }),
    ];
    const lookup: Record<string, ProductDetail> = {
      'A|1': { eligibility: [{ label: 'NATURAL_PERSON' }, { label: 'MIN_AGE' }] },
      'B|1': { eligibility: [{ label: 'NATURAL_PERSON' }] },
      'C|1': { eligibility: [{ label: 'BUSINESS' }] },
    };
    const natural = filterRows(rows, { ...EMPTY_FILTERS, eligibilityCriteria: ['NATURAL_PERSON'] }, lookup);
    expect(natural.map((r) => r.product_key)).toEqual(['A|1', 'B|1']);
    const both = filterRows(
      rows,
      { ...EMPTY_FILTERS, eligibilityCriteria: ['NATURAL_PERSON', 'MIN_AGE'] },
      lookup,
    );
    expect(both.map((r) => r.product_key)).toEqual(['A|1']);
    expect(
      filterRows(rows, { ...EMPTY_FILTERS, eligibilityCriteria: ['NATURAL_PERSON'] }, null),
    ).toHaveLength(0);
  });

  test('activeFilterCount includes eligibilityCriteria selections', () => {
    expect(activeFilterCount({ ...EMPTY_FILTERS, eligibilityCriteria: ['MIN_AGE', 'OTHER'] })).toBe(2);
  });

  test('promotes curated normalized eligibility and constraints but not condition text', () => {
    const rows = [mk({ product_key: 'A|1' })];
    const lookup: Record<string, ProductDetail> = {
      'A|1': { facts: [
        { id: 'age-1', kind: 'eligibility', canonicalKey: 'MIN_AGE', value: 18, unit: 'year' },
        { id: 'balance-1', kind: 'constraint', canonicalKey: 'MAX_BALANCE', value: 100000, unit: 'AUD' },
        { id: 'note-1', kind: 'condition', canonicalKey: 'SPECIAL_COHORT', condition: 'Invitation only' },
      ], eligibility: [{ label: 'OTHER' }] },
    };

    expect(distinctEligibilityCriteria(rows, lookup)).toEqual(['MAX_BALANCE', 'MIN_AGE']);
    expect(productHasAllEligibilityCriteria('A|1', ['MIN_AGE', 'MAX_BALANCE'], lookup)).toBe(true);
    expect(productHasAllEligibilityCriteria('A|1', ['SPECIAL_COHORT'], lookup)).toBe(false);
  });

  test('resolves namespaced eligibility keys through sourceType', () => {
    const rows = [mk({ product_key: 'A|1' })];
    const lookup: Record<string, ProductDetail> = {
      'A|1': { facts: [
        { id: 'age-source', kind: 'eligibility', canonicalKey: 'eligibility.min_age', sourceType: 'MIN_AGE', value: 18, unit: 'year' },
      ] },
    };

    expect(distinctEligibilityCriteria(rows, lookup)).toEqual(['MIN_AGE']);
  });
});
