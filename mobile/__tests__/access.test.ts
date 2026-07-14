import { assessAccess, providerRestrictsAccess, rowRestrictsAccess } from '../src/data/access';
import type { ProductDetail } from '../src/types';

const elig = (codes: string[], extra: { name?: string; info?: string }[] = []): ProductDetail => ({
  eligibility: [
    ...codes.map((label) => ({ label })),
    ...extra.map((e) => ({ label: 'OTHER', ...e })),
  ],
});

describe('assessAccess', () => {
  it('treats a plain product with only universal codes as public', () => {
    const a = assessAccess('Basic Variable Home Loan', elig(['MIN_AGE', 'RESIDENCY_STATUS', 'NATURAL_PERSON']));
    expect(a.restricted).toBe(false);
    expect(a.verify).toBe(false);
    expect(a.badge).toBeNull();
  });

  it('flags STAFF-coded products as staff-restricted', () => {
    const a = assessAccess('Premium Package', elig(['STAFF', 'MIN_AGE']));
    expect(a.restricted).toBe(true);
    expect(a.categories).toContain('staff');
    expect(a.badge).toBe('Staff only');
  });

  it('flags the Coastline/People-First failure mode: name says staff, data does not', () => {
    // Real example: "People First and Her Staff Home Loan" with only universal codes.
    const a = assessAccess('People First and Her Staff Home Loan', elig(['MIN_AGE', 'NATURAL_PERSON', 'RESIDENCY_STATUS']));
    expect(a.restricted).toBe(true); // name signal
    expect(a.verify).toBe(true); // not structurally confirmed
    expect(a.summary).toMatch(/confirm|verify/i);
  });

  it('detects occupation restrictions from free-text additionalInfo', () => {
    const a = assessAccess('Salute Account', elig(['EMPLOYMENT_STATUS'], [{ info: 'Available to current and former Defence Force members' }]));
    expect(a.categories).toContain('occupation');
    expect(a.restricted).toBe(true);
  });

  it('does not treat bare EMPLOYMENT_STATUS (employed/self-employed) as occupation-restricted', () => {
    const a = assessAccess(
      'Fixed Rate Home Loan',
      elig(['MIN_AGE', 'RESIDENCY_STATUS', 'EMPLOYMENT_STATUS']),
      'Westpac',
    );
    expect(a.categories).not.toContain('occupation');
    expect(a.restricted).toBe(false);
  });

  it('flags occupation lenders with generic product titles via provider', () => {
    const a = assessAccess('RateSaver Home Loan', null, 'Australian Military Bank');
    expect(a.categories).toContain('occupation');
    expect(a.restricted).toBe(true);
  });

  it('flags medical-professional-only products from eligibility text', () => {
    const a = assessAccess(
      'Basic Home Loan',
      elig(['MIN_AGE'], [{ info: 'Product is offered to medical, dental, veterinary & accounting professionals only' }]),
      'BOQ Specialist',
    );
    expect(a.categories).toContain('occupation');
    expect(a.restricted).toBe(true);
  });
});

describe('providerRestrictsAccess', () => {
  it('returns true for known occupation-limited providers', () => {
    expect(providerRestrictsAccess('Australian Military Bank')).toBe(true);
    expect(providerRestrictsAccess('Police Bank')).toBe(true);
  });

  it('returns false for non-occupation providers and generic credit unions', () => {
    expect(providerRestrictsAccess('Some Credit Union')).toBe(false);
    expect(providerRestrictsAccess('Bank of Sydney')).toBe(false);
  });
});

describe('rowRestrictsAccess', () => {
  it('returns true for occupation lenders with generic product titles', () => {
    expect(
      rowRestrictsAccess({
        provider: 'Police Bank',
        product_name: 'RateSaver Home Loan',
      }),
    ).toBe(true);
  });

  it('returns false for non-occupation providers and neutral products', () => {
    expect(
      rowRestrictsAccess({
        provider: 'Some Credit Union',
        product_name: 'Fixed Rate Home Loan',
      }),
    ).toBe(false);
  });
});

describe('assessAccess business / false positives', () => {
  it('detects business/SMSF products', () => {
    expect(assessAccess('SMSF Term Deposit', null).categories).toContain('business');
    expect(assessAccess('Business Term Deposit', elig(['BUSINESS'])).categories).toContain('business');
  });

  it('does NOT flag a retail loan whose eligibility text merely excludes companies/trusts', () => {
    // Real false-positive: Unloan / Virgin Money Lite say "not available to
    // companies or trusts" — a negation, not a business restriction.
    const a = assessAccess(
      'Unloan Home Loan',
      elig(['NATURAL_PERSON', 'MIN_AGE'], [{ info: 'Not available to company or trust borrowers' }]),
    );
    expect(a.categories).not.toContain('business');
    expect(a.restricted).toBe(false);
  });

  it('does not over-flag a public product whose name merely mentions a city', () => {
    const a = assessAccess('Bank of Melbourne Saver', elig(['MIN_AGE']));
    expect(a.restricted).toBe(false);
    expect(a.verify).toBe(false);
  });
});
