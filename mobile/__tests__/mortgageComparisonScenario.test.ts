import { mortgageComparisonScenario } from '../src/data/mortgageComparisonScenario';
import { matchesMortgageFacet, scopeMortgageFacets } from '../src/data/mortgageFacets';

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

test.each([
  { loanAmount: '600000', lvr: '' },
  { loanAmount: '600000', lvr: ' ', lvrMode: 'lvr' as const },
  { loanAmount: '', lvr: '', lvrMode: 'lvr' as const },
])('blank active direct LVR cannot inherit a saved pricing ratio: %p', inputs => {
  const saved = { amount: '100000', lvr: '0.75' };
  const result = mortgageComparisonScenario('Mortgage', saved, inputs);
  expect(Object.hasOwn(result, 'lvr')).toBe(true);
  expect(result.lvr).toBeUndefined();
  expect(saved.lvr).toBe('0.75');
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

test.each([
  ['OWNER_OCCUPIER', 'OWNER_OCCUPIED'], ['INVESTOR', 'INVESTMENT'],
])('recognised %s alias remains selectable and matches canonical rates', (alias, purpose) => {
  const filters = { loanPurposes: [alias], repaymentTypes: ['PRINCIPAL_INTEREST'] };
  expect(scopeMortgageFacets(filters, false)).toBe(filters);
  expect(mortgageComparisonScenario('Mortgage', {}, { loanAmount: '', lvr: '' }, filters))
    .toMatchObject({ purpose, repayment: 'PRINCIPAL_AND_INTEREST' });
  expect(matchesMortgageFacet(purpose, [alias], 'purpose')).toBe(true);
  expect(matchesMortgageFacet('PRINCIPAL_AND_INTEREST', ['PRINCIPAL_INTEREST'], 'repayment')).toBe(true);
  const factual = { loanPurposes: ['OTHER', 'private-source-token'], repaymentTypes: ['UNKNOWN'] };
  expect(scopeMortgageFacets(factual, true)).toBe(factual);
  expect(scopeMortgageFacets(factual, false)).toEqual({ loanPurposes: [], repaymentTypes: [] });
});
