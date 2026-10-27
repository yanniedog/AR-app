import { Decimal, publicDecimal, PUBLIC_ONE, PUBLIC_ZERO, decimalText, finiteDecimal, isRecurringDecimal, rateDecimal } from './publicRateDecimal';
import type { PublicComponent, PublicCondition, PublicFormula, PublicFreshness, PublicProgramme, PublicTier, RateResolution, RateScenario, ResolvedPhase } from './publicRateModel';

const NUMERICAL = new Set(['amount', 'balance', 'lvr', 'termMonths', 'termDays', 'monthlyDeposit', 'withdrawals', 'balanceGrowth', 'cardTransactions']);
const FIELDS = new Set([...NUMERICAL, 'purpose', 'repayment', 'channel', 'package', 'customerCategory', 'qualification', 'custom', 'effectiveDate']);
const ROLES = new Set(['payable', 'reference', 'discount', 'margin', 'bonus', 'comparison', 'reversion']);
const STALE_MS = 48 * 60 * 60 * 1000;
type ConditionState = 'met' | 'unmet' | 'unknown';
interface Evaluation { kind: 'exact' | 'from' | 'range'; minimum: Decimal; maximum?: Decimal; components: PublicComponent[]; reasons: string[] }
interface Context { programme: PublicProgramme; scenario: RateScenario; asOf: string; states: Map<string, { condition: PublicCondition; state: ConditionState }>; nodes: number }

function fail(reason: string): never { throw new Error(reason); }
function unique<T>(values: T[]): T[] { return [...new Set(values)]; }

function bound(value: Decimal, minimum?: string, maximum?: string, minInclusive = true, maxInclusive = true): boolean {
  if (minimum !== undefined) {
    const comparison = value.compare(publicDecimal(minimum));
    if (comparison < 0 || comparison === 0 && !minInclusive) return false;
  }
  if (maximum !== undefined) {
    const comparison = value.compare(publicDecimal(maximum));
    if (comparison > 0 || comparison === 0 && !maxInclusive) return false;
  }
  return true;
}

export function evaluatePublicCondition(condition: PublicCondition, scenario: RateScenario, asOf: string): ConditionState {
  if (!FIELDS.has(condition.field)) return 'unknown';
  if (condition.field === 'qualification' || condition.field === 'custom') {
    const qualified = typeof condition.value === 'string' ? scenario[condition.value] : undefined;
    return qualified === true ? 'met' : qualified === false ? 'unmet' : 'unknown';
  }
  const value = condition.field === 'effectiveDate' ? (scenario.effectiveDate ?? asOf.slice(0, 10)) : scenario[condition.field];
  if (value === undefined || value === '') return 'unknown';
  if (NUMERICAL.has(condition.field) && !finiteDecimal(value)) return 'unknown';
  if (condition.operator === 'known') return 'met';
  if (condition.operator === 'eq') {
    if (NUMERICAL.has(condition.field)) return finiteDecimal(condition.value) && typeof value === 'string'
      ? publicDecimal(value).compare(publicDecimal(condition.value)) === 0 ? 'met' : 'unmet' : 'unknown';
    return value === condition.value ? 'met' : 'unmet';
  }
  if (condition.operator === 'in') {
    if (NUMERICAL.has(condition.field)) {
      if (!condition.values?.every(finiteDecimal) || typeof value !== 'string') return 'unknown';
      return condition.values.some(candidate => publicDecimal(value).compare(publicDecimal(candidate as string)) === 0) ? 'met' : 'unmet';
    }
    return condition.values?.includes(value) ? 'met' : 'unmet';
  }
  if (condition.operator === 'bounds' && NUMERICAL.has(condition.field) && typeof value === 'string') {
    try { return bound(publicDecimal(value), condition.minimum, condition.maximum, condition.minimumInclusive, condition.maximumInclusive) ? 'met' : 'unmet'; }
    catch { return 'unknown'; }
  }
  return 'unknown';
}

