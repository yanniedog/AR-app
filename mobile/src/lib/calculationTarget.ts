import { findEligibleByKey } from '../data/selectors';
import { advertisedTermMonths, calculatorAmount, calculatorRateFraction, MAX_CALCULATOR_DEPOSIT_AMOUNT, quickEstimateUnavailableReason, termDepositInterestDifference } from '../data/calc';
import { toFraction } from '../data/format';
import { isMandatoryEligibilityReady } from '../data/eligibilityGate';
import type { UserRateScenario } from '../data/userRateScenario';
import type { CorePayload, RateRow, SectionKey } from '../types';
import type { RateConditionContext } from '../data/rateConditions';
import { selectedTargetConstraint, targetConstraintContradicted, type SelectedTargetConstraint } from './selectedTargetConstraints';

type Param = string | string[] | undefined;
export interface CalculationTargetParams { target?: Param; ri?: Param; programme?: Param }
export type CalculationTarget =
  | { status: 'none' }
  | { status: 'pending' }
  | { status: 'unavailable' }
  | { status: 'available'; row: RateRow; section: SectionKey };

function single(value: Param): string | undefined {
  if (!Array.isArray(value)) return value;
  return value.length && value.every(item => item === value[0]) ? value[0] : undefined;
}

export function calculationMode(value: Param): 'check' | 'project' {
  return single(value) === 'project' ? 'project' : 'check';
}

export function buildCalculationRoute(row: RateRow, section: SectionKey, mode: 'check' | 'project' = 'check') {
  return { pathname: '/calculator' as const, params: {
    section, mode, target: row.product_key,
    ...(row.rate_index != null ? { ri: String(row.rate_index) } : {}),
    ...(row.public_programme_id ? { programme: row.public_programme_id } : {}),
  } };
}

/** A malformed or missing requested tier never silently chooses a sibling. */
export function resolveCalculationTarget(core: CorePayload | null, section: SectionKey, params: CalculationTargetParams): CalculationTarget {
  if (params.target === undefined || params.target === '') return { status: 'none' };
  const key = single(params.target);
  if (key === '') return { status: 'none' };
  if (!key || key.length > 2048) return { status: 'unavailable' };
  const programme = single(params.programme);
  if (params.programme !== undefined && (!programme || programme.length > 2048)) return { status: 'unavailable' };
  const index = single(params.ri);
  if (params.ri !== undefined && (index === undefined || (index !== '' && (!/^\d+$/.test(index) || !Number.isSafeInteger(Number(index)))))) return { status: 'unavailable' };
  if (!core) return { status: 'pending' };
  const found = findEligibleByKey(core.sections, key);
  if (!found && !isMandatoryEligibilityReady()) return { status: 'pending' };
  if (!found || found.section !== section) return { status: 'unavailable' };
  const row = programme ? found.siblings.find(item => item.public_programme_id === programme)
    : !index ? found.row : found.siblings.find(item => item.rate_index === Number(index));
  return row ? { status: 'available', row, section } : { status: 'unavailable' };
}

export interface SelectedDepositCalculation {
  status: 'ready' | 'inputs-required' | 'rate-only';
  targetRate: number | null;
  difference: number | null;
  months: number | null;
  basis: 'annual-simple-interest' | 'published-maturity';
  constraint: SelectedTargetConstraint;
}

/** Compare the published target with actual entered values; never mutate inputs. */
export function selectedDepositCalculation(row: RateRow, section: 'Savings' | 'TD', scenario: UserRateScenario, context?: RateConditionContext): SelectedDepositCalculation {
  const inputs = section === 'TD' ? scenario.termDeposit : scenario.savings;
  const targetRate = toFraction(row.rate);
  const months = section === 'TD' ? advertisedTermMonths(row) : null;
  const basis = section === 'TD' ? 'published-maturity' : 'annual-simple-interest';
  const constraint = selectedTargetConstraint(row, section, scenario, context);
  const unavailable: SelectedDepositCalculation = { status: 'rate-only', targetRate, months, basis, difference: null, constraint };
  if (targetRate === null || quickEstimateUnavailableReason(row, section) || (section === 'TD' && !months)) return unavailable;
  const balance = calculatorAmount(inputs.balance, MAX_CALCULATOR_DEPOSIT_AMOUNT);
  const currentRate = calculatorRateFraction(inputs.currentRate);
  if (balance === null || balance <= 0 || currentRate === null) return { ...unavailable, status: 'inputs-required' };
  if (targetConstraintContradicted(constraint)) return unavailable;
  const difference = section === 'TD'
    ? termDepositInterestDifference(balance, currentRate, targetRate, months!)
    : balance * (targetRate - currentRate);
  return { status: 'ready', targetRate, months, basis, difference, constraint };
}
