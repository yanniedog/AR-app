import type { ProductDetail, RateRow } from '../src/types';
import {
  EMPTY_PROFILE,
  normalizeProfileFilters,
  PROFILE_FEATURE_OPTIONS,
  profileFeaturesForSection,
  profileFilterRows,
  profileSectionCount,
  profileSelectionCount,
  profileToFilters,
} from '../src/data/profile';
import { EMPTY_FILTERS } from '../src/data/selectors';
import { productHasAllFeatures } from '../src/data/featuresCore';
import { selectProfileRows } from '../src/data/profileSelection';

test('batch feature matching reuses exact scopes while preserving variants and corrected evidence', () => {
  const facts: NonNullable<ProductDetail['facts']> = [
    { id: 'offset', kind: 'feature', canonicalKey: 'OFFSET', value: true, unit: 'boolean', appliesTo: ['VARIABLE'] },
    { id: 'fixed-offset', kind: 'feature', canonicalKey: 'OFFSET', value: false, unit: 'boolean', appliesTo: ['FIXED'] },
  ];
  const readFacts = jest.fn(() => facts);
  const lookup: Record<string, ProductDetail> = {
    bank: { get facts() { return readFacts(); } },
    BANK: { facts: [{ id: 'offset', kind: 'feature', canonicalKey: 'OFFSET', value: false, unit: 'boolean' }] },
  };
  const base = { product_key: 'bank', provider: 'A', product_name: 'A', rate: '0.05', rate_type: 'VARIABLE' };
  const rows: RateRow[] = Array.from({ length: 100 }, (_, i) => ({ ...base, rate_index: i }));
  rows.push({ ...base, rate_type: 'FIXED' }, { ...base, product_key: 'BANK' });
  const profile = { ...EMPTY_PROFILE, accountFeatures: ['OFFSET'] };
  const expected = rows.filter(row => productHasAllFeatures(row.product_key, profile.accountFeatures, lookup, row, 'Mortgage'));
  const unsharedReads = readFacts.mock.calls.length;
  readFacts.mockClear();
  expect(selectProfileRows(rows, profile, 'Mortgage', lookup)).toEqual(expected);
  expect(expected).toHaveLength(100);
  expect(readFacts.mock.calls.length).toBeLessThan(unsharedReads / 10);
  facts[0].value = false;
  expect(selectProfileRows(rows, profile, 'Mortgage', lookup)).toEqual([]);
  expect(selectProfileRows(rows, { ...profile, accountFeatures: ['OFFSET', 'REDRAW'] }, 'Mortgage', lookup)).toEqual([]);
  expect(selectProfileRows(rows, profile, 'Mortgage', null)).toEqual([]);
});

test.each(['Mortgage', 'Savings', 'TD'] as const)('app selection preserves canonical attributes and feature intersections for %s', section => {
  const key = PROFILE_FEATURE_OPTIONS[section][0];
  const rows: RateRow[] = ['one', 'two', 'unknown'].map((product_key, index) => ({
    product_key, provider: 'Bank', product_name: product_key, rate: '0.05',
    rate_type: index ? 'FIXED' : 'VARIABLE', ribbon_deposit_kind: index ? 'BONUS' : 'STANDARD',
    interest_payment: index ? 'ANNUALLY' : 'MONTHLY',
  }));
  const lookup: Record<string, ProductDetail> = Object.fromEntries(rows.map(row => [row.product_key, {
    facts: [{ id: 'feature', kind: 'feature', canonicalKey: key, value: row.product_key === 'unknown' ? 'unknown' : true, unit: 'boolean' }],
  }]));
  const profile = { ...EMPTY_PROFILE, rateTypes: ['FIXED'], depositKinds: ['BONUS'], interestPayments: ['ANNUALLY'], accountFeatures: [key] };
  expect(selectProfileRows(rows, profile, section, lookup)).toEqual([rows[1]]);
  expect(selectProfileRows(rows, profile, section, lookup)).toEqual(profileFilterRows(rows, profile, section, lookup));
  expect(selectProfileRows(rows, EMPTY_PROFILE, section, lookup)).toBe(rows);
});

