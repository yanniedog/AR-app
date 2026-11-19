import type { RateRow } from '../types';
import { requiredMonthlyRepayment } from './staySwitchProjection';

/** Loan term assumed for list repayments; shown beside the entered amount. */
export const LIST_REPAYMENT_TERM_YEARS = 30;

function interestOnly(row: Pick<RateRow, 'ribbon_repayment_type' | 'repayment_type'>): boolean {
  const value = (row.ribbon_repayment_type ?? row.repayment_type ?? '').toUpperCase();
  return value === 'IO' || value === 'INTEREST_ONLY';
}

/** Monthly repayment for an entered loan amount at a row's payable rate:
 * interest only for interest-only rows, otherwise principal and interest over
 * {@link LIST_REPAYMENT_TERM_YEARS} years. Null when either input is missing. */
export function mortgageMonthlyRepayment(
  row: Pick<RateRow, 'ribbon_repayment_type' | 'repayment_type'>,
  amount: number | null | undefined,
  annualRate: number | null | undefined,
): number | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return null;
  if (typeof annualRate !== 'number' || !Number.isFinite(annualRate) || annualRate < 0 || annualRate >= 1) return null;
  const payment = interestOnly(row) ? amount * annualRate / 12
    : requiredMonthlyRepayment(amount, annualRate, LIST_REPAYMENT_TERM_YEARS * 12);
  return Number.isFinite(payment) ? Math.round(payment) : null;
}
