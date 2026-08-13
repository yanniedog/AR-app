import {
  buildNegotiationBrief,
  buildRateReceipt,
  officialReceiptSources,
} from '../src/data/rateReceipt';
import { EMPTY_USER_RATE_SCENARIO, normalizeUserRateScenario } from '../src/data/userRateScenario';
import type { ProductDetail, RateRow } from '../src/types';

function row(overrides: Partial<RateRow> = {}): RateRow {
  return {
    provider: 'Example Bank',
    product_key: 'example|loan',
    product_id: 'HL-1',
    product_name: 'Clear Variable Loan',
    rate: '0.055',
    comparison_rate: '0.057',
    rate_index: 4,
    rate_type: 'VARIABLE',
    ribbon_rate_structure: 'VARIABLE',
    ribbon_repayment_type: 'PRINCIPAL_AND_INTEREST',
    lvr_tier: 'LVR_70_80',
    loan_purpose: 'OWNER_OCCUPIED',
    account_class: 'standard',
    last_updated: '2026-08-03T04:30:00Z',
    ...overrides,
  };
}

const detail: ProductDetail = {
  eligibility: [{ name: 'Minimum age', value: '18', info: 'Australian resident' }],
  constraints: [{ label: 'MIN_LIMIT', value: '$150,000' }],
  fees: [{ name: 'Annual fee', value: '$0' }],
  links: {
    overview: 'https://examplebank.test/products/clear#rates',
    eligibility: 'https://examplebank.test/products/clear/eligibility',
    terms: 'http://examplebank.test/insecure',
  },
};

describe('rate receipt', () => {
  test('captures an exact dated tier, conditions, fees and safe official evidence', () => {
    const receipt = buildRateReceipt({
      row: row(),
      section: 'Mortgage',
      evidenceDate: '2026-08-04',
      detail,
    });

    expect(receipt).toMatchObject({
      version: 1,
      productKey: 'example|loan',
      rateIndex: 4,
      evidenceDate: '2026-08-04',
      sourceUpdatedAt: '2026-08-03T04:30:00Z',
      advertisedRate: '5.50%',
      comparisonRate: '5.70%',
      cohort: 'standard',
    });
    expect(receipt.tier).toEqual(expect.arrayContaining([
      { label: 'Exact rate row', value: 'Rate index 4' },
      { label: 'LVR tier', value: 'LVR 70 80' },
    ]));
    expect(receipt.conditions).toEqual(expect.arrayContaining([
      { label: 'Minimum age', value: '18 — Australian resident' },
      { label: 'Min limit', value: '$150,000' },
    ]));
    expect(receipt.fees).toContainEqual({ label: 'Annual fee', value: '$0' });
    expect(receipt.officialSources.map((source) => source.kind)).toEqual(['overview', 'eligibility']);
    expect(receipt.officialSources[0].url).toBe('https://examplebank.test/products/clear');
  });

  test('accepts only unique HTTPS official links and records missing evidence honestly', () => {
    expect(officialReceiptSources({
      overview: 'https://bank.test/product',
      eligibility: 'https://bank.test/product',
      fees: 'javascript:alert(1)',
      terms: 'http://bank.test/terms',
    })).toEqual([
      { kind: 'overview', label: 'Published product overview', url: 'https://bank.test/product', hostname: 'bank.test' },
    ]);

    const receipt = buildRateReceipt({
      row: row({ ongoing_rate: '0', ribbon_deposit_kind: 'bonus', rate_type: 'BONUS' }),
      section: 'Savings',
      evidenceDate: '2026-08-04',
    });
    expect(receipt.ongoingRate).toBe('0.00%');
    expect(receipt.limitations).toEqual(expect.arrayContaining([
      expect.stringMatching(/No valid HTTPS lender document link/),
      expect.stringMatching(/did not publish detailed eligibility/),
    ]));
  });
});