const mortgageRows: RateRow[] = [
  {
    provider: 'A',
    product_id: '1',
    product_key: 'A|1',
    product_name: 'Offset loan',
    category: 'RESIDENTIAL_MORTGAGES',
    rate: '0.05',
    rate_type: 'VARIABLE',
    loan_purpose: 'OWNER_OCCUPIED',
    lvr_tier: 'lvr_70-80%',
    ribbon_repayment_type: 'principal_and_interest',
  } as RateRow,
  {
    provider: 'B',
    product_id: '2',
    product_key: 'B|2',
    product_name: 'Basic loan',
    category: 'RESIDENTIAL_MORTGAGES',
    rate: '0.051',
    rate_type: 'VARIABLE',
    loan_purpose: 'OWNER_OCCUPIED',
    lvr_tier: 'lvr_70-80%',
    ribbon_repayment_type: 'principal_and_interest',
  } as RateRow,
];

const details: Record<string, ProductDetail> = {
  'A|1': { facts: ['OFFSET', 'EXTRA_REPAYMENTS'].map(key => ({ id: key, kind: 'feature', canonicalKey: key, value: true, unit: 'boolean' })), features: [{ label: 'OFFSET' }, { label: 'EXTRA_REPAYMENTS' }] },
  'B|2': { features: [{ label: 'REDRAW' }] },
};

describe('profile account features', () => {
  test('normalizeProfileFilters defaults accountFeatures', () => {
    expect(normalizeProfileFilters(null).accountFeatures).toEqual([]);
    expect(normalizeProfileFilters({ accountFeatures: ['OFFSET', 1 as never] }).accountFeatures).toEqual([
      'OFFSET',
    ]);
  });

  test('profileFeaturesForSection intersects curated allowlist', () => {
    const p = {
      ...EMPTY_PROFILE,
      accountFeatures: ['OFFSET', 'CARD_ACCESS', 'OTHER'],
    };
    expect(profileFeaturesForSection(p, 'Mortgage')).toEqual(['OFFSET']);
    expect(profileFeaturesForSection(p, 'Savings')).toEqual(['CARD_ACCESS']);
    expect(PROFILE_FEATURE_OPTIONS.Mortgage).toContain('EXTRA_REPAYMENTS');
  });

  test('profileToFilters seeds Search accountFeatures for the section', () => {
    const p = {
      ...EMPTY_PROFILE,
      loanPurposes: ['OWNER_OCCUPIED'],
      accountFeatures: ['OFFSET', 'EXTRA_REPAYMENTS', 'CARD_ACCESS'],
    };
    const mortgage = profileToFilters(p, 'Mortgage', EMPTY_FILTERS);
    expect(mortgage.loanPurposes).toEqual(['OWNER_OCCUPIED']);
    expect(mortgage.accountFeatures).toEqual(['OFFSET', 'EXTRA_REPAYMENTS']);

    const savings = profileToFilters(p, 'Savings', EMPTY_FILTERS);
    expect(savings.accountFeatures).toEqual(['CARD_ACCESS']);
    expect(savings.loanPurposes).toEqual([]);
  });

  test('profileFilterRows applies features when details are present', () => {
    const p = { ...EMPTY_PROFILE, accountFeatures: ['OFFSET'] };
    // Fail closed without details so must-have features are never silently dropped.
    expect(profileFilterRows(mortgageRows, p, 'Mortgage')).toHaveLength(0);
    expect(profileFilterRows(mortgageRows, p, 'Mortgage', details).map((r) => r.product_key)).toEqual([
      'A|1',
    ]);
    expect(
      profileFilterRows(
        mortgageRows,
        { ...EMPTY_PROFILE, accountFeatures: ['OFFSET', 'EXTRA_REPAYMENTS'] },
        'Mortgage',
        details,
      ).map((r) => r.product_key),
    ).toEqual(['A|1']);
  });

  test('selection and section counts include account features', () => {
    const p = {
      ...EMPTY_PROFILE,
      rateTypes: ['VARIABLE'],
      accountFeatures: ['OFFSET', 'CARD_ACCESS'],
    };
    expect(profileSelectionCount(p)).toBe(3);
    expect(profileSectionCount(p, 'Mortgage')).toBe(2); // VARIABLE + OFFSET
    expect(profileSectionCount(p, 'Savings')).toBe(1); // CARD_ACCESS
  });
});
