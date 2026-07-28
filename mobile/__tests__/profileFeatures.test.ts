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
  'A|1': { features: [{ label: 'OFFSET' }, { label: 'EXTRA_REPAYMENTS' }] },
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
    expect(profileFilterRows(mortgageRows, p, 'Mortgage')).toHaveLength(2);
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
