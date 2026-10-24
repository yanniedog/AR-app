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
  const lvr = value.lvr.trim() && /^(?:\d+(?:\.\d+)?|\.\d+)\s*%?$/.test(value.lvr.trim())
    ? Number(value.lvr.replace(/\s*%$/, '')) : null;
  return { amount, lvr, invalid: !!value.loanAmount.trim() && (amount === null || amount <= 0)
    || !!value.lvr.trim() && (lvr === null || lvr <= 0 || lvr > 100) };
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
function match(row: RateRow, parsed: ReturnType<typeof inputs>, context?: RateConditionContext): MortgageComparisonMatch {
  if (parsed.invalid) return 'invalid';
  if (parsed.lvr !== null || parsed.amount !== null) {
    const source = scopedFinancialConditionFacts(scopedRateConditions(sourceRowForPublicRow(row), 'Mortgage', context));
    if (source.state === 'admitted') {
      let unknown = source.unresolved.length > 0;
      const dimensions: readonly [number | null, readonly PublishedNumericConditionFact[]][] = [
        [parsed.lvr, source.facts.filter(fact => fact.kind === 'published-lvr-range')],
        [parsed.amount, source.facts.filter(fact => fact.kind === 'published-balance-range'
          && (fact.subject === 'loan-amount' || fact.subject === 'borrowing-amount'))],
      ];
      for (const [value, facts] of dimensions) {
        if (value === null) continue;
        if (!facts.length) { unknown = true; continue; }
        // Independently published ranges can be applicability alternatives.
        // Unparsed qualifications prevent a conclusive outside verdict.
        if (facts.every(fact => !within(value, fact.lower, fact.upper))) {
          if (source.unresolved.length) unknown = true;
          else return 'outside';
        }
      }
      return unknown ? 'unverified' : 'listed';
    }
  }
  let unverified = false;
  if (parsed.lvr !== null) {
    const range = parseLvrRange(row.lvr_tier);
    if (!range) unverified = true;
    else if (!lvrRangeContains(range, parsed.lvr)) return 'outside';
  }
  if (parsed.amount !== null) {
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
