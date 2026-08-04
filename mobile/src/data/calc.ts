/**
 * Mortgage calculator inputs — persisted on the user profile so the calculator
 * remembers the user's situation across sessions, and a real LVR can be computed
 * (not merely chosen) from the values they enter.
 */
export type CalcMode = 'buy' | 'refi';

export interface CalcInputs {
  mode: CalcMode;
  /** Property price (buying) or current property value (refinancing). */
  propertyValue: string;
  /** Buying: deposit/savings going toward the purchase. */
  deposit: string;
  /** Buying: upfront costs (stamp duty + fees) paid from savings, reducing the deposit. */
  costs: string;
  /** Refinancing: current loan balance. */
  loanBalance: string;
  currentRate: string;
  years: string;
  /** Savings/TD section balance (kept here so all calculator inputs persist together). */
  savingsBalance: string;
}

export const EMPTY_CALC: CalcInputs = {
  mode: 'buy',
  propertyValue: '',
  deposit: '',
  costs: '',
  loanBalance: '',
  currentRate: '',
  years: '',
  savingsBalance: '',
};

export function normalizeCalcInputs(value?: Partial<CalcInputs> | null): CalcInputs {
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  const mode: CalcMode = value?.mode === 'refi' ? 'refi' : 'buy';
  return {
    mode,
    propertyValue: str(value?.propertyValue),
    deposit: str(value?.deposit),
    costs: str(value?.costs),
    loanBalance: str(value?.loanBalance),
    currentRate: str(value?.currentRate),
    years: str(value?.years),
    savingsBalance: str(value?.savingsBalance),
  };
}

export function num(text: string): number {
  const n = Number(String(text ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export interface LvrResult {
  /** Computed loan amount in dollars (null when inputs are insufficient). */
  loan: number | null;
  /** Loan-to-value ratio as a percentage (null when inputs are insufficient). */
  lvr: number | null;
  /** Deposit actually applied to the property (buying), after upfront costs. */
  depositApplied: number;
}

/** Compute loan + LVR from the inputs for the active mode. */
export function computeLvr(inputs: CalcInputs): LvrResult {
  const value = num(inputs.propertyValue);
  if (inputs.mode === 'refi') {
    const loan = num(inputs.loanBalance);
    const lvr = value > 0 && loan > 0 ? (loan / value) * 100 : null;
    return { loan: loan > 0 ? loan : null, lvr, depositApplied: 0 };
  }
  const deposit = num(inputs.deposit);
  const costs = num(inputs.costs);
  const depositApplied = Math.max(0, deposit - costs);
  const loan = value > 0 ? Math.max(0, value - depositApplied) : 0;
  const lvr = value > 0 && loan > 0 ? (loan / value) * 100 : null;
  return { loan: value > 0 ? loan : null, lvr, depositApplied };
}

/**
 * Extra deposit needed to bring the LVR to `targetLvrPct` or below, given the
 * property value and the deposit already applied. Returns 0 when already there.
 */
export function depositToReachLvr(
  propertyValue: number,
  depositApplied: number,
  targetLvrPct: number,
): number {
  if (propertyValue <= 0 || targetLvrPct <= 0) return 0;
  const needed = propertyValue * (1 - targetLvrPct / 100);
  return Math.max(0, needed - depositApplied);
}

/** Parse the advertised period without inventing a duration when none is published. */
export function advertisedTermMonths(input: {
  term_months?: string | number;
  term?: string;
  ribbon_fixed_term?: string | number;
}): number | null {
  const explicit = Number(input.term_months);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const iso = /^P(?:(\d+)Y)?(?:(\d+)M)?$/.exec(input.term ?? '');
  if (iso) return Number(iso[1] ?? 0) * 12 + Number(iso[2] ?? 0) || null;
  const fixedYears = Number(input.ribbon_fixed_term);
  return Number.isFinite(fixedYears) && fixedYears > 0 ? fixedYears * 12 : null;
}

export function fixedRateProjectionMonths(
  remainingMonths: number,
  advertisedFixedMonths: number | null,
): number {
  if (!Number.isFinite(remainingMonths) || remainingMonths <= 0) return 0;
  return advertisedFixedMonths && advertisedFixedMonths > 0
    ? Math.min(remainingMonths, advertisedFixedMonths)
    : remainingMonths;
}

export function termDepositInterestDifference(
  balance: number,
  currentRate: number,
  candidateRate: number,
  termMonths: number,
): number {
  if (![balance, currentRate, candidateRate, termMonths].every(Number.isFinite)) return 0;
  if (balance <= 0 || termMonths <= 0) return 0;
  return balance * (candidateRate - currentRate) * termMonths / 12;
}
