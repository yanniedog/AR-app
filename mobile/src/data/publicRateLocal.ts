import { PUBLIC_ONE, PUBLIC_ZERO, decimalText, rateDecimal } from './publicRateDecimal';
import type { PublicReferenceRate, RateResolution, RateScenario } from './publicRateModel';
import { evaluatePublicCondition, publicRateFreshness } from './publicRateResolver';

const local = (origin: RateResolution['origin']): RateResolution => ({ status: 'unresolved', appliedComponents: [], phases: [], conditions: { met: [], unmet: [], unknown: [] },
  evidenceIds: [], reasonCodes: [], freshness: { state: 'unknown', reasonCodes: ['local_input'] }, verifiedCurrent: false, origin });

/** Select one temporal observation of an explicitly chosen semantic family. */
export function selectPublicReference(references: readonly PublicReferenceRate[], referenceId: string, asOf: string): { reference?: PublicReferenceRate; reasonCodes: string[] } {
  const now = Date.parse(asOf);
  if (!Number.isFinite(now)) return { reasonCodes: ['invalid_as_of'] };
  const matching = references.filter(reference => reference.referenceId === referenceId);
  if (!matching.length) return { reasonCodes: ['selected_reference_unavailable'] };
  const dated = matching.map(reference => ({ reference, from: reference.effectiveFrom ? Date.parse(reference.effectiveFrom) : -Infinity,
    to: reference.effectiveTo ? Date.parse(reference.effectiveTo) : Infinity }));
  if (dated.some(item => Number.isNaN(item.from) || Number.isNaN(item.to) || item.from >= item.to)) return { reasonCodes: ['reference_effective_period_invalid'] };
  const active = dated.filter(item => item.from <= now && now < item.to);
  if (active.length > 1) return { reasonCodes: ['source_conflict'] };
  if (active.length === 1) return { reference: active[0].reference, reasonCodes: [] };
  return { reasonCodes: [dated.some(item => item.from > now) ? 'reference_not_yet_effective' : 'reference_effective_period_ended'] };
}

/** Local text syntax only: units always remain percentage points. Source decimals stay strict. */
export function normalizeLocalPercentageInput(value: string): string {
  if (typeof value !== 'string' || value.length > 128) throw new Error('invalid_local_percentage');
  let cleaned = value.trim().replace(/\s*%$/, '').trim();
  if (!/^[+-]?(?:\d+(?:\.\d{0,24})?|\.\d{1,24})$/.test(cleaned)) throw new Error('invalid_local_percentage');
  cleaned = cleaned.replace(/^\+/, '').replace(/^(-?)\./, '$10.');
  const negative = cleaned.startsWith('-'), unsigned = negative ? cleaned.slice(1) : cleaned;
  const [whole, fraction] = unsigned.split('.');
  return (negative ? '-' : '') + (whole.replace(/^0+(?=\d)/, '') || '0') + (fraction ? '.' + fraction : '');
}

/** User percentages are local assumptions, never a publicly verified customer rate. */
export function estimateEnteredRate(value: string): RateResolution {
  const result = local('user_entered');
  try {
    const rate = rateDecimal(normalizeLocalPercentageInput(value), 'percentage_points');
    if (rate.compare(PUBLIC_ZERO) < 0 || rate.compare(PUBLIC_ONE) > 0) throw new Error('local_rate_out_of_bounds');
    result.status = 'exact'; result.payableRate = decimalText(rate); result.reasonCodes = ['user_entered_rate'];
  } catch (error) { result.reasonCodes = [error instanceof Error ? error.message : 'invalid_local_rate']; }
  return result;
}

/** A signed total percentage-point adjustment replaces all public adjustments. */
export function estimateReferenceAdjustment(reference: PublicReferenceRate, totalAdjustment: string, asOf: string, allowHistorical = false, scenario: RateScenario = {}): RateResolution {
  const result = local('locally_calculated');
  result.freshness = publicRateFreshness(reference.freshness, asOf);
  result.evidenceIds = [...new Set([...reference.evidenceIds, ...(reference.conditions ?? []).flatMap(condition => condition.evidenceIds)])];
  result.effectiveFrom = reference.effectiveFrom; result.effectiveTo = reference.effectiveTo;
  for (const condition of reference.conditions ?? []) result.conditions[evaluatePublicCondition(condition, scenario, asOf)].push(condition);
  try {
    const now = Date.parse(asOf);
    if (!Number.isFinite(now)) throw new Error('invalid_as_of');
    if (reference.effectiveFrom && (!Number.isFinite(Date.parse(reference.effectiveFrom)) || now < Date.parse(reference.effectiveFrom))) throw new Error('reference_not_yet_effective');
    if (reference.effectiveTo && (!Number.isFinite(Date.parse(reference.effectiveTo)) || now >= Date.parse(reference.effectiveTo))) throw new Error('reference_effective_period_ended');
    if (result.conditions.unmet.length) throw new Error('reference_conditions_unmet');
    if (result.conditions.unknown.length) throw new Error('reference_conditions_unknown');
    if (result.freshness.state !== 'current' && !allowHistorical) throw new Error('reference_not_verified_current');
    if (reference.value === undefined) throw new Error('reference_value_missing');
    const rate = rateDecimal(reference.value, reference.unit).add(rateDecimal(normalizeLocalPercentageInput(totalAdjustment), 'percentage_points'));
    if (rate.compare(PUBLIC_ZERO) < 0 || rate.compare(PUBLIC_ONE) > 0) throw new Error('local_rate_out_of_bounds');
    result.status = 'exact'; result.payableRate = decimalText(rate);
    result.reasonCodes = ['local_total_adjustment', ...(result.freshness.state === 'current' ? [] : ['historical_scenario_selected'])];
  } catch (error) { result.reasonCodes = [error instanceof Error ? error.message : 'invalid_local_adjustment']; }
  return result;
}