describe('local negotiation brief', () => {
  test('uses explicit mortgage inputs and Standard-only observed comparables', () => {
    const selected = row({ rate: '0.05', comparison_rate: '0.052' });
    const receipt = buildRateReceipt({
      row: selected,
      section: 'Mortgage',
      evidenceDate: '2026-08-04',
      detail,
    });
    const scenario = normalizeUserRateScenario({
      mortgage: {
        mode: 'refi',
        propertyValue: '800000',
        loanBalance: '500000',
        currentRate: '6.00',
        years: '25',
      },
    });
    const brief = buildNegotiationBrief({
      receipt,
      scenario,
      sectionRows: [
        selected,
        row({ rate_index: 8, rate: '0.048' }),
        row({ product_key: 'best|1', product_name: 'Best standard', provider: 'Alpha', rate: '0.049' }),
        row({ product_key: 'other|1', product_name: 'Other standard', provider: 'Beta', rate: '0.054' }),
        row({ product_key: 'restricted|1', product_name: 'Staff loan', provider: 'Gamma', rate: '0.01', account_class: 'non_standard' }),
      ],
    });

    expect(brief.scenario).toEqual(expect.arrayContaining([
      { label: 'Scenario', value: 'Refinancing' },
      { label: 'Loan amount', value: '$500,000' },
      { label: 'Current rate entered', value: '6.00%' },
    ]));
    expect(brief.comparables.map((item) => item.productKey)).toEqual(['best|1', 'other|1']);
    expect(brief.comparables.some((item) => item.productKey === selected.product_key)).toBe(false);
    expect(brief.comparables.some((item) => item.productKey === 'restricted|1')).toBe(false);
    expect(brief.illustration).toMatchObject({
      balance: 500000,
      currentRate: '6.00%',
      selectedRate: '5.00%',
      annualDifference: 5000,
      direction: 'lower-cost',
    });
    expect(brief.illustration?.monthlyDifference).toBeCloseTo(416.67, 1);
    expect(brief.limitations.join(' ')).toMatch(/not matched to your eligibility/i);
    expect(brief.disclaimer).toMatch(/generated locally/i);
  });

  test('models a deposit improvement and avoids inventing a monthly TD return', () => {
    const selected = row({
      product_key: 'td|1',
      product_name: '12 Month TD',
      rate: '0.05',
      comparison_rate: undefined,
      ribbon_deposit_kind: 'fixed',
      term: 'P1Y',
    });
    const receipt = buildRateReceipt({
      row: selected,
      section: 'TD',
      evidenceDate: '2026-08-04',
    });
    const scenario = normalizeUserRateScenario({
      termDeposit: { balance: '100000', currentRate: '4.00' },
    });
    const brief = buildNegotiationBrief({ receipt, scenario, sectionRows: [selected] });

    expect(brief.illustration).toMatchObject({
      annualDifference: 1000,
      periodDifference: 1000,
      periodLabel: 'at 1 yr maturity',
      monthlyDifference: null,
      direction: 'higher-return',
    });
    expect(brief.illustration?.assumption).toMatch(/maturity instructions/i);
  });

  test('bounds TD and introductory illustrations to their published period', () => {
    const scenario = normalizeUserRateScenario({
      termDeposit: { balance: '100000', currentRate: '4.00' },
      savings: { balance: '100000', currentRate: '4.00' },
    });
    const tdRow = row({ product_key: 'td|3m', rate: '0.05', term: 'P3M' });
    const tdReceipt = buildRateReceipt({ row: tdRow, section: 'TD', evidenceDate: '2026-08-04' });
    const tdBrief = buildNegotiationBrief({ receipt: tdReceipt, scenario, sectionRows: [tdRow] });
    expect(tdBrief.illustration).toMatchObject({
      annualDifference: 1000,
      periodDifference: 250,
      periodLabel: 'at 3 mo maturity',
      monthlyDifference: null,
    });

    const introRow = row({ product_key: 'save|intro', rate: '0.05', rate_type: 'INTRODUCTORY', term: 'P3M' });
    const introReceipt = buildRateReceipt({ row: introRow, section: 'Savings', evidenceDate: '2026-08-04' });
    const introBrief = buildNegotiationBrief({ receipt: introReceipt, scenario, sectionRows: [introRow] });
    expect(introBrief.illustration).toMatchObject({
      periodDifference: 250,
      periodLabel: 'over the published 3 mo period',
      monthlyDifference: null,
    });
  });

  test('suppresses TD dollars when no reliable term was published', () => {
    const selected = row({ product_key: 'td|unknown', rate: '0.05', term: undefined, term_months: undefined });
    const receipt = buildRateReceipt({ row: selected, section: 'TD', evidenceDate: '2026-08-04' });
    const scenario = normalizeUserRateScenario({ termDeposit: { balance: '100000', currentRate: '4.00' } });
    expect(buildNegotiationBrief({ receipt, scenario, sectionRows: [selected] }).illustration).toBeNull();
  });

  test('does not fabricate a personal illustration without an explicit scenario', () => {
    const receipt = buildRateReceipt({
      row: row(),
      section: 'Mortgage',
      evidenceDate: '2026-08-04',
      detail,
    });
    const brief = buildNegotiationBrief({
      receipt,
      scenario: EMPTY_USER_RATE_SCENARIO,
      sectionRows: [row()],
    });
    expect(brief.scenario).toEqual([]);
    expect(brief.illustration).toBeNull();
  });

  test('uses the broad-availability gate for comparable mortgage rates', () => {
    const selected = row({ product_key: 'selected|loan', rate: '0.05' });
    const open = row({ product_key: 'open|loan', provider: 'Open Bank', rate: '0.051' });
    const staff = row({ product_key: 'staff|loan', product_name: 'Staff Home Loan', rate: '0.01' });
    const firstHomeOnly = row({ product_key: 'gated|loan', product_name: 'Variable Home Loan', rate: '0.02' });
    const receipt = buildRateReceipt({
      row: selected,
      section: 'Mortgage',
      evidenceDate: '2026-08-04',
    });
    const brief = buildNegotiationBrief({
      receipt,
      scenario: EMPTY_USER_RATE_SCENARIO,
      sectionRows: [selected, open, staff, firstHomeOnly],
      detailsProducts: {
        [firstHomeOnly.product_key]: {
          eligibility: [{ info: 'This loan is only available for first home buyers' }],
        },
      },
    });

    expect(brief.comparables.map((item) => item.productKey)).toEqual([open.product_key]);
    expect(brief.cohortSummary).toMatch(/^2 comparable/);
  });

  test('does not call bonus or introductory savings tiers broadly available', () => {
    const selected = row({
      product_key: 'selected|save',
      comparison_rate: undefined,
      ribbon_deposit_kind: 'base',
      rate: '0.04',
    });
    const open = row({
      product_key: 'open|save',
      comparison_rate: undefined,
      ribbon_deposit_kind: 'base',
      rate: '0.041',
    });
    const bonus = row({
      product_key: 'bonus|save',
      comparison_rate: undefined,
      ribbon_deposit_kind: 'bonus',
      rate_type: 'BONUS',
      ongoing_rate: '0.01',
      rate: '0.06',
    });
    const receipt = buildRateReceipt({ row: selected, section: 'Savings', evidenceDate: '2026-08-04' });
    const brief = buildNegotiationBrief({
      receipt,
      scenario: EMPTY_USER_RATE_SCENARIO,
      sectionRows: [selected, open, bonus],
    });

    expect(brief.comparables.map((item) => item.productKey)).toEqual([open.product_key]);
    expect(brief.cohortSummary).toMatch(/^2 comparable/);
  });
});
