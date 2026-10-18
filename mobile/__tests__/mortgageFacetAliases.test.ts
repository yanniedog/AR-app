import { matchesMortgageFacet } from '../src/data/mortgageFacets';

test('known purpose and repayment aliases are equivalent without widening unknown values', () => {
  expect(matchesMortgageFacet('OO', ['OWNER_OCCUPIED'], 'purpose')).toBe(true);
  expect(matchesMortgageFacet('INVESTMENT', ['INV'], 'purpose')).toBe(true);
  expect(matchesMortgageFacet('PI', ['PRINCIPAL_AND_INTEREST'], 'repayment')).toBe(true);
  expect(matchesMortgageFacet('INTEREST_ONLY', ['IO'], 'repayment')).toBe(true);
  expect(matchesMortgageFacet('OO', ['INVESTMENT'], 'purpose')).toBe(false);
  expect(matchesMortgageFacet('UNRECOGNISED', ['unrecognised'], 'purpose')).toBe(false);
  expect(matchesMortgageFacet('UNRECOGNISED', ['UNRECOGNISED'], 'purpose')).toBe(true);
  expect(matchesMortgageFacet(undefined, ['OO'], 'purpose')).toBe(false);
});
