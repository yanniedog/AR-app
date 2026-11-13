import { create } from 'zustand';
import { sourceRowForPublicRow } from './publicRateIntegration';
import type { RateRow } from '../types';
import { calculatorAmount, MAX_CALCULATOR_MORTGAGE_AMOUNT } from './calc';
import { lvrRangeContains, parseLvrRange } from './lvrRange';
import { scopedRateConditions, scopedRateConditionsForRows, type RateConditionContext } from './rateConditions';
import { scopedFinancialConditionFacts, type PublishedNumericConditionFact, type NumericConditionBoundary } from './scopedFinancialConditionFacts';
import { yieldToUi } from '../lib/yieldToUi';
import { Decimal, decimalText } from './publicRateDecimal';

export interface MortgageComparisonInputs {
  loanAmount: string;
  /** Raw direct-entry percentage; inactive while funds determine the ratio. */
  lvr: string;
  lvrMode?: 'lvr' | 'funds';
  fundsAvailable?: string;
}
/** Private exploratory inputs stay in memory, separate from saved searches and reports. */
export const useMortgageComparison = create<MortgageComparisonInputs>(() => ({ loanAmount: '', lvr: '' }));
export const setMortgageComparisonInputs = (value: MortgageComparisonInputs) => useMortgageComparison.setState(value, true);
export const clearMortgageComparison = () => setMortgageComparisonInputs({ loanAmount: '', lvr: '' });

export function mortgageComparisonValues(value: MortgageComparisonInputs) {
  const amount = value.loanAmount.trim() ? calculatorAmount(value.loanAmount, MAX_CALCULATOR_MORTGAGE_AMOUNT) : null;
  const invalidAmount = !!value.loanAmount.trim() && (amount === null || amount <= 0);
  if (value.lvrMode === 'funds') {
    const fundsText = value.fundsAvailable?.trim() ?? '';
    const funds = fundsText ? calculatorAmount(fundsText, MAX_CALCULATOR_MORTGAGE_AMOUNT) : null;
    const invalid = invalidAmount || !!fundsText && funds === null;
    if (invalid || amount === null || amount <= 0 || funds === null) {
      return { amount, lvr: null, invalid, incompleteFunds: !invalid, lvrFraction: undefined, propertyValue: null, exactLvr: null };
    }
    // Money validation admits at most cents. Decimal keeps the ratio rational
    // for scope comparisons; only the public scenario's decimal transport and
    // the displayed number need conversion. Never feed display precision back.
    const loan = Decimal.parse(String(amount)), property = loan.add(Decimal.parse(String(funds)));
    const fraction = loan.div(property), exactLvr = fraction.mul(Decimal.parse('100'));
    return { amount, lvr: Number(decimalText(exactLvr)), invalid: false, incompleteFunds: false, lvrFraction: decimalText(fraction),
      propertyValue: Number(decimalText(property)), exactLvr };
  }
  // Trim before stripping % so pasted values like "71% " parse instead of becoming NaN.
  const lvrText = value.lvr.trim();
  const lvr = lvrText && /^(?:\d+(?:\.\d+)?|\.\d+)\s*%?$/.test(lvrText)
    ? Number(lvrText.replace(/\s*%$/, '')) : null;
  const invalidLvr = !!lvrText && (lvr === null || !Number.isFinite(lvr) || lvr <= 0 || lvr > 100);
  return { amount, lvr, invalid: invalidAmount || invalidLvr, incompleteFunds: false,
    lvrFraction: lvr !== null && !invalidLvr ? String(lvr / 100) : undefined, propertyValue: null, exactLvr: null };
}

const inputs = mortgageComparisonValues;

/** True when loan amount or LVR text is present but not a usable comparison value. */
export function mortgageComparisonInputsInvalid(value: MortgageComparisonInputs): boolean {
  return inputs(value).invalid;
}

/** Rates requires resolved LVR + purpose + repayment. Loan amount is optional only for direct LVR entry. */
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
// A parsed input lives for one scope pass. Repeated tiers share its exact
// comparisons without retaining the private input after that pass is released.
const lvrBoundaryComparisons = new WeakMap<Decimal, Map<number, number>>();
function compareBoundary(value: number, boundary: number, exact?: Decimal | null): number {
  if (!exact || !Number.isFinite(boundary)) return value < boundary ? -1 : value > boundary ? 1 : 0;
  let comparisons = lvrBoundaryComparisons.get(exact);
  if (!comparisons) { comparisons = new Map(); lvrBoundaryComparisons.set(exact, comparisons); }
  const previous = comparisons.get(boundary);
  if (previous !== undefined) return previous;
  // Source bounds are numeric and can stringify in exponential notation.
  const [coefficient, exponent = '0'] = String(boundary).split('e');
  const [whole, fraction = ''] = coefficient.split('.');
  const scale = fraction.length - Number(exponent);
  const bound = new Decimal(BigInt(whole + fraction) * (scale < 0 ? BigInt(10) ** BigInt(-scale) : BigInt(1)),
    scale > 0 ? BigInt(10) ** BigInt(scale) : BigInt(1));
  const result = exact.compare(bound);
  if (comparisons.size < 128) comparisons.set(boundary, result);
  return result;
}
function within(value: number, lower: NumericConditionBoundary, upper: NumericConditionBoundary, exact?: Decimal | null): boolean {
  return (lower.state === 'unspecified' || (lower.inclusive ? compareBoundary(value, lower.value, exact) >= 0 : compareBoundary(value, lower.value, exact) > 0))
    && (upper.state === 'unspecified' || (upper.inclusive ? compareBoundary(value, upper.value, exact) <= 0 : compareBoundary(value, upper.value, exact) < 0));
}

