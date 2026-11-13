/** Pure rate policy shared by native selectors and command-line audits. */
export const RATE_MOVE_BPS_THRESHOLD = 5;

/** Deposit rates below 0.10% are token rates; mortgages are never gated. */
export const MIN_MEANINGFUL_DEPOSIT_RATE_FRACTION = 0.001;

export function isMeaningfulDepositRate(
  fraction: number,
  section: 'Mortgage' | 'Savings' | 'TD' | string,
): boolean {
  if (section === 'Mortgage') return true;
  return fraction >= MIN_MEANINGFUL_DEPOSIT_RATE_FRACTION;
}
