import { buildStaySwitchProjection, extractPublishedSwitchFees, resolveSwitchCosts } from '../src/data/staySwitchProjection';
import { normalizeUserRateScenario } from '../src/data/userRateScenario';
import type { ProductDetail, RateRow } from '../src/types';

const NOW = new Date('2026-08-13T10:00:00Z');
const TARGET: RateRow = {
  provider: 'Target Bank',
  product_key: 'target-loan',
  product_name: 'Target Variable',
  rate: '0.05',
  comparison_rate: '0.0575',
  rate_index: 2,
};
const OFFSET_DETAIL: ProductDetail = { features: [{ label: 'OFFSET', info: '100% offset' }] };

function scenario() {
  return normalizeUserRateScenario({
    mortgage: { mode: 'refi', loanBalance: '500000', currentRate: '6', years: '25' },
    projections: {
      mortgage: {
        offsetBalance: '30000',
        offsetContributionAmount: '500',
        offsetContributionFrequency: 'monthly',
        extraRepaymentAmount: '200',
        extraRepaymentFrequency: 'monthly',
      },
    },
  });
}

describe('published switch fee extraction', () => {
  it('uses numeric CDR exit and upfront evidence while leaving unpriced rows out', () => {
    const current: ProductDetail = { fees: [
      { label: 'EXIT', name: 'Discharge administration fee', value: '350.00' },
      { label: 'EVENT', name: 'Break cost', info: 'Amount provided on request' },
    ] };
    const target: ProductDetail = { fees: [
      { label: 'UPFRONT', name: 'Application fee', value: '600' },
      { label: 'UPFRONT', name: 'Valuation fee', info: 'At cost' },
      { label: 'UPFRONT', name: 'Establishment fee', value: '299', info: 'Currently waived' },
    ] };
    expect(extractPublishedSwitchFees(current, target)).toEqual([
      expect.objectContaining({ key: 'currentBankExitFees', amount: 350 }),
      expect.objectContaining({ key: 'applicationFees', amount: 600 }),
      expect.objectContaining({ key: 'applicationFees', amount: 0 }),
    ]);
  });

  it('lets entered values override published categories and only prices periodic fees with cadence', () => {
    const value = scenario();
    value.mortgageSwitch.applicationFees = '125';
    value.mortgageSwitch.cashback = '500';
    value.mortgageSwitch.fundingMethod = 'new-loan';
    const costs = resolveSwitchCosts(value.mortgageSwitch, null, { fees: [
      { label: 'UPFRONT', name: 'Application fee', value: '600' },
      { label: 'PERIODIC', name: 'Package fee $120 annually' },
      { label: 'PERIODIC', name: 'Monthly admin fee', value: 'P1M' },
    ] });
    expect(costs.fees.find((fee) => fee.key === 'applicationFees')).toEqual(expect.objectContaining({ amount: 125, source: 'entered' }));
    expect(costs.targetPeriodicFeesMonthly).toBe(10);
    expect(costs.unpricedPeriodicFees).toEqual(['Target product: Monthly admin fee']);
    expect(costs.netSwitchCost).toBe(-375);
    expect(costs.financedAmount).toBe(0);
  });

  it('prices a periodic fee from its structured CDR accrual frequency', () => {
    const costs = resolveSwitchCosts(scenario().mortgageSwitch, null, { fees: [
      {
        label: 'PERIODIC',
        name: 'Account service fee',
        fixedAmount: { amount: '12' },
        amountStatus: 'fixed',
        accrualFrequency: 'P1M',
      },
    ] });
    expect(costs.targetPeriodicFeesMonthly).toBe(12);
    expect(costs.unpricedPeriodicFees).toEqual([]);
  });

  it('prefers rich fixed amounts and rejects variable-method zero placeholders', () => {
    const target = { fees: [
      {
        label: 'UPFRONT',
        name: 'Establishment fee',
        amountStatus: 'fixed',
        amount: '425.00',
        currency: 'AUD',
        value: 'legacy ignored',
      },
      {
        label: 'UPFRONT',
        name: 'Variable valuation fee',
        amountStatus: 'variable',
        amount: '0.00',
      },
      {
        label: 'PERIODIC',
        name: 'Package fee',
        feeMethodUType: 'FIXED_AMOUNT',
        fixedAmount: { amount: '8', currency: 'AUD' },
        additionalValue: 'P1M',
      },
      {
        label: 'PERIODIC',
        name: 'Rate based service fee',
        feeMethodUType: 'VARIABLE',
        fixedAmount: { amount: '0.00', currency: 'AUD' },
        additionalValue: 'P1M',
      },
    ] } as unknown as ProductDetail;
    const costs = resolveSwitchCosts(scenario().mortgageSwitch, null, target);
    expect(costs.fees.find((fee) => fee.key === 'applicationFees')).toEqual(expect.objectContaining({ amount: 425 }));
    expect(costs.fees.find((fee) => fee.key === 'valuationFees')?.source).toBe('missing');
    expect(costs.targetPeriodicFeesMonthly).toBe(8);
    expect(costs.unpricedPeriodicFees).toContain('Target product: Rate based service fee');
  });
});