/** Distinct source pointers are explicit alternative bands; same-pointer parses AND. */
function alternativeBands(facts: readonly PublishedNumericConditionFact[]) {
  const byPointer = new Map<string, PublishedNumericConditionFact[]>();
  for (const fact of facts) {
    const key = fact.source.sourcePointer;
    const group = byPointer.get(key);
    if (group) group.push(fact);
    else byPointer.set(key, [fact]);
  }
  return [...byPointer.values()];
}
function admitsValue(value: number, bands: readonly (readonly PublishedNumericConditionFact[])[], exact?: Decimal | null): boolean {
  for (const group of bands) {
    if (group.every(fact => within(value, fact.lower, fact.upper, exact))) return true;
  }
  return false;
}

function containsLvr(range: NonNullable<ReturnType<typeof parseLvrRange>>, parsed: ReturnType<typeof inputs>): boolean {
  if (parsed.lvr === null) return false;
  if (!parsed.exactLvr) return lvrRangeContains(range, parsed.lvr);
  const low = compareBoundary(parsed.lvr, range.lo, parsed.exactLvr);
  const high = compareBoundary(parsed.lvr, range.hi, parsed.exactLvr);
  return parsed.lvr > 0 && (range.inclusive ? low >= 0 : low > 0) && (range.hiInclusive === false ? high < 0 : high <= 0);
}

function listedAmountBounds(row: RateRow) {
  const bound = (raw: RateRow['balance_min']): number | null => raw != null && String(raw).trim() !== ''
    && /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(String(raw).trim()) && Number.isFinite(Number(raw)) ? Number(raw) : null;
  const low = bound(row.balance_min), high = bound(row.balance_max);
  return { low, high, invalid: (low !== null && high !== null && low > high) || (row.balance_min != null && low === null)
    || (row.balance_max != null && high === null) };
}

function matchListedTier(
  row: RateRow,
  parsed: ReturnType<typeof inputs>,
  fallthroughLvr: boolean,
  fallthroughAmount: boolean,
  range = parseLvrRange(row.lvr_tier),
  amountBounds?: ReturnType<typeof listedAmountBounds>,
): MortgageComparisonMatch {
  let unverified = false;
  if (parsed.lvr !== null && fallthroughLvr) {
    // User LVR is set: missing/unparseable listed tier is outside, never an
    // unverified keep that resurfaces identity-catalogue rows (e.g. <60% at 71%).
    if (!range) return 'outside';
    if (!containsLvr(range, parsed)) return 'outside';
  }
  if (parsed.amount !== null && fallthroughAmount) {
    const { low, high, invalid } = amountBounds ?? listedAmountBounds(row);
    if (invalid) unverified = true;
    else if (low !== null && parsed.amount < low || high !== null && parsed.amount > high) return 'outside';
    else if (low === null || high === null) unverified = true;
  }
  return unverified ? 'unverified' : 'listed';
}

export function prepareMortgageComparisonRow(row: RateRow, context?: RateConditionContext) {
  return prepareComparisonMetadata(row, scopedFinancialConditionFacts(scopedRateConditions(sourceRowForPublicRow(row), 'Mortgage', context)));
}
export type PreparedMortgageComparisonRow = ReturnType<typeof prepareMortgageComparisonRow>;
function prepareComparisonMetadata(row: RateRow, source: ReturnType<typeof scopedFinancialConditionFacts>) {
  return { source, range: parseLvrRange(row.lvr_tier), amountBounds: listedAmountBounds(row),
    lvrBands: alternativeBands(source.facts.filter(fact => fact.kind === 'published-lvr-range')),
    amountBands: alternativeBands(source.facts.filter(fact => fact.kind === 'published-balance-range'
      && (fact.subject === 'loan-amount' || fact.subject === 'borrowing-amount'))) };
}

/** Validate each product envelope once per synchronous batch, then yield before
 * the next product. A cancelled source owner never publishes prepared facts. */
