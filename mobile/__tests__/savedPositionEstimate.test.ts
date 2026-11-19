import { savedPositionEstimate, type RatePosition } from '../src/lib/savedPositionEstimate';
import { normalizeUserRateScenario } from '../src/data/userRateScenario';
import type { RateRow } from '../src/types';

const standard: RateRow = { provider: 'Bank', product_key: 'B|S', product_name: 'Saver', rate: '0.05', account_class: 'standard', ribbon_deposit_kind: 'base' };
const savings = (row: RateRow): RatePosition => ({ section: 'Savings', currentRate: 0.03, matchedRate: 0.05, matchedRow: row, gapRate: 0.02, ready: true });

test('savings dollars require the held-rate assumption', () => {
  const scenario = normalizeUserRateScenario({ savings: { balance: '10000', currentRate: '3' } });
  expect(savedPositionEstimate(savings(standard), scenario)).toEqual({ unavailable: true, text: 'Rate assumption missing' });
  scenario.projections.savings.holdVariableRate = true;
  expect(savedPositionEstimate(savings(standard), scenario)).toEqual({ unavailable: false, text: '$200 / yr' });
});

test('bonus or non-standard matches never produce a dollar figure', () => {
  const scenario = normalizeUserRateScenario({ savings: { balance: '10000', currentRate: '3' } });
  scenario.projections.savings.holdVariableRate = true;
  for (const row of [{ ...standard, ribbon_deposit_kind: 'bonus' }, { ...standard, account_class: 'non-standard' }]) {
    expect(savedPositionEstimate(savings(row), scenario)).toEqual({ unavailable: true, text: 'Eligibility / rate conditions unverified' });
  }
});

test('mortgage positions give monthly and yearly repayment gaps from the scenario loan', () => {
  const scenario = normalizeUserRateScenario({ mortgage: { mode: 'refi', propertyValue: '800000', loanBalance: '500000', years: '25' } });
  const result = savedPositionEstimate({ section: 'Mortgage', currentRate: 0.065, matchedRate: 0.055, matchedRow: null, gapRate: 0.01, ready: true }, scenario);
  expect(result?.unavailable).toBe(false);
  expect(result?.text).toMatch(/^\$\d[\d,]* \/ mo · \$[\d,]+ \/ yr$/);
});
