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
 * interest only for interest-only rows, otherwise principal and interest over
 * {@link LIST_REPAYMENT_TERM_YEARS} years. Null when either input is missing. */
export function mortgageMonthlyRepayment(
  row: Pick<RateRow, 'ribbon_repayment_type' | 'repayment_type'>,
  amount: number | null | undefined,
  annualRate: number | null | undefined,
  applicableOffset = 0,
): number | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return null;
  if (typeof annualRate !== 'number' || !Number.isFinite(annualRate) || annualRate < 0 || annualRate >= 1) return null;
  const basis = mortgageRepaymentBasis(row);
  if (!basis || !Number.isFinite(applicableOffset) || applicableOffset < 0) return null;
  const payment = basis === 'INTEREST_ONLY' ? Math.max(0, amount - applicableOffset) * annualRate / 12
    : requiredMonthlyRepayment(amount, annualRate, LIST_REPAYMENT_TERM_YEARS * 12);
  return Number.isFinite(payment) ? Math.round(payment) : null;
}
