import { calculatorAmount, computeLvr, MAX_CALCULATOR_DEPOSIT_AMOUNT } from '../data/calc';
import { parseLvrTier } from '../data/profile';
import { scopedRateConditions, type RateConditionContext } from '../data/rateConditions';
import { scopedFinancialConditionFacts, type NumericConditionBoundary } from '../data/scopedFinancialConditionFacts';
import type { UserRateScenario } from '../data/userRateScenario';
import type { RateRow, SectionKey } from '../types';

export interface SelectedTargetConstraint {
  status: 'outside-lvr' | 'outside-balance' | 'not-contradicted' | 'unverified';
  basis: 'source-condition' | 'listed-tier' | 'unknown';
  /** Absence of a numeric contradiction is never an eligibility decision. */
  eligibility: 'unverified';
}

function within(value: number, lower: NumericConditionBoundary, upper: NumericConditionBoundary): boolean {
  return (lower.state === 'unspecified' || (lower.inclusive ? value >= lower.value : value > lower.value))
    && (upper.state === 'unspecified' || (upper.inclusive ? value <= upper.value : value < upper.value));
}

function listedAmount(value: RateRow['balance_min']): number | null {
  if (value === undefined || String(value).trim() === '') return null;
  const raw = String(value).trim();
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw)) return null;
  const amount = Number(raw);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

/** Keeps exact target identity; this admission only gates monetary illustrations. */
export function selectedTargetConstraint(
  row: RateRow,
  section: SectionKey,
  scenario: UserRateScenario,
  context?: RateConditionContext,
): SelectedTargetConstraint {
  const result = (status: SelectedTargetConstraint['status'], basis: SelectedTargetConstraint['basis']): SelectedTargetConstraint => ({ status, basis, eligibility: 'unverified' });
  const actual = section === 'Mortgage' ? computeLvr(scenario.mortgage).lvr
    : calculatorAmount((section === 'TD' ? scenario.termDeposit : scenario.savings).balance, MAX_CALCULATOR_DEPOSIT_AMOUNT);
  if (actual === null || actual <= 0) return result('unverified', 'unknown');
  const source = scopedFinancialConditionFacts(scopedRateConditions(row, section, context));
  const sourceBounds = source.facts.filter(fact => section === 'Mortgage'
    ? fact.kind === 'published-lvr-range'
    : fact.kind === 'published-balance-range' && (fact.subject === 'balance' || fact.subject === 'deposit-balance'));
  if (sourceBounds.length) {
    // Separate source entries can be distinct applicability alternatives. Never
    // intersect them or infer a new combined range; a contradiction requires
    // the entered value to be outside every independently published range.
    const outside = sourceBounds.every(fact => !within(actual, fact.lower, fact.upper));
    return result(outside ? section === 'Mortgage' ? 'outside-lvr' : 'outside-balance' : 'not-contradicted', 'source-condition');
  }
  // An admitted but unparsed condition may qualify or contradict the normalized
  // display tier. Its absence of recognized bounds is not permission to guess.
  if (source.state === 'admitted') return result('unverified', 'source-condition');
  if (section === 'Mortgage') {
    const tier = row.lvr_tier ? parseLvrTier(row.lvr_tier) : null;
    if (!tier || !Number.isFinite(tier.lo) || tier.lo < 0 || tier.hi < tier.lo || tier.lo > 100
      || (Number.isFinite(tier.hi) ? tier.hi > 100 : !/[>+]\s*\d|\d\s*\+/.test(row.lvr_tier ?? ''))) return result('unverified', 'unknown');
    return result(actual <= tier.lo || actual > tier.hi ? 'outside-lvr' : 'not-contradicted', 'listed-tier');
  }
  const minimum = listedAmount(row.balance_min), maximum = listedAmount(row.balance_max);
  const specified = (value: RateRow['balance_min']) => value !== undefined && String(value).trim() !== '';
  if ((specified(row.balance_min) && minimum === null) || (specified(row.balance_max) && maximum === null)
    || (minimum !== null && maximum !== null && minimum > maximum) || (minimum === null && maximum === null)) return result('unverified', 'unknown');
  return result((minimum !== null && actual < minimum) || (maximum !== null && actual > maximum) ? 'outside-balance' : 'not-contradicted', 'listed-tier');
}

export function targetConstraintContradicted(model: SelectedTargetConstraint | undefined): boolean {
  return model?.status === 'outside-lvr' || model?.status === 'outside-balance';
}

/** Closed status labels, not payload text or an eligibility verdict. */
export function selectedTargetConstraintLabel(model: SelectedTargetConstraint): string {
  if (model.status === 'outside-lvr') return model.basis === 'source-condition' ? 'Outside published LVR' : 'Outside listed LVR tier';
  if (model.status === 'outside-balance') return model.basis === 'source-condition' ? 'Outside published balance' : 'Outside listed balance tier';
  return 'Eligibility unverified';
}
