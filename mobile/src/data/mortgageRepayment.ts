import { publicDecimal } from './publicRateDecimal';
import { MAX_CALCULATOR_MORTGAGE_AMOUNT } from './calc';
import { canonicalRepayment } from './mortgageFacets';
import type { RateRow } from '../types';
import { requiredMonthlyRepayment } from './staySwitchProjection';

/** Loan term assumed for list repayments; shown beside the entered amount. */
export const LIST_REPAYMENT_TERM_YEARS = 30;

export function mortgageRepaymentBasis(row: Pick<RateRow, 'ribbon_repayment_type' | 'repayment_type'>) {
  // Ribbon classification can default an unconstrained or OTHER source row to P&I.
  const value = canonicalRepayment((row.repayment_type ?? row.ribbon_repayment_type)?.trim());
  return value === 'INTEREST_ONLY' || value === 'PRINCIPAL_AND_INTEREST' ? value : null;
}

/** Monthly repayment for an entered loan amount at a row's payable rate:
 * interest only for interest-only rows, or principal and interest over
 * {@link LIST_REPAYMENT_TERM_YEARS} years. Null for missing inputs or an unspecified repayment basis. */
export function mortgageMonthlyRepayment(
  row: Pick<RateRow, 'ribbon_repayment_type' | 'repayment_type'>,
  amount: number | null | undefined,
  annualRate: number | null | undefined,
  applicableOffset = 0,
): number | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > MAX_CALCULATOR_MORTGAGE_AMOUNT) return null;
  if (typeof annualRate !== 'number' || !Number.isFinite(annualRate) || annualRate < 0 || annualRate >= 1) return null;
  const basis = mortgageRepaymentBasis(row);
  if (!basis || !Number.isFinite(applicableOffset) || applicableOffset < 0) return null;
  if (basis === 'INTEREST_ONLY') {
    if (applicableOffset >= amount) return 0;
    const balance = publicDecimal(amount.toFixed(2)).sub(publicDecimal(applicableOffset.toFixed(2)));
    // Preserve the published rate's decimal precision through whole-dollar rounding.
    const rateText = String(annualRate);
    const rate = publicDecimal(rateText.includes('e') ? annualRate.toFixed(24) : rateText);
    return Number(balance.mul(rate).div(publicDecimal('12')).fixed(0));
  }
  const payment = requiredMonthlyRepayment(amount, annualRate, LIST_REPAYMENT_TERM_YEARS * 12);
  return Number.isFinite(payment) ? Math.round(payment) : null;
}