describe('stay versus switch projection', () => {
  it.each([
    ['0.50', 0.005],
    ['1', 0.01],
    ['0', 0],
  ])('parses entered current rate %s as a percentage', (input, expected) => {
    const value = scenario();
    value.mortgage.currentRate = input;
    const result = buildStaySwitchProjection({ scenario: value, target: TARGET, targetDetail: OFFSET_DETAIL, now: NOW });
    expect(result.ready).toBe(true);
    expect(result.stay?.advertisedRate).toBe(expected);
  });

  it('uses advertised target rate, never comparison rate, and moves repayment saving into offset', () => {
    const result = buildStaySwitchProjection({ scenario: scenario(), target: TARGET, targetDetail: OFFSET_DETAIL, now: NOW });
    expect(result.ready).toBe(true);
    expect(result.switching?.advertisedRate).toBe(0.05);
    expect(result.switching?.advertisedRate).not.toBe(0.0575);
    expect(result.switching!.requiredRepayment).toBeLessThan(result.stay!.requiredRepayment);
    expect(result.switching!.offsetContribution).toBeGreaterThan(500);
    expect(result.switching!.principalPayment + result.switching!.offsetContribution)
      .toBeCloseTo(result.householdAllocation, 8);
    expect(result.points.some((point) => point.switchOffset > point.switchBalance)).toBe(true);
    expect(result.switching!.effectiveDebtFreeDate).toMatch(/^20\d\d-\d\d-\d\d$/);
    expect(result.switching!.contractualPayoffDate).toMatch(/^20\d\d-\d\d-\d\d$/);
    expect(result.totalInterestSaving).toBeGreaterThan(0);
  });

  it('sends spare allocation to principal when no target offset is published', () => {
    const result = buildStaySwitchProjection({ scenario: scenario(), target: TARGET, targetDetail: {}, now: NOW });
    expect(result.targetHasOffset).toBe(false);
    expect(result.switching!.offsetContribution).toBe(0);
    expect(result.switching!.principalPayment).toBeCloseTo(result.householdAllocation, 8);
    expect(result.switching!.openingBalance).toBe(470000);
    expect(result.points[0].switchNetDebt).toBe(result.points[0].stayNetDebt);
    expect(result.warnings.join(' ')).toMatch(/no target offset feature/i);
  });

  it('distinguishes unavailable target details from published no-offset evidence', () => {
    const result = buildStaySwitchProjection({ scenario: scenario(), target: TARGET, targetDetail: undefined, now: NOW });
    expect(result.offsetEvidence).toBe('unavailable');
    expect(result.targetHasOffset).toBe(false);
    expect(result.warnings.join(' ')).toMatch(/details are unavailable/i);
  });

  it('reads target offset support from normalized facts', () => {
    const result = buildStaySwitchProjection({
      scenario: scenario(),
      target: TARGET,
      targetDetail: {
        facts: [{
          id: 'offset', kind: 'feature', canonicalKey: 'feature.offset',
          sourceType: 'OFFSET', value: true, unit: 'boolean',
        }],
      },
      now: NOW,
    });
    expect(result.targetHasOffset).toBe(true);
    expect(result.offsetEvidence).toBe('published');
    expect(result.switching!.openingBalance).toBe(500000);
    expect(result.points[0].switchOffset).toBe(30000);
  });

  it('reduces opening offset for cash-funded costs and increases principal for loan-funded costs', () => {
    const cash = scenario();
    cash.mortgageSwitch.applicationFees = '2000';
    const cashResult = buildStaySwitchProjection({ scenario: cash, target: TARGET, targetDetail: OFFSET_DETAIL, now: NOW });
    expect(cashResult.points[0].switchOffset).toBe(28000);
    expect(cashResult.switching!.openingBalance).toBe(500000);

    const financed = scenario();
    financed.mortgageSwitch.applicationFees = '2000';
    financed.mortgageSwitch.fundingMethod = 'new-loan';
    const financedResult = buildStaySwitchProjection({ scenario: financed, target: TARGET, targetDetail: OFFSET_DETAIL, now: NOW });
    expect(financedResult.points[0].switchOffset).toBe(30000);
    expect(financedResult.switching!.openingBalance).toBe(502000);
  });

  it('discloses and funds a contractual target-payment shortfall instead of claiming a fixed allocation', () => {
    const worseTarget = { ...TARGET, rate: '0.09' };
    const result = buildStaySwitchProjection({ scenario: scenario(), target: worseTarget, targetDetail: OFFSET_DETAIL, now: NOW });
    expect(result.targetAllocationShortfall).toBeGreaterThan(0);
    expect(result.switching!.totalMonthlyAllocation).toBe(result.switching!.requiredRepayment);
    expect(result.warnings.join(' ')).toMatch(/above the current household allocation/i);
    expect(result.assumptions.join(' ')).toMatch(/baseline allocation/i);
  });

  it('includes priced periodic fees in break-even and total cost', () => {
    const noFee = buildStaySwitchProjection({ scenario: scenario(), target: TARGET, targetDetail: OFFSET_DETAIL, now: NOW });
    const withFee = buildStaySwitchProjection({
      scenario: scenario(),
      target: TARGET,
      targetDetail: {
        ...OFFSET_DETAIL,
        fees: [{ label: 'PERIODIC', name: 'Package fee $120 annually' }],
      },
      now: NOW,
    });
    expect(withFee.fees.targetPeriodicFeesMonthly).toBe(10);
    expect(withFee.switching!.totalCost).toBeGreaterThan(noFee.switching!.totalCost);
    expect(withFee.totalCostSaving).toBeLessThan(noFee.totalCostSaving);
  });

  it('includes reliably priced current-product periodic fees on the stay path', () => {
    const currentDetail: ProductDetail = {
      fees: [{ label: 'PERIODIC', name: 'Current package fee', value: '120', info: 'per year' }],
    };
    const withoutCurrentFee = buildStaySwitchProjection({ scenario: scenario(), target: TARGET, targetDetail: OFFSET_DETAIL, now: NOW });
    const withCurrentFee = buildStaySwitchProjection({
      scenario: scenario(),
      target: TARGET,
      currentDetail,
      targetDetail: OFFSET_DETAIL,
      now: NOW,
    });
    expect(withCurrentFee.fees.currentPeriodicFeesMonthly).toBe(10);
    expect(withCurrentFee.stay!.totalCost).toBeGreaterThan(withoutCurrentFee.stay!.totalCost);
    expect(withCurrentFee.totalCostSaving).toBeGreaterThan(withoutCurrentFee.totalCostSaving);
  });

  it('does not report break-even for a zero-cost losing switch', () => {
    const result = buildStaySwitchProjection({
      scenario: scenario(),
      target: { ...TARGET, rate: '0.09' },
      targetDetail: OFFSET_DETAIL,
      now: NOW,
    });
    expect(result.fees.netSwitchCost).toBe(0);
    expect(result.points.at(-1)!.cumulativeSaving).toBeLessThan(0);
    expect(result.breakEvenDate).toBeNull();
  });

  it('stops each periodic fee when that loan is contractually repaid', () => {
    const short = scenario();
    short.mortgage.loanBalance = '10000';
    short.mortgage.currentRate = '12';
    short.mortgage.years = '2';
    short.projections.mortgage.offsetBalance = '0';
    short.projections.mortgage.offsetContributionAmount = '0';
    short.projections.mortgage.extraRepaymentAmount = '0';
    const result = buildStaySwitchProjection({
      scenario: short,
      target: { ...TARGET, rate: '0.01' },
      targetDetail: { fees: [{ label: 'PERIODIC', name: 'Monthly fee', value: '10', info: 'per month' }] },
      now: NOW,
    });
    const payoffPoint = result.points.findIndex((point) => point.date === result.switching!.contractualPayoffDate);
    expect(payoffPoint).toBeGreaterThan(0);
    expect(payoffPoint).toBeLessThan(result.points.length - 1);
    expect(result.switching!.totalCost - result.switching!.totalInterest - result.fees.netSwitchCost)
      .toBeCloseTo(result.fees.targetPeriodicFeesMonthly * payoffPoint, 8);
  });

  it('stops exact fixed-product comparisons at the published period without inventing reversion', () => {
    const fixed: RateRow = { ...TARGET, rate_type: 'FIXED', term: 'P2Y' };
    const result = buildStaySwitchProjection({ scenario: scenario(), target: fixed, targetDetail: OFFSET_DETAIL, now: NOW });
    expect(result.ready).toBe(true);
    expect(result.projectionScope).toBe('published-fixed-period');
    expect(result.points).toHaveLength(25);
    expect(result.switching!.contractualPayoffDate).toBeNull();
    expect(result.warnings.join(' ')).toMatch(/no unknown reversion rate/i);
  });

  it.each([
    ['periodicAmount', '-1'],
    ['extraRepaymentAmount', 'not an amount'],
    ['offsetContributionAmount', '1000000000001'],
    ['offsetBalance', '-100'],
  ] as const)('rejects invalid projection input %s', (field, value) => {
    const invalid = scenario();
    invalid.projections.mortgage[field] = value;
    const result = buildStaySwitchProjection({ scenario: invalid, target: TARGET, targetDetail: OFFSET_DETAIL, now: NOW });
    expect(result.ready).toBe(false);
    expect(result.missing.join(' ')).toMatch(/from \$0 to \$1 trillion/i);
  });
});
