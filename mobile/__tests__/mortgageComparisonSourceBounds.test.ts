import { mortgageComparisonMatch, mortgageComparisonRows } from '../src/data/mortgageComparison';
import { scopedRateConditions } from '../src/data/rateConditions';
import { selectedConstraintFixture } from '../testUtils/selectedTargetConstraints';
import type { RateRow } from '../src/types';
const row: RateRow = { product_key: 'loan', provider: 'Bank', product_name: 'Loan', rate_index: 4,
  rate: '0.05', lvr_tier: 'lvr_=80%', balance_min: 100000, balance_max: 900000 };

test('verified source LVR overrides a conflicting normalized tier with exact inclusive/exclusive edges', () => {
  const f = selectedConstraintFixture('Mortgage', [row], [{ rateIndex: 4, text: 'LVR up to 70%.' }]);
  expect(scopedRateConditions(f.rows[0], 'Mortgage', f).status).toBe('available');
  expect(mortgageComparisonMatch(f.rows[0], { loanAmount: '', lvr: '75' }, f)).toBe('outside');
  expect(mortgageComparisonMatch(f.rows[0], { loanAmount: '', lvr: '70' }, f)).toBe('listed');
  expect(mortgageComparisonRows(f.rows, { loanAmount: '', lvr: '75' }, f).rows).toEqual([]);
  const exclusive = selectedConstraintFixture('Mortgage', [row], [{ rateIndex: 4, text: 'LVR below 70%.' }]);
  expect(mortgageComparisonMatch(exclusive.rows[0], { loanAmount: '', lvr: '70' }, exclusive)).toBe('outside');
});
test('admitted loan amount limits override normalized bounds and preserve open upper edges', () => {
  const f = selectedConstraintFixture('Mortgage', [row], [{ rateIndex: 4, text: 'Loan amount below $500000.' }]);
  expect(mortgageComparisonMatch(f.rows[0], { loanAmount: '500000', lvr: '' }, f)).toBe('outside');
  expect(mortgageComparisonMatch(f.rows[0], { loanAmount: '499999.99', lvr: '' }, f)).toBe('listed');
  const wider = selectedConstraintFixture('Mortgage', [row], [{ rateIndex: 4, text: 'Borrowing amount up to $1000000.' }]);
  expect(mortgageComparisonMatch(wider.rows[0], { loanAmount: '950000', lvr: '' }, wider)).toBe('listed');
});
test('qualified or unresolved source conditions remain visible only as unverified comparison matches', () => {
  const f = selectedConstraintFixture('Mortgage', [row], [{ rateIndex: 4, text: 'LVR up to 70%.' },
    { rateIndex: 4, text: 'LVR up to 90% for eligible staff.', sourcePointer: '/data/lendingRates/3/applicabilityConditions/0/additionalInfo' }]);
  const original = JSON.stringify(f.rows);
  for (const lvr of ['65', '75']) {
    expect(mortgageComparisonMatch(f.rows[0], { loanAmount: '', lvr }, f)).toBe('unverified');
    const result = mortgageComparisonRows(f.rows, { loanAmount: '', lvr }, f);
    expect(result.rows).toEqual(f.rows); expect(result.unverified).toBe(1); expect(result.unverifiedRows.has(f.rows[0])).toBe(true);
  }
  expect(JSON.stringify(f.rows)).toBe(original);
});
test('independent exact ranges are alternatives and stale or cloned source context cannot supply exact bounds', () => {
  const f = selectedConstraintFixture('Mortgage', [row], [{ rateIndex: 4, text: 'LVR up to 70%.' },
    { rateIndex: 4, text: 'LVR 75% to 80%.', sourcePointer: '/data/lendingRates/3/applicabilityConditions/0/additionalInfo' }]);
  expect(mortgageComparisonMatch(f.rows[0], { loanAmount: '', lvr: '78' }, f)).toBe('listed');
  expect(mortgageComparisonMatch(f.rows[0], { loanAmount: '', lvr: '73' }, f)).toBe('outside');
  expect(mortgageComparisonMatch({ ...f.rows[0] }, { loanAmount: '', lvr: '73' }, f)).toBe('listed');
  f.details.run_date = '2026-10-13';
  expect(mortgageComparisonMatch(f.rows[0], { loanAmount: '', lvr: '73' }, f)).toBe('listed');
});
