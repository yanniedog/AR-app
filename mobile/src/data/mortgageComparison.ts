import { create } from 'zustand';
import { sourceRowForPublicRow } from './publicRateIntegration';
import type { RateRow } from '../types';
import { calculatorAmount, MAX_CALCULATOR_MORTGAGE_AMOUNT } from './calc';
import { lvrRangeContains, parseLvrRange } from './lvrRange';
import { scopedRateConditions, type RateConditionContext } from './rateConditions';
import { scopedFinancialConditionFacts, type PublishedNumericConditionFact, type NumericConditionBoundary } from './scopedFinancialConditionFacts';
import { yieldToUi } from '../lib/yieldToUi';

export interface MortgageComparisonInputs { loanAmount: string; lvr: string }
/** Private exploratory inputs stay in memory, separate from saved searches and reports. */
export const useMortgageComparison = create<MortgageComparisonInputs>(() => ({ loanAmount: '', lvr: '' }));
export const clearMortgageComparison = () => useMortgageComparison.setState({ loanAmount: '', lvr: '' });

function inputs(value: MortgageComparisonInputs) {
  const amount = value.loanAmount.trim() ? calculatorAmount(value.loanAmount, MAX_CALCULATOR_MORTGAGE_AMOUNT) : null;
  // Trim before stripping % so pasted values like "71% " parse instead of becoming NaN.
  const lvrText = value.lvr.trim();
  const lvr = lvrText && /^(?:\d+(?:\.\d+)?|\.\d+)\s*%?$/.test(lvrText)
    ? Number(lvrText.replace(/\s*%$/, '')) : null;
  return { amount, lvr, invalid: !!value.loanAmount.trim() && (amount === null || amount <= 0)
    || !!lvrText && (lvr === null || !Number.isFinite(lvr) || lvr <= 0 || lvr > 100) };
}

/** Rates Mortgage search runs only after LVR + purpose + repayment are set. Loan amount stays optional. */
export function mortgageComparisonCriteriaReady(
  value: MortgageComparisonInputs,
  facets: { loanPurposes: readonly string[]; repaymentTypes: readonly string[] },
): boolean {
  const parsed = inputs(value);
  return !parsed.invalid && parsed.lvr !== null
    && facets.loanPurposes.length > 0 && facets.repaymentTypes.length > 0;
}

export type MortgageComparisonMatch = 'listed' | 'unverified' | 'outside' | 'invalid';
/** Listed bounds are a comparison scope, never a bank approval or total-cost claim. */
export function mortgageComparisonMatch(row: RateRow, value: MortgageComparisonInputs, context?: RateConditionContext): MortgageComparisonMatch {
  return match(row, inputs(value), context);
}
function within(value: number, lower: NumericConditionBoundary, upper: NumericConditionBoundary): boolean {
  return (lower.state === 'unspecified' || (lower.inclusive ? value >= lower.value : value > lower.value))
    && (upper.state === 'unspecified' || (upper.inclusive ? value <= upper.value : value < upper.value));
}

/** Distinct source pointers are explicit alternative bands; same-pointer parses AND. */
function admitsValue(value: number, facts: readonly PublishedNumericConditionFact[]): boolean {
  if (!facts.length) return false;
  const byPointer = new Map<string, PublishedNumericConditionFact[]>();
  for (const fact of facts) {
    const key = fact.source.sourcePointer;
    const group = byPointer.get(key);
    if (group) group.push(fact);
    else byPointer.set(key, [fact]);
  }
  for (const group of byPointer.values()) {
    if (group.every(fact => within(value, fact.lower, fact.upper))) return true;
  }
  return false;
}

function matchListedTier(
  row: RateRow,
  parsed: ReturnType<typeof inputs>,
  fallthroughLvr: boolean,
  fallthroughAmount: boolean,
): MortgageComparisonMatch {
  let unverified = false;
  if (parsed.lvr !== null && fallthroughLvr) {
    const range = parseLvrRange(row.lvr_tier);
    // User LVR is set: missing/unparseable listed tier is outside, never an
    // unverified keep that resurfaces identity-catalogue rows (e.g. <60% at 71%).
    if (!range) return 'outside';
    if (!lvrRangeContains(range, parsed.lvr)) return 'outside';
  }
  if (parsed.amount !== null && fallthroughAmount) {
    const bound = (raw: RateRow['balance_min']): number | null => raw != null && String(raw).trim() !== ''
      && /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(String(raw).trim()) && Number.isFinite(Number(raw)) ? Number(raw) : null;
    const low = bound(row.balance_min), high = bound(row.balance_max);
    if ((low !== null && high !== null && low > high) || (row.balance_min != null && low === null)
      || (row.balance_max != null && high === null)) unverified = true;
    else if (low !== null && parsed.amount < low || high !== null && parsed.amount > high) return 'outside';
    else if (low === null || high === null) unverified = true;
  }
  return unverified ? 'unverified' : 'listed';
}

