import {
  advertisedTermMonths,
  calculatorAmount,
  calculatorRateFraction,
  calculatorYears,
  computeLvr,
  depositToReachLvr,
  EMPTY_CALC,
  fixedRateProjectionMonths,
  isPublishedFixedRate,
  MAX_CALCULATOR_DEPOSIT_AMOUNT,
  normalizeCalcInputs,
  quickEstimateUnavailableReason,
  termDepositInterestDifference,
} from '../src/data/calc';

describe('computeLvr (buying)', () => {
  it('derives loan and LVR from price, deposit and costs', () => {
    const r = computeLvr({ ...EMPTY_CALC, mode: 'buy', propertyValue: '650000', deposit: '130000', costs: '30000' });
    // deposit applied = 130k - 30k costs = 100k → loan 550k → LVR 84.6%
    expect(r.depositApplied).toBe(100000);
    expect(r.loan).toBe(550000);
    expect(r.lvr).toBeCloseTo(84.615, 2);
  });

  it('returns nulls until enough is entered', () => {
    expect(computeLvr({ ...EMPTY_CALC, propertyValue: '', deposit: '100000' }).lvr).toBeNull();
  });

  it.each(['-650000', '650000oops', '650.000.00'])(
    'rejects malformed property input %s instead of stripping it into a claim',
    (propertyValue) => {
      expect(computeLvr({ ...EMPTY_CALC, propertyValue, deposit: '100000' })).toMatchObject({
        loan: null,
        lvr: null,
      });
    },
  );
});

describe('computeLvr (refinancing)', () => {
  it('uses current loan balance over property value', () => {
    const r = computeLvr({ ...EMPTY_CALC, mode: 'refi', propertyValue: '800000', loanBalance: '600000' });
    expect(r.lvr).toBeCloseTo(75, 5);
    expect(r.loan).toBe(600000);
  });
});

describe('depositToReachLvr', () => {
  it('computes the extra deposit to drop into a lower band', () => {
    // 650k property, 100k applied (LVR 84.6%). To reach ≤80% need 130k → extra 30k.
    expect(depositToReachLvr(650000, 100000, 80)).toBeCloseTo(30000, 2);
    expect(depositToReachLvr(650000, 200000, 80)).toBe(0); // already below
  });
});

describe('normalizeCalcInputs', () => {
  it('coerces partial/garbage input to a safe shape', () => {
    expect(normalizeCalcInputs(null)).toEqual(EMPTY_CALC);
    expect(normalizeCalcInputs({ mode: 'refi', propertyValue: 5 as unknown as string }).mode).toBe('refi');
    expect(normalizeCalcInputs({ mode: 'weird' as never }).mode).toBe('buy');
  });
});

describe('financial projection periods', () => {
  it('limits a fixed mortgage projection to the published fixed period', () => {
    expect(advertisedTermMonths({ term: 'P2Y' })).toBe(24);
    expect(fixedRateProjectionMonths(300, 24)).toBe(24);
    expect(fixedRateProjectionMonths(12, 24)).toBe(12);
  });

  it('recognizes fixed mortgage variants from either authenticated field', () => {
    expect(isPublishedFixedRate({ rate_type: 'Fixed - owner occupied' })).toBe(true);
    expect(isPublishedFixedRate({ ribbon_rate_structure: 'FIXED' })).toBe(true);
    expect(isPublishedFixedRate({ rate_type: 'VARIABLE', ribbon_rate_structure: 'variable' })).toBe(false);
  });

  it('projects a term deposit only to maturity', () => {
    expect(termDepositInterestDifference(100_000, 0.04, 0.05, 6)).toBeCloseTo(500);
    expect(advertisedTermMonths({ term_months: 9 })).toBe(9);
  });
});

describe('bounded quick-calculator inputs', () => {
  it('accepts formatted bounded amounts without coercing malformed or negative text', () => {
    expect(calculatorAmount('$1,250,000.50', 2_000_000)).toBe(1_250_000.5);
    expect(calculatorAmount('-1000', 2_000_000)).toBeNull();
    expect(calculatorAmount('1000oops', 2_000_000)).toBeNull();
    expect(calculatorAmount(String(MAX_CALCULATOR_DEPOSIT_AMOUNT + 1), MAX_CALCULATOR_DEPOSIT_AMOUNT)).toBeNull();
  });

  it('requires explicit bounded rates and mortgage years', () => {
    expect(calculatorRateFraction('6.25%')).toBe(0.0625);
    expect(calculatorRateFraction('101')).toBeNull();
    expect(calculatorRateFraction('-2')).toBeNull();
    expect(calculatorYears('25')).toBe(25);
    expect(calculatorYears('')).toBeNull();
    expect(calculatorYears('51')).toBeNull();
  });

  it('withholds dollars for unknown TD maturity and conditional deposit rates', () => {
    const td = {
      provider: 'Bank', product_key: 'td', product_name: 'TD', rate: '0.05', account_class: 'standard',
    };
    expect(quickEstimateUnavailableReason(td, 'TD')).toContain('maturity term');
    expect(quickEstimateUnavailableReason({ ...td, term: 'P6M' }, 'TD')).toBeNull();
    expect(quickEstimateUnavailableReason({
      ...td,
      product_key: 'savings-base',
      product_name: 'Base saver',
      ribbon_deposit_kind: 'base',
    }, 'Savings')).toBeNull();
    expect(quickEstimateUnavailableReason({
      ...td,
      product_key: 'savings-unknown',
      product_name: 'Unclassified saver',
    }, 'Savings')).toContain('conditions');
    expect(quickEstimateUnavailableReason({
      ...td,
      ribbon_deposit_kind: 'bonus',
      exact_alert_eligible: false,
    }, 'Savings')).toContain('conditions');
  });
});