function assess(conditions: PublicCondition[], context: Context): ConditionState {
  const states = conditions.map(condition => {
    const state = evaluatePublicCondition(condition, context.scenario, context.asOf);
    const prior = context.states.get(condition.conditionId);
    if (prior && JSON.stringify(prior.condition) !== JSON.stringify(condition)) fail('conflicting_condition_identity');
    context.states.set(condition.conditionId, { condition, state });
    return state;
  });
  return states.includes('unmet') ? 'unmet' : states.includes('unknown') ? 'unknown' : 'met';
}

function combine(operands: Evaluation[], subtract: boolean): Evaluation {
  if (operands.length < 2) fail('invalid_formula_arity');
  const ids = operands.flatMap(item => item.components.map(component => component.componentId));
  if (unique(ids).length !== ids.length) fail('component_applied_more_than_once');
  const components = operands.flatMap(item => item.components);
  if (components.some(component => component.role === 'payable') &&
      components.some(component => ['discount', 'margin', 'bonus'].includes(component.role))) fail('net_rate_adjustment_double_count');
  if (components.some(component => component.includedInPayable)) fail('adjustment_already_in_payable');
  if (subtract && (operands.some(item => !item.maximum))) fail('unbounded_range_arithmetic');
  let minimum = operands[0].minimum, maximum = operands[0].maximum;
  for (const item of operands.slice(1)) {
    minimum = subtract ? minimum.sub(item.maximum!) : minimum.add(item.minimum);
    maximum = maximum && item.maximum ? (subtract ? maximum.sub(item.minimum) : maximum.add(item.maximum)) : undefined;
  }
  return { kind: maximum ? (minimum.compare(maximum) === 0 ? 'exact' : 'range') : 'from', minimum, maximum, components,
    reasons: unique(operands.flatMap(item => item.reasons)) };
}

function tiered(formula: Extract<PublicFormula, { op: 'tiered' }>, context: Context, depth: number): Evaluation {
  const raw = context.scenario[formula.field];
  if (!NUMERICAL.has(formula.field) || !finiteDecimal(raw)) fail('tier_input_unknown');
  const value = publicDecimal(raw);
  if (formula.method === 'whole_balance') {
    const applicable = formula.tiers.filter(tier => bound(value, tier.minimum, tier.maximum, tier.minimumInclusive, tier.maximumInclusive));
    if (applicable.length !== 1) fail(applicable.length ? 'overlapping_tiers' : 'no_applicable_tier');
    return evaluate(applicable[0].formula, context, depth + 1);
  }
  if (formula.method !== 'per_tier' || value.compare(PUBLIC_ZERO) <= 0) fail('tier_input_invalid');
  const sorted = [...formula.tiers].sort((a, b) => publicDecimal(a.minimum ?? '0').compare(publicDecimal(b.minimum ?? '0')));
  let accounted = PUBLIC_ZERO, weightedMinimum = PUBLIC_ZERO, weightedMaximum: Decimal | undefined = PUBLIC_ZERO;
  let kind: Evaluation['kind'] = 'exact';
  const components: PublicComponent[] = [], reasons: string[] = [];
  for (const tier of sorted) {
    const minimum = publicDecimal(tier.minimum ?? '0');
    if (minimum.compare(value) >= 0) break;
    if (minimum.compare(accounted) !== 0) fail(minimum.compare(accounted) < 0 ? 'overlapping_tiers' : 'unpriced_balance_gap');
    const declaredMaximum = tier.maximum === undefined ? value : publicDecimal(tier.maximum);
    const maximum = declaredMaximum.compare(value) < 0 ? declaredMaximum : value;
    if (maximum.compare(minimum) <= 0) fail('invalid_tier_bounds');
    const result = evaluate(tier.formula, context, depth + 1), amount = maximum.sub(minimum);
    weightedMinimum = weightedMinimum.add(amount.mul(result.minimum));
    weightedMaximum = weightedMaximum && result.maximum ? weightedMaximum.add(amount.mul(result.maximum)) : undefined;
    if (result.kind === 'from') kind = 'from'; else if (result.kind === 'range' && kind !== 'from') kind = 'range';
    components.push(...result.components); reasons.push(...result.reasons); accounted = maximum;
  }
  if (accounted.compare(value) !== 0) fail('unpriced_balance_gap');
  const minimum = weightedMinimum.div(value), maximum = weightedMaximum?.div(value);
  if (isRecurringDecimal(minimum) || maximum && isRecurringDecimal(maximum)) reasons.push('exact_rate_rational_rounded');
  return { kind, minimum, maximum, components: [...new Map(components.map(component => [component.componentId, component])).values()], reasons: unique(reasons) };
}

