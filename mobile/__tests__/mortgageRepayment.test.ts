import { mortgageMonthlyRepayment } from '../src/data/mortgageRepayment';

test('list repayments use the payable rate: P&I over 30 years, interest only as interest', () => {
  expect(mortgageMonthlyRepayment({ ribbon_repayment_type: 'PRINCIPAL_AND_INTEREST' }, 600000, 0.06)).toBe(3597);
  expect(mortgageMonthlyRepayment({ repayment_type: 'INTEREST_ONLY' }, 600000, 0.06)).toBe(3000);
  expect(mortgageMonthlyRepayment({}, null, 0.06)).toBeNull();
  expect(mortgageMonthlyRepayment({}, 600000, null)).toBeNull();
  expect(mortgageMonthlyRepayment({}, -1, 0.06)).toBeNull();
});
