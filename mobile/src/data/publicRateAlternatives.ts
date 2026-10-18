import type { PublicProgramme, RateScenario } from './publicRateModel';
import { resolvePublicRate } from './publicRateResolver';

// Local UI alternatives never enter source evidence, URLs, or persisted scenarios.
const alternatives = new WeakMap<RateScenario, { purposes: string[]; repayments: string[] }>();
export function withMortgageAlternatives(scenario: RateScenario, purposes: string[], repayments: string[]): RateScenario {
  alternatives.set(scenario, { purposes, repayments });
  return scenario;
}
/** A semantic offer must identify one applicable facet combination, never a first price. */
export function scenarioForPublicProgramme(programme: PublicProgramme, scenario: RateScenario, asOf: string): RateScenario | undefined {
  const options = alternatives.get(scenario);
  if (!options) return scenario;
  const fields = new Set<string>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const object = value as Record<string, unknown>;
    if (typeof object.field === 'string') fields.add(object.field);
    Object.values(object).forEach(visit);
  };
  visit(programme);
  const purposes = fields.has('purpose') && options.purposes.length ? options.purposes : [scenario.purpose];
  const repayments = fields.has('repayment') && options.repayments.length ? options.repayments : [scenario.repayment];
  const matches: RateScenario[] = [];
  for (const purpose of purposes) for (const repayment of repayments) {
    const candidate = { ...scenario, purpose, repayment,
      profileLoanPurpose: purpose, profileRepayment: repayment };
    const resolution = resolvePublicRate(programme, candidate, asOf);
    if (resolution.status === 'exact' && resolution.verifiedCurrent && resolution.payableRate != null) matches.push(candidate);
  }
  return matches.length === 1 ? matches[0] : undefined;
}