function evaluate(formula: PublicFormula, context: Context, depth = 0): Evaluation {
  if (!formula || typeof formula !== 'object' || depth > 16 || ++context.nodes > 256) fail('unsupported_formula');
  if (formula.op === 'component') {
    const matches = context.programme.components.filter(component => component.componentId === formula.componentId);
    if (matches.length !== 1) fail('component_missing_or_ambiguous');
    const component = matches[0];
    if (!ROLES.has(component.role) || component.role === 'comparison') fail('unsupported_component_role');
    if (component.scopeId !== context.programme.offerId) fail('component_scope_mismatch');
    const state = assess(component.conditions, context);
    if (state !== 'met') fail(state === 'unmet' ? 'component_condition_unmet' : 'component_condition_unknown');
    if (component.value === undefined) fail('component_value_missing');
    const value = rateDecimal(component.value, component.unit);
    return { kind: 'exact', minimum: value, maximum: value, components: [component], reasons: [] };
  }
  if (formula.op === 'add' || formula.op === 'subtract') return combine(formula.operands.map(operand => evaluate(operand, context, depth + 1)), formula.op === 'subtract');
  if (formula.op === 'alternatives') {
    const choices = formula.choices.map(choice => ({ ...choice, state: assess(choice.conditions, context) }));
    if (choices.some(choice => choice.state === 'unknown')) fail('alternative_condition_unknown');
    const matches = choices.filter(choice => choice.state === 'met');
    if (matches.length !== 1) fail(matches.length ? 'ambiguous_pricing_alternative' : 'no_applicable_alternative');
    return evaluate(matches[0].formula, context, depth + 1);
  }
  if (formula.op === 'tiered') return tiered(formula, context, depth);
  if (formula.op === 'cap') {
    const result = evaluate(formula.formula, context, depth + 1), cap = publicDecimal(formula.value);
    return { ...result, minimum: result.minimum.compare(cap) > 0 ? cap : result.minimum,
      maximum: result.maximum ? (result.maximum.compare(cap) > 0 ? cap : result.maximum) : cap,
      kind: result.minimum.compare(cap) >= 0 ? 'exact' : result.kind === 'from' ? 'range' : result.kind };
  }
  if (formula.op === 'from') {
    const result = evaluate(formula.formula, context, depth + 1);
    if (result.kind !== 'exact') fail('invalid_minimum_formula');
    return { ...result, kind: 'from', maximum: undefined };
  }
  if (formula.op === 'range') {
    const minimum = evaluate(formula.minimum, context, depth + 1), maximum = evaluate(formula.maximum, context, depth + 1);
    if (minimum.kind !== 'exact' || maximum.kind !== 'exact' || minimum.minimum.compare(maximum.minimum) > 0) fail('invalid_published_range');
    return { kind: 'range', minimum: minimum.minimum, maximum: maximum.minimum,
      components: [...new Map([...minimum.components, ...maximum.components].map(item => [item.componentId, item])).values()], reasons: unique([...minimum.reasons, ...maximum.reasons]) };
  }
  return fail('unsupported_formula');
}

export function publicRateFreshness(freshness: PublicFreshness, asOf: string): PublicFreshness {
  const now = Date.parse(asOf), lastSuccess = Date.parse(freshness.lastSuccessAt ?? '');
  if (!Number.isFinite(now) || !Number.isFinite(lastSuccess)) return { ...freshness, state: 'unknown', reasonCodes: unique([...freshness.reasonCodes, 'successful_source_check_unavailable']) };
  if (lastSuccess > now) return { ...freshness, state: 'unknown', reasonCodes: unique([...freshness.reasonCodes, 'future_source_check']) };
  if (now - lastSuccess > STALE_MS) return { ...freshness, state: 'stale', reasonCodes: unique([...freshness.reasonCodes, 'source_check_older_than_48_hours']) };
  return { ...freshness, reasonCodes: [...freshness.reasonCodes] };
}

