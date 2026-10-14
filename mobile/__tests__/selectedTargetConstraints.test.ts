import { normalizeUserRateScenario } from '../src/data/userRateScenario';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import { EMPTY_PROFILE } from '../src/data/profile';
import { selectedTargetConstraint, targetConstraintContradicted } from '../src/lib/selectedTargetConstraints';
import { resolveCalculationTarget, selectedDepositCalculation } from '../src/lib/calculationTarget';
import { scopedRateConditions } from '../src/data/rateConditions';
import type { RateRow } from '../src/types';
import { selectedConstraintFixture } from '../testUtils/selectedTargetConstraints';

const loan: RateRow = { provider: 'Bank', product_key: 'loan', product_name: 'Selected loan', rate_index: 4,
  rate: '0.0579', lvr_tier: 'lvr_=60%', account_class: 'standard' };
const deposit: RateRow = { provider: 'Bank', product_key: 'deposit', product_name: 'Base saver', rate_index: 7,
  rate: '0.06', ribbon_deposit_kind: 'base', account_class: 'standard', balance_min: '1000', balance_max: '10000' };
const mortgageScenario = (balance = '450000') => normalizeUserRateScenario({ mortgage: {
  mode: 'refi', propertyValue: '500000', loanBalance: balance, currentRate: '8', years: '25',
} });
const depositScenario = (balance: string, rate = '3') => normalizeUserRateScenario({
  savings: { balance, currentRate: rate }, termDeposit: { balance, currentRate: rate },
});
afterEach(() => installMandatoryEligibility(selectMandatoryEligibility(null, EMPTY_PROFILE, null)));

test('known outside mortgage keeps exact identity ready while contradicting monetary admission', () => {
  const f = selectedConstraintFixture('Mortgage', [loan, { ...loan, rate_index: 5, lvr_tier: 'lvr_85-90%' }],
    [{ rateIndex: 4, text: 'LVR up to 59.99%.' }, { rateIndex: 5, text: 'For LVR 60% to 79.99%.' }]);
  const target = resolveCalculationTarget(f.core, 'Mortgage', { target: loan.product_key, ri: '4' });
  expect(target).toEqual({ status: 'available', section: 'Mortgage', row: f.rows[0] });
  expect(selectedTargetConstraint(f.rows[0], 'Mortgage', mortgageScenario(), f)).toEqual({
    status: 'outside-lvr', basis: 'source-condition', eligibility: 'unverified',
  });
  expect(target.status === 'available' && target.row.rate_index).toBe(4);
});

test('listed upper mortgage boundary is inclusive but no eligibility is approved', () => {
  expect(selectedTargetConstraint(loan, 'Mortgage', mortgageScenario('300000'))).toEqual({
    status: 'not-contradicted', basis: 'listed-tier', eligibility: 'unverified',
  });
  expect(targetConstraintContradicted(selectedTargetConstraint(loan, 'Mortgage', mortgageScenario()))).toBe(true);
});

test('Maitland-like source ranges win normalized core disagreement and preserve the 60% boundary', () => {
  const f = selectedConstraintFixture('Mortgage', [loan, { ...loan, rate_index: 5 }],
    [{ rateIndex: 4, text: 'LVR up to 59.99%.' }, { rateIndex: 5, text: 'For LVR 60% to 79.99%.' }]);
  expect(scopedRateConditions(f.rows[1], 'Mortgage', f).entries[0].rateIndex).toBe(5);
  expect(selectedTargetConstraint(f.rows[1], 'Mortgage', mortgageScenario('350000'), f)).toEqual({
    status: 'not-contradicted', basis: 'source-condition', eligibility: 'unverified',
  });
  expect(selectedTargetConstraint(f.rows[0], 'Mortgage', mortgageScenario('300000'), f).status).toBe('outside-lvr');
  expect(selectedTargetConstraint(f.rows[1], 'Mortgage', mortgageScenario('300000'), f).status).toBe('not-contradicted');
});