function match(row: RateRow, parsed: ReturnType<typeof inputs>, context?: RateConditionContext): MortgageComparisonMatch {
  if (parsed.invalid) return 'invalid';
  let unverified = false;
  let fallthroughLvr = parsed.lvr !== null;
  let fallthroughAmount = parsed.amount !== null;
  if (parsed.lvr !== null || parsed.amount !== null) {
    const source = scopedFinancialConditionFacts(scopedRateConditions(sourceRowForPublicRow(row), 'Mortgage', context));
    if (source.state === 'admitted') {
      const dimensions: readonly [number | null, readonly PublishedNumericConditionFact[], 'lvr' | 'amount'][] = [
        [parsed.lvr, source.facts.filter(fact => fact.kind === 'published-lvr-range'), 'lvr'],
        [parsed.amount, source.facts.filter(fact => fact.kind === 'published-balance-range'
          && (fact.subject === 'loan-amount' || fact.subject === 'borrowing-amount')), 'amount'],
      ];
      for (const [value, facts, dimension] of dimensions) {
        if (value === null) continue;
        if (!facts.length) { unverified = true; continue; }
        // Admitted facts for this dimension are conclusive — do not fall through
        // to a looser listed tier/bounds that could rescue an excluded input.
        if (dimension === 'lvr') fallthroughLvr = false;
        else fallthroughAmount = false;
        if (!admitsValue(value, facts)) return 'outside';
      }
      if (source.unresolved.length) unverified = true;
      // Admitted LVR alternatives must still clear a parseable listed tier so a
      // stray second published band cannot rescue e.g. 71% onto an lvr_<60% row.
      // Missing/unparseable listed tier is outside (same as matchListedTier).
      if (!fallthroughLvr && parsed.lvr !== null) {
        const range = parseLvrRange(row.lvr_tier);
        if (!range || !lvrRangeContains(range, parsed.lvr)) return 'outside';
      }
      if (!unverified && !fallthroughLvr && !fallthroughAmount) return 'listed';
      if (!fallthroughLvr && !fallthroughAmount) return unverified ? 'unverified' : 'listed';
      // Missing admitted LVR/amount facts only: fall through to listed tier/bounds.
    }
  }
  const listed = matchListedTier(row, parsed, fallthroughLvr, fallthroughAmount);
  if (listed === 'outside' || listed === 'invalid') return listed;
  return listed === 'unverified' || unverified ? 'unverified' : 'listed';
}
export function mortgageComparisonRows(rows: RateRow[], value: MortgageComparisonInputs, context?: RateConditionContext) {
  const parsed = inputs(value);
  let unverified = 0;
  const unverifiedRows = new WeakSet<RateRow>();
  const selected = rows.filter(row => {
    const state = match(row, parsed, context);
    if (state === 'unverified') { unverified++; unverifiedRows.add(row); }
    return state === 'listed' || state === 'unverified';
  });
  return { rows: selected, unverified, unverifiedRows, invalid: parsed.invalid };
}

export type MortgageComparisonScope = ReturnType<typeof mortgageComparisonRows>;

/** Amount/LVR matching against published conditions stays off the render path. */
export async function mortgageComparisonRowsCooperatively(
  rows: RateRow[], value: MortgageComparisonInputs, context?: RateConditionContext,
  control: { cancelled?: () => boolean; yieldControl?: () => Promise<void>; now?: () => number } = {},
): Promise<MortgageComparisonScope | null> {
  const yieldControl = control.yieldControl ?? (() => yieldToUi(0));
  const now = control.now ?? (() => performance.now());
  const cancelled = control.cancelled ?? (() => false);
  await yieldControl();
  if (cancelled()) return null;
  const parsed = inputs(value);
  // Empty scope is a cheap identity pass; keep it synchronous after the yield.
  if (parsed.amount === null && parsed.lvr === null && !parsed.invalid) {
    return { rows: [...rows], unverified: 0, unverifiedRows: new WeakSet<RateRow>(), invalid: false };
  }
  let unverified = 0;
  const unverifiedRows = new WeakSet<RateRow>();
  const selected: RateRow[] = [];
  let sliceStarted = now();
  for (let offset = 0; offset < rows.length; offset += 1) {
    const row = rows[offset];
    const state = match(row, parsed, context);
    if (state === 'unverified') { unverified += 1; unverifiedRows.add(row); }
    if (state === 'listed' || state === 'unverified') selected.push(row);
    if ((offset + 1) % 16 === 0 && now() - sliceStarted >= 6) {
      await yieldControl();
      sliceStarted = now();
      if (cancelled()) return null;
    }
  }
  return cancelled() ? null : { rows: selected, unverified, unverifiedRows, invalid: parsed.invalid };
}