/** Earliest wall-clock boundary that can change a current programme result.
 * Consumers may reuse resolved values only until this boundary, not a UTC-day
 * approximation of the rolling source-freshness window. */
export function nextPublicPricingBoundary(programme: PublicProgramme, atMs: number): number {
  const last = Date.parse(programme.freshness.lastSuccessAt ?? '');
  if (!Number.isFinite(atMs) || !Number.isFinite(last) || programme.freshness.state !== 'current') return Infinity;
  const expiry = last + STALE_MS + 1; // Freshness is stale strictly after 48h.
  if (atMs >= expiry) return Infinity;
  const from = programme.effectiveFrom == null ? -Infinity : Date.parse(programme.effectiveFrom);
  const to = programme.effectiveTo == null ? Infinity : Date.parse(programme.effectiveTo);
  if (Number.isNaN(from) || Number.isNaN(to) || atMs >= to) return Infinity;
  // effectiveDate conditions can use the UTC date when no date was entered.
  const nextDay = (Math.floor(atMs / 86_400_000) + 1) * 86_400_000;
  return Math.min(expiry, nextDay, last > atMs ? last : Infinity, from > atMs ? from : Infinity, to);
}

function validPeriod(programme: PublicProgramme, asOf: string): boolean {
  const now = Date.parse(asOf);
  if (!Number.isFinite(now)) fail('invalid_resolution_date');
  const from = programme.effectiveFrom === undefined ? undefined : Date.parse(programme.effectiveFrom);
  const to = programme.effectiveTo === undefined ? undefined : Date.parse(programme.effectiveTo);
  if (from !== undefined && !Number.isFinite(from) || to !== undefined && !Number.isFinite(to)) fail('invalid_effective_period');
  if (from !== undefined && now < from) fail('programme_not_yet_effective');
  if (to !== undefined && now >= to) fail('programme_expired');
  return true;
}

function amounts(result: Evaluation): Pick<RateResolution, 'status' | 'payableRate' | 'minimumRate' | 'maximumRate'> {
  if (result.minimum.compare(PUBLIC_ZERO) < 0 || result.minimum.compare(PUBLIC_ONE) > 0 || result.maximum && (result.maximum.compare(PUBLIC_ONE) > 0 || result.maximum.compare(result.minimum) < 0)) fail('payable_rate_out_of_bounds');
  const rounded = [result.minimum, ...(result.maximum ? [result.maximum] : [])].some(value => value.compare(publicDecimal(decimalText(value))) !== 0);
  if (rounded) result.reasons = unique([...result.reasons, 'exact_rate_rational_rounded']);
  if (result.minimum.compare(PUBLIC_ZERO) > 0 && publicDecimal(decimalText(result.minimum)).compare(PUBLIC_ZERO) === 0) fail('rate_precision_unsupported');
  if (result.kind === 'exact') return { status: 'exact', payableRate: decimalText(result.minimum) };
  return { status: result.kind, minimumRate: decimalText(result.minimum), ...(result.maximum ? { maximumRate: decimalText(result.maximum) } : {}) };
}

