import { mortgageComparisonScenario } from '../src/data/mortgageComparisonScenario';

test('comparison amount and percentage LVR override saved pricing assumptions without changing them', () => {
  const saved = { amount: '100000', lvr: '0.9', purpose: 'OWNER_OCCUPIED' };
  expect(mortgageComparisonScenario('Mortgage', saved, { loanAmount: '$600,000', lvr: '75%' }))
    .toEqual({ ...saved, amount: '600000', lvr: '0.75' });
  expect(saved).toEqual({ amount: '100000', lvr: '0.9', purpose: 'OWNER_OCCUPIED' });
  expect(mortgageComparisonScenario('Mortgage', saved, { loanAmount: '', lvr: '' })).toEqual(saved);
  expect(mortgageComparisonScenario('Savings', saved, { loanAmount: '600000', lvr: '75' })).toBe(saved);
});

test.each([
  { loanAmount: '-1', lvr: '101' }, { loanAmount: '0', lvr: '0' },
  { loanAmount: '100000001', lvr: 'private' },
])('invalid comparison inputs never reuse stale saved bounds: %p', inputs => {
  expect(mortgageComparisonScenario('Mortgage', { amount: '100000', lvr: '0.9' }, inputs))
    .toEqual({ amount: undefined, lvr: undefined });
});

test('temporary purpose and repayment canonicalize before pricing without changing saved requirements or assumptions', () => {
  const saved = { purpose: 'OWNER_OCCUPIED', repayment: 'PRINCIPAL_AND_INTEREST', amount: '500000' };
  const filters = { loanPurposes: ['INV'], repaymentTypes: ['IO'] };
  const before = JSON.stringify([saved, filters]);
  expect(mortgageComparisonScenario('Mortgage', saved, { loanAmount: '', lvr: '' }, filters)).toEqual({
    ...saved, purpose: 'INVESTMENT', repayment: 'INTEREST_ONLY', profileLoanPurpose: 'INV', profileRepayment: 'IO' });
  expect(JSON.stringify([saved, filters])).toBe(before);
  expect(mortgageComparisonScenario('Mortgage', saved, { loanAmount: '', lvr: '' }, { loanPurposes: [], repaymentTypes: [] })).toEqual(saved);
  expect(mortgageComparisonScenario('Mortgage', saved, { loanAmount: '', lvr: '' }, { loanPurposes: ['OO', 'INV'], repaymentTypes: [] }).purpose).toBeUndefined();
});

test('duplicate aliases remain one semantic purpose and repayment choice', () => {
  const filters = { loanPurposes: ['OO', 'OWNER_OCCUPIED'], repaymentTypes: ['PI', 'P&I'] };
  const result = mortgageComparisonScenario('Mortgage', {}, { loanAmount: '', lvr: '' }, filters);
  expect(result).toMatchObject({ purpose: 'OWNER_OCCUPIED', repayment: 'PRINCIPAL_AND_INTEREST' });
  expect(filters).toEqual({ loanPurposes: ['OO', 'OWNER_OCCUPIED'], repaymentTypes: ['PI', 'P&I'] });
});
