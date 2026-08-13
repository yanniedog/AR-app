import { assessAccess, accessExcludesFromStandard, providerRestrictsAccess, rowRestrictsAccess } from '../src/data/access';
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

  it('matches plural staff wording in product names', () => {
    expect(assessAccess('Employees Home Loan Package', null).categories).toContain('staff');
  });

  it('does not mark provider-brand occupation badges as unverified', () => {
    const a = assessAccess('RateSaver Home Loan', null, 'Australian Military Bank');
    expect(a.categories).toContain('occupation');
    expect(a.verify).toBe(false);
    expect(a.badge).toBe('Occupation-restricted');
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

  it('flags youth and junior accounts from product names', () => {
    expect(assessAccess('Youth Saver', null).categories).toContain('youth');
    expect(assessAccess('Kids Savings Account', null).categories).toContain('youth');
    expect(assessAccess('Junior Saver', null).badge).toBe('Youth only');
    expect(assessAccess('Teen Transaction Account', null).restricted).toBe(true);
  });

  it('does not present first-home-buyer products as open to everyone', () => {
    const named = assessAccess('First Home Buyer Loan', elig(['MIN_AGE', 'NATURAL_PERSON']));
    expect(named.categories).toContain('first-home');
    expect(named.badge).toBe('First-home buyers');
    expect(accessExcludesFromStandard(named)).toBe(true);

    const disclosed = assessAccess(
      'Variable Home Loan',
      elig(['MIN_AGE'], [{ info: 'This loan is only available for first home buyers' }]),
    );
    expect(disclosed.categories).toContain('first-home');
  });

  it('does not turn first-home marketing or an optional LVR pathway into a whole-product restriction', () => {
    const marketed = assessAccess('Minimiser Home Loan', {
      description: 'Perfect for First Home Buyers',
      eligibility: [{ label: 'MIN_AGE' }],
    });
    expect(marketed.categories).not.toContain('first-home');
    expect(marketed.restricted).toBe(false);

    const optionalPath = assessAccess('Value Fixed Home Loan 12M', {
      eligibility: [{
        label: 'OTHER',
        info: 'First home buyers may apply up to 95% LVR; the standard option is available up to 80% LVR.',
      }],
    });
    expect(optionalPath.categories).not.toContain('first-home');
    expect(optionalPath.restricted).toBe(false);
  });

  it('flags MAX_AGE eligibility as youth-restricted when the cap is a youth bound', () => {
    const a = assessAccess(
      'Everyday Account',
      {
        eligibility: [
          { label: 'MAX_AGE', value: 18, info: 'Maximum age 18' },
          { label: 'MIN_AGE' },
        ],
      },
    );
    expect(a.categories).toContain('youth');
    expect(a.restricted).toBe(true);
  });

  it('does not treat senior MAX_AGE lending caps as youth-only', () => {
    const a = assessAccess(
      'Variable Home Loan',
      {
        eligibility: [
          { label: 'MAX_AGE', value: 75, info: 'Maximum borrower age 75' },
          { label: 'MIN_AGE' },
        ],
      },
    );
    expect(a.categories).not.toContain('youth');
    expect(a.restricted).toBe(false);
  });

  it('does not treat guardian under-18 copy as youth-only access', () => {
    const a = assessAccess(
      'Everyday Transaction Account',
      elig(['MIN_AGE'], [{ info: 'Customers under 18 must have a parent or guardian' }]),
    );
    expect(a.categories).not.toContain('youth');
    expect(a.restricted).toBe(false);
  });

  it('flags region-specific products from name and eligibility text', () => {
    expect(assessAccess('QLD Residents Home Loan', null).categories).toContain('geographic');
    const regional = assessAccess('Regional Saver', elig(['OTHER'], [{ info: 'Only available in Victoria' }]));
    expect(regional.categories).toContain('geographic');
    const wa = assessAccess('Community Saver', elig(['OTHER'], [{ info: 'Available to customers in WA' }]));
    expect(wa.badge).toBe('Region-restricted');
    expect(
      assessAccess('Capital Saver', elig(['OTHER'], [{ info: 'Available to customers in ACT' }])).categories,
    ).toContain('geographic');
    expect(
      assessAccess('Action Account', elig(['OTHER'], [{ info: 'Available to act as trustee' }])).restricted,
    ).toBe(false);

    // Generic Australian residency requirements are not geographic access gates.
    const ausResident = assessAccess(
      'Everyday Account',
      elig(['OTHER'], [{ info: 'Must be an Australian resident' }]),
    );
    expect(ausResident.categories).not.toContain('geographic');
    expect(ausResident.restricted).toBe(false);

    const ausResidentsOnly = assessAccess(
      'Online Saver',
      elig(['OTHER'], [{ info: 'Available to Australian residents only' }]),
    );
    expect(ausResidentsOnly.categories).not.toContain('geographic');
    expect(ausResidentsOnly.restricted).toBe(false);

    const citizens = assessAccess(
      'Basic Saver',
      elig(['OTHER'], [{ info: 'Must be citizens or permanent residents of Australia' }]),
    );
    expect(citizens.categories).not.toContain('geographic');
    expect(citizens.restricted).toBe(false);
  });

  it('flags state-qualified residents-of restrictions', () => {
    const nsw = assessAccess(
      'Regional Saver',
      elig(['OTHER'], [{ info: 'Available only to residents of NSW' }]),
    );
    expect(nsw.categories).toContain('geographic');
    const qld = assessAccess(
      'State Saver',
      elig(['OTHER'], [{ info: 'Must be residents of Queensland' }]),
    );
    expect(qld.categories).toContain('geographic');
  });

  it('does not treat Credit Union brand in description as membership', () => {
    const a = assessAccess(
      'Fixed Home Loan Package',
      {
        description: 'A home loan package from Credit Union SA with competitive rates.',
        eligibility: [{ label: 'MIN_AGE', name: 'Minimum age', info: '18 years' }],
      },
      'Credit Union SA',
    );
    expect(a.categories).not.toContain('membership');
  });

  it('flags existing-customer / package gates from eligibility copy', () => {
    const a = assessAccess(
      'Package Offset Loan',
      elig(['OTHER'], [{ info: 'Existing customers only - must hold an everyday account' }]),
    );
    expect(a.categories).toContain('package');
    expect(a.restricted).toBe(true);
  });

  it('does not treat ordinary linked-transaction-account rules as package gates', () => {
    const a = assessAccess(
      'High Interest Saver',
      elig(['OTHER'], [{ info: 'Requires a linked transaction account to earn bonus interest' }]),
    );
    expect(a.categories).not.toContain('package');
    expect(a.restricted).toBe(false);
  });

  it('does not treat linked Pensioner product names as pensioner-only', () => {
    const a = assessAccess(
      'Online Saver',
      elig(['OTHER'], [{ info: 'Eligible linked accounts include ANZ Pensioner Advantage' }]),
    );
    expect(a.categories).not.toContain('pension');
    expect(a.restricted).toBe(false);
  });

  it('does not treat LVR / deposit / term / OO-investor structure as access restrictions', () => {
    const a = assessAccess(
      'Variable OO Home Loan LVR 80%',
      elig(['MIN_AGE', 'RESIDENCY_STATUS', 'NATURAL_PERSON'], [
        { info: 'Maximum LVR 80%. Minimum deposit $50,000. Owner-occupier principal and interest.' },
      ]),
      'Westpac',
    );
    expect(a.restricted).toBe(false);
    expect(a.badge).toBeNull();
  });

  it('accessExcludesFromStandard matches badge visibility', () => {
    const youth = assessAccess('Youth Saver', null);
    expect(youth.badge).toBeTruthy();
    expect(accessExcludesFromStandard(youth)).toBe(true);
    const open = assessAccess('Basic Variable Home Loan', elig(['MIN_AGE']));
    expect(open.badge).toBeNull();
    expect(accessExcludesFromStandard(open)).toBe(false);
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