/** The only public rate resolver. Eligibility, units, freshness and scope fail closed. */
export function resolvePublicRate(programme: PublicProgramme, scenario: RateScenario, asOf: string): RateResolution {
  const context: Context = { programme, scenario, asOf, states: new Map(), nodes: 0 };
  const freshness = publicRateFreshness(programme.freshness, asOf);
  const base: RateResolution = { status: 'unresolved', appliedComponents: [], phases: [], conditions: { met: [], unmet: [], unknown: [] },
    reasonCodes: unique([...programme.reasonCodes, ...freshness.reasonCodes]), evidenceIds: [...programme.evidenceIds],
    ...(programme.effectiveFrom ? { effectiveFrom: programme.effectiveFrom } : {}), ...(programme.effectiveTo ? { effectiveTo: programme.effectiveTo } : {}),
    freshness, verifiedCurrent: false, origin: 'published' };
  try {
    if (programme.schemaVersion !== 1) fail('unsupported_programme_schema');
    validPeriod(programme, asOf);
    if (!programme.formula) fail('pricing_formula_unavailable');
    const eligibility = assess(programme.conditions, context);
    if (eligibility === 'unmet') fail('programme_condition_unmet');
    if (eligibility === 'unknown') {
      const assessed = [...context.states.values()].filter(item => item.state === 'unknown');
      const assessmentRange = ['from', 'range'].includes(programme.formula.op) && programme.reasonCodes.includes('lender_assessment_required') &&
        assessed.every(item => item.condition.field === 'customerCategory' && item.condition.operator === 'known');
      if (!assessmentRange) fail('programme_condition_unknown');
    }
    if (freshness.state !== 'current' && !scenario.allowHistorical) fail('source_not_verified_current');
    const result = evaluate(programme.formula, context);
    if (!result.components.some(component => ['payable', 'reference', 'reversion'].includes(component.role))) fail('adjustment_without_base');
    if (!programme.evidenceIds.length || result.components.some(component => !component.evidenceIds.length)) fail('pricing_evidence_unbound');
    Object.assign(base, amounts(result));
    base.appliedComponents = result.components;
    base.origin = ['component', 'from', 'range'].includes(programme.formula.op) && result.components.every(component => component.role === 'payable') ? 'published' : 'publicly_calculated';
    base.reasonCodes = unique([...base.reasonCodes, ...result.reasons, ...(freshness.state !== 'current' ? ['historical_scenario_selected'] : [])]);
    base.evidenceIds = unique([...base.evidenceIds, ...result.components.flatMap(item => item.evidenceIds)]);
    base.verifiedCurrent = freshness.state === 'current' && eligibility !== 'unknown';
    const comparisons = programme.components.filter(component => component.role === 'comparison' && component.scopeId === programme.offerId && component.value !== undefined &&
      component.conditions.every(condition => evaluatePublicCondition(condition, scenario, asOf) === 'met'));
    if (comparisons.length === 1) {
      try {
        const comparison = rateDecimal(comparisons[0].value!, comparisons[0].unit);
        if (comparison.compare(PUBLIC_ZERO) < 0 || comparison.compare(PUBLIC_ONE) > 0) base.reasonCodes.push('comparison_rate_out_of_bounds');
        else base.comparisonRate = decimalText(comparison);
      } catch { base.reasonCodes.push('comparison_rate_invalid'); }
    }
    if (comparisons.length > 1) base.reasonCodes.push('comparison_rate_conflicting');
    let previousEnd = 0;
    for (const phase of programme.phases ?? []) {
      const resolved: ResolvedPhase = { phaseId: phase.phaseId, startMonth: phase.startMonth, ...(phase.endMonth !== undefined ? { endMonth: phase.endMonth } : {}), status: 'unresolved', reasonCodes: [], evidenceIds: [...phase.evidenceIds] };
      try {
        if (!Number.isInteger(phase.startMonth) || phase.startMonth < previousEnd || phase.endMonth !== undefined && (!Number.isInteger(phase.endMonth) || phase.endMonth <= phase.startMonth)) fail('invalid_phase_schedule');
        previousEnd = phase.endMonth ?? Number.POSITIVE_INFINITY;
        const state = assess(phase.conditions, context);
        if (state !== 'met') fail(state === 'unknown' ? 'phase_condition_unknown' : 'phase_condition_unmet');
        const evaluated = evaluate(phase.formula, context); Object.assign(resolved, amounts(evaluated));
        resolved.evidenceIds = unique([...resolved.evidenceIds, ...evaluated.components.flatMap(item => item.evidenceIds)]); resolved.reasonCodes = evaluated.reasons;
      } catch (error) { resolved.reasonCodes.push(error instanceof Error ? error.message : 'phase_unresolved'); }
      base.phases.push(resolved);
    }
  } catch (error) { base.reasonCodes = unique([...base.reasonCodes, error instanceof Error ? error.message : 'pricing_unresolved']); }
  for (const { condition, state } of context.states.values()) base.conditions[state].push(condition);
  return base;
}

/** Membership helper keeps open-ended bounds intact; a product MAX_LVR is a separate predicate. */
export function publicTierMatches(tier: PublicTier, value: string): boolean {
  return bound(publicDecimal(value), tier.minimum, tier.maximum, tier.minimumInclusive, tier.maximumInclusive);
}
