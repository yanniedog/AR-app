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
