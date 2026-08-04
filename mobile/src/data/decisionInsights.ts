import type { SectionKey } from '../types';

export interface LoyaltyGapInsight {
  gapRate: number;
  monthlyDollars: number;
  annualDollars: number;
  typicalGapRate: number | null;
}

/**
 * Illustrative observed gap only: no forecast, switching cost, tax or advice claim.
 * Rates are fractions (for example 0.055 for 5.5%).
 */
export function loyaltyGapInsight(
  section: SectionKey,
  principal: number,
  currentRate: number,
  matchedBestRate: number,
  typicalRate: number | null,
): LoyaltyGapInsight | null {
  if (![principal, currentRate, matchedBestRate].every(Number.isFinite)) return null;
  if (principal <= 0 || currentRate <= 0 || matchedBestRate <= 0) return null;
  const lowerIsBetter = section === 'Mortgage';
  const gapRate = Math.max(
    0,
    lowerIsBetter ? currentRate - matchedBestRate : matchedBestRate - currentRate,
  );
  const typicalGapRate =
    typicalRate != null && Number.isFinite(typicalRate) && typicalRate > 0
      ? Math.max(0, lowerIsBetter ? currentRate - typicalRate : typicalRate - currentRate)
      : null;
  const annualDollars = principal * gapRate;
  return {
    gapRate,
    monthlyDollars: annualDollars / 12,
    annualDollars,
    typicalGapRate,
  };
}