test('stale or cloned source evidence is never treated as admitted source bounds', () => {
  const f = selectedConstraintFixture('Mortgage', [loan], [{ rateIndex: 4, text: 'For LVR 60% to 79.99%.' }]);
  const scenario = mortgageScenario('350000');
  expect(selectedTargetConstraint({ ...f.rows[0] }, 'Mortgage', scenario, f).basis).toBe('listed-tier');
  f.details.run_date = '2026-10-13';
  expect(selectedTargetConstraint(f.rows[0], 'Mortgage', scenario, f).basis).toBe('listed-tier');
});

test('admitted unparsed qualifications stay unverified instead of trusting a conflicting normalized tier', () => {
  const f = selectedConstraintFixture('Mortgage', [loan], [{ rateIndex: 4, text: 'Special LVR rules apply for eligible staff.' }]);
  expect(selectedTargetConstraint(f.rows[0], 'Mortgage', mortgageScenario(), f)).toEqual({
    status: 'unverified', basis: 'source-condition', eligibility: 'unverified',
  });
});

test.each(['500', '50000'])('outside selected deposit amount %s has rate only and null dollars', balance => {
  const before = JSON.stringify(deposit);
  const result = selectedDepositCalculation(deposit, 'Savings', depositScenario(balance));
  expect(result).toMatchObject({ status: 'rate-only', targetRate: 0.06, difference: null,
    constraint: { status: 'outside-balance', basis: 'listed-tier', eligibility: 'unverified' } });
  expect(JSON.stringify(deposit)).toBe(before);
});

test.each(['1000', '10000'])('selected deposit boundary %s remains a hypothetical comparison', balance => {
  const result = selectedDepositCalculation(deposit, 'Savings', depositScenario(balance));
  expect(result.status).toBe('ready'); expect(result.difference).toBe(Number(balance) * 0.03);
  expect(result.constraint).toEqual({ status: 'not-contradicted', basis: 'listed-tier', eligibility: 'unverified' });
});

test('a supported worse selected deposit keeps its negative difference and exact tier', () => {
  const row = { ...deposit, rate: '0.03' };
  const scenario = depositScenario('5000', '5'), before = JSON.stringify(scenario);
  const result = selectedDepositCalculation(row, 'Savings', scenario);
  expect(result).toMatchObject({ status: 'ready', targetRate: 0.03 });
  expect(result.difference).toBeCloseTo(-100, 8);
  expect(row.rate_index).toBe(7); expect(JSON.stringify(scenario)).toBe(before);
});

test('admitted source balance limits override conflicting normalized deposit bounds', () => {
  const f = selectedConstraintFixture('Savings', [{ ...deposit, balance_max: '1000' }],
    [{ rateIndex: 7, text: 'Deposit balance up to $10000.' }]);
  expect(selectedDepositCalculation(f.rows[0], 'Savings', depositScenario('5000'), f)).toMatchObject({
    status: 'ready', difference: 150, constraint: { status: 'not-contradicted', basis: 'source-condition' },
  });
  expect(selectedDepositCalculation(f.rows[0], 'Savings', depositScenario('50000'), f)).toMatchObject({
    status: 'rate-only', difference: null, constraint: { status: 'outside-balance', basis: 'source-condition' },
  });
});

test('unknown or malformed bounds never become a guessed eligibility verdict', () => {
  const scenario = depositScenario('5000');
  for (const row of [{ ...deposit, balance_min: undefined, balance_max: undefined }, { ...deposit, balance_max: 'unknown' }]) {
    expect(selectedDepositCalculation(row, 'Savings', scenario).constraint).toEqual({ status: 'unverified', basis: 'unknown', eligibility: 'unverified' });
  }
  expect(selectedTargetConstraint({ ...loan, lvr_tier: 'lvr_unspecified' }, 'Mortgage', mortgageScenario()).status).toBe('unverified');
});

test('outside selected term-deposit bound suppresses maturity dollars without inventing another term', () => {
  const row = { ...deposit, term: 'P6M' };
  expect(selectedDepositCalculation(row, 'TD', depositScenario('50000'))).toMatchObject({
    status: 'rate-only', targetRate: 0.06, months: 6, basis: 'published-maturity', difference: null,
    constraint: { status: 'outside-balance' },
  });
});