export async function prepareMortgageComparisonRowsCooperatively(rows: readonly RateRow[], context?: RateConditionContext,
  control: { cancelled?: () => boolean; yieldControl?: () => Promise<void>; now?: () => number } = {}) {
  const cancelled = control.cancelled ?? (() => false);
  const yieldControl = control.yieldControl ?? (() => yieldToUi(0));
  const now = control.now ?? (() => performance.now());
  const groups = new Map<string, RateRow[]>();
  for (const row of rows) {
    const group = groups.get(row.product_key);
    if (group) group.push(row); else groups.set(row.product_key, [row]);
  }
  const prepared = new WeakMap<RateRow, PreparedMortgageComparisonRow>();
  await yieldControl();
  let checkpoint = now();
  for (const group of groups.values()) {
    if (cancelled()) return null;
    const scopes = scopedRateConditionsForRows(group.map(sourceRowForPublicRow), 'Mortgage', context);
    for (let index = 0; index < group.length; index++) {
      const row = group[index];
      prepared.set(row, prepareComparisonMetadata(row, scopedFinancialConditionFacts(scopes[index])));
    }
    if (now() - checkpoint >= 4) { await yieldControl(); checkpoint = now(); }
  }
  return cancelled() ? null : prepared;
}
function match(row: RateRow, parsed: ReturnType<typeof inputs>, context?: RateConditionContext,
  prepared?: PreparedMortgageComparisonRow): MortgageComparisonMatch {
  if (parsed.invalid) return 'invalid';
  if (parsed.incompleteFunds) return 'outside';
  let unverified = false;
  let fallthroughLvr = parsed.lvr !== null;
  let fallthroughAmount = parsed.amount !== null;
  if (parsed.lvr !== null || parsed.amount !== null) {
    const source = prepared?.source ?? scopedFinancialConditionFacts(scopedRateConditions(sourceRowForPublicRow(row), 'Mortgage', context));
    if (source.state === 'admitted') {
      const dimensions: readonly [number | null, readonly (readonly PublishedNumericConditionFact[])[], 'lvr' | 'amount'][] = [
        [parsed.lvr, prepared?.lvrBands ?? alternativeBands(source.facts.filter(fact => fact.kind === 'published-lvr-range')), 'lvr'],
        [parsed.amount, prepared?.amountBands ?? alternativeBands(source.facts.filter(fact => fact.kind === 'published-balance-range'
          && (fact.subject === 'loan-amount' || fact.subject === 'borrowing-amount'))), 'amount'],
      ];
      for (const [value, facts, dimension] of dimensions) {
        if (value === null) continue;
        if (!facts.length) { unverified = true; continue; }
        // Admitted facts for this dimension are conclusive — do not fall through
        // to a looser listed tier/bounds that could rescue an excluded input.
        if (dimension === 'lvr') fallthroughLvr = false;
        else fallthroughAmount = false;
        if (!admitsValue(value, facts, dimension === 'lvr' ? parsed.exactLvr : null)) return 'outside';
      }
      if (source.unresolved.length) unverified = true;
      // Admitted LVR alternatives must still clear a parseable listed tier so a
      // stray second published band cannot rescue e.g. 71% onto an lvr_<60% row.
      // Missing/unparseable listed tier is outside (same as matchListedTier).
      if (!fallthroughLvr && parsed.lvr !== null) {
        const range = prepared ? prepared.range : parseLvrRange(row.lvr_tier);
        if (!range || !containsLvr(range, parsed)) return 'outside';
      }
      if (!unverified && !fallthroughLvr && !fallthroughAmount) return 'listed';
      if (!fallthroughLvr && !fallthroughAmount) return unverified ? 'unverified' : 'listed';
      // Missing admitted LVR/amount facts only: fall through to listed tier/bounds.
    }
  }
  const listed = matchListedTier(row, parsed, fallthroughLvr, fallthroughAmount,
    prepared ? prepared.range : parseLvrRange(row.lvr_tier), prepared?.amountBounds);
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

/** Reuses source-verified wording and parsed tiers from the same immutable context. */
export function indexedMortgageComparisonRows(rows: RateRow[], value: MortgageComparisonInputs,
  prepared: WeakMap<RateRow, PreparedMortgageComparisonRow>) {
  const parsed = inputs(value), unverifiedRows = new WeakSet<RateRow>();
  let unverified = 0;
  const selected = rows.filter(row => {
    const metadata = prepared.get(row);
    if (!metadata) throw new Error('Unprepared mortgage row');
    const state = match(row, parsed, undefined, metadata);
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
  if (parsed.incompleteFunds) return { rows: [], unverified: 0, unverifiedRows: new WeakSet<RateRow>(), invalid: false };
  // Empty scope is a cheap identity pass; keep it synchronous after the yield.
  if (parsed.amount === null && parsed.lvr === null && !parsed.invalid) {
    return { rows: [...rows], unverified: 0, unverifiedRows: new WeakSet<RateRow>(), invalid: false };
  }
  const prepared = await prepareMortgageComparisonRowsCooperatively(rows, context, control);
  if (!prepared || cancelled()) return null;
  let unverified = 0;
  const unverifiedRows = new WeakSet<RateRow>();
  const selected: RateRow[] = [];
  let sliceStarted = now();
  for (let offset = 0; offset < rows.length; offset += 1) {
    const row = rows[offset];
    const state = match(row, parsed, context, prepared.get(row));
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
