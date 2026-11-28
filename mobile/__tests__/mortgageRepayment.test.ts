import { mortgageMonthlyRepayment } from '../src/data/mortgageRepayment';

test('list repayments use the payable rate: P&I over 30 years, interest only as interest', () => {
  expect(mortgageMonthlyRepayment({ ribbon_repayment_type: 'PRINCIPAL_AND_INTEREST' }, 600000, 0.06)).toBe(3597);
  expect(mortgageMonthlyRepayment({ repayment_type: 'INTEREST_ONLY' }, 600000, 0.06)).toBe(3000);
  expect(mortgageMonthlyRepayment({}, null, 0.06)).toBeNull();
  expect(mortgageMonthlyRepayment({}, 600000, null)).toBeNull();
  expect(mortgageMonthlyRepayment({}, -1, 0.06)).toBeNull();
});

test('a supported offset reduces interest-only repayments without changing P&I repayments', () => {
  const row = { repayment_type: 'INTEREST_ONLY' };
  expect(mortgageMonthlyRepayment(row, 600000, 0.06, 100000)).toBe(2500);
  expect(mortgageMonthlyRepayment(row, 600000, 0.06, 700000)).toBe(0);
  expect(mortgageMonthlyRepayment({ repayment_type: 'PRINCIPAL_AND_INTEREST' }, 600000, 0.06, 100000)).toBe(3597);
});

test('NAB 6.94% offers from the 28 November catalogue use their published repayment basis', () => {
  expect(mortgageMonthlyRepayment({ repayment_type: 'PRINCIPAL_AND_INTEREST' }, 650000, 0.0694)).toBe(4298);
  expect(mortgageMonthlyRepayment({ repayment_type: 'INTEREST_ONLY' }, 650000, 0.0694)).toBe(3759);
});

test.each(['UNCONSTRAINED', 'OTHER'])('a %s source basis cannot inherit the ribbon P&I default', repayment_type => {
  expect(mortgageMonthlyRepayment({ repayment_type, ribbon_repayment_type: 'principal_and_interest' }, 650000, 0.0694)).toBeNull();
});
