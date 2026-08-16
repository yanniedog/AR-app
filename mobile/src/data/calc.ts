import { rateConditionality } from '../lib/rateQualifier';
import type { RateRow, SectionKey } from '../types';

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

export const MAX_CALCULATOR_MORTGAGE_AMOUNT = 100_000_000;
export const MAX_CALCULATOR_DEPOSIT_AMOUNT = 20_000_000;
export const MAX_CALCULATOR_RATE_PERCENT = 100;
export const MAX_CALCULATOR_YEARS = 50;

/** Parse a user-entered dollar amount without silently stripping signs or letters. */
export function calculatorAmount(value: string, maximum: number): number | null {
  const raw = String(value ?? '').trim();
  if (!raw || !Number.isFinite(maximum) || maximum <= 0) return null;
  if (!/^\$?\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/.test(raw)) return null;
  const parsed = Number(raw.replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= maximum ? parsed : null;
}

/** Calculator fields are labelled as percentages and accept only 0 < rate <= 100. */
export function calculatorRateFraction(value: string): number | null {
  const raw = String(value ?? '').trim();
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)\s*%?$/.test(raw)) return null;
  const percentage = Number(raw.replace(/\s*%$/, ''));
  return Number.isFinite(percentage) && percentage > 0 && percentage <= MAX_CALCULATOR_RATE_PERCENT
    ? percentage / 100
    : null;
}

/** A mortgage repayment illustration requires an explicitly entered bounded term. */
export function calculatorYears(value: string): number | null {
  const raw = String(value ?? '').trim();
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw)) return null;
  const years = Number(raw);
  return Number.isFinite(years) && years > 0 && years <= MAX_CALCULATOR_YEARS
    && Math.round(years * 12) > 0
    ? years
    : null;
}

export function isPublishedFixedRate(input: Pick<RateRow, 'rate_type' | 'ribbon_rate_structure'>): boolean {
  return input.ribbon_rate_structure?.trim().toLowerCase() === 'fixed'
    || input.rate_type?.toUpperCase().includes('FIXED') === true;
}

/** Explain why a quick deposit dollar estimate cannot be supported by the observed row. */
export function quickEstimateUnavailableReason(row: RateRow, section: SectionKey): string | null {
  if (section === 'Mortgage') return null;
  const conditionality = rateConditionality(row, section);
  if (row.account_class?.trim().toLowerCase() !== 'standard'
    || row.exact_alert_eligible === false
    || conditionality === 'bonus'
    || conditionality === 'intro'
    || (section === 'Savings' && conditionality !== 'base')) {
    return 'Eligibility or rate conditions must be confirmed before estimating dollars.';
  }
  if (section === 'TD' && advertisedTermMonths(row) == null) {
    return 'The maturity term is not published, so no dollar estimate is available.';
  }
  return null;
}

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
  const value = calculatorAmount(inputs.propertyValue, MAX_CALCULATOR_MORTGAGE_AMOUNT);
  if (value == null || value <= 0) return { loan: null, lvr: null, depositApplied: 0 };
  if (inputs.mode === 'refi') {
    const loan = calculatorAmount(inputs.loanBalance, MAX_CALCULATOR_MORTGAGE_AMOUNT);
    const lvr = loan != null && loan > 0 ? (loan / value) * 100 : null;
    return { loan: loan != null && loan > 0 ? loan : null, lvr, depositApplied: 0 };
  }
  const deposit = inputs.deposit.trim()
    ? calculatorAmount(inputs.deposit, MAX_CALCULATOR_MORTGAGE_AMOUNT)
    : 0;
  const costs = inputs.costs.trim()
    ? calculatorAmount(inputs.costs, MAX_CALCULATOR_MORTGAGE_AMOUNT)
    : 0;
  if (deposit == null || costs == null) return { loan: null, lvr: null, depositApplied: 0 };
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
