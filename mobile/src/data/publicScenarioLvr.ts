import { Decimal, PUBLIC_ZERO, decimalText, publicDecimal } from './publicRateDecimal';
import type { RateScenario } from './publicRateModel';

interface ExactLvr { amount: Decimal; property: Decimal; ratio: Decimal }
const checked = new WeakMap<RateScenario, { fields: readonly unknown[]; value: ExactLvr | null }>();

/** Private arithmetic inputs, not published evidence. Strings survive scenario
 * spreads/JSON snapshots; no BigInt or process-local handle enters the state. */
export function attachExactPublicLvr(scenario: RateScenario, amount: string, property: string): void {
  const loan = Decimal.parse(amount), value = Decimal.parse(property);
  if (loan.compare(PUBLIC_ZERO) <= 0 || value.compare(PUBLIC_ZERO) <= 0) throw new Error('invalid_lvr_ratio');
  scenario.amount = decimalText(loan);
  scenario.lvr = decimalText(loan.div(value));
  scenario.lvrSourceAmount = decimalText(loan);
  scenario.lvrPropertyValue = decimalText(value);
}

export function clearExactPublicLvr(scenario: RateScenario): void {
  delete scenario.lvrSourceAmount;
  delete scenario.lvrPropertyValue;
  checked.delete(scenario);
}

/** Accept metadata only for the current principal and transported ratio.
 * Mutable callers are rechecked, while immutable per-row scenarios validate
 * once across all programme predicates instead of repeating rational division. */
export function exactPublicScenarioLvr(scenario: RateScenario): ExactLvr | null {
  if (scenario.lvrSourceAmount === undefined && scenario.lvrPropertyValue === undefined) return null;
  const fields = [scenario.amount, scenario.lvr, scenario.lvrSourceAmount, scenario.lvrPropertyValue];
  const prior = checked.get(scenario);
  if (prior && fields.every((value, index) => Object.is(value, prior.fields[index]))) return prior.value;
  let value: ExactLvr | null = null;
  try {
    if (fields.every(item => typeof item === 'string')) {
      const amount = Decimal.parse(scenario.lvrSourceAmount as string), property = Decimal.parse(scenario.lvrPropertyValue as string);
      if (amount.compare(PUBLIC_ZERO) > 0 && property.compare(PUBLIC_ZERO) > 0
        && amount.compare(Decimal.parse(scenario.amount!)) === 0) {
        const ratio = amount.div(property);
        if (Decimal.parse(decimalText(ratio)).compare(Decimal.parse(scenario.lvr!)) === 0) value = { amount, property, ratio };
      }
    }
  } catch { /* Malformed metadata cannot override the ordinary scenario value. */ }
  checked.set(scenario, { fields, value });
  return value;
}

/** Conditions and LVR-based formulas share the exact active ratio. Direct
 * entry remains the supplied decimal, including when old metadata is stale. */
export function publicScenarioLvr(scenario: RateScenario): Decimal | null {
  const exact = exactPublicScenarioLvr(scenario);
  if (exact) return exact.ratio;
  try { return typeof scenario.lvr === 'string' ? publicDecimal(scenario.lvr) : null; } catch { return null; }
}

/** Same displayed fraction can describe a finite manual input or a repeating
 * funds ratio. Formula caches must not conflate those distinct numeric inputs. */
export function publicScenarioLvrKey(scenario: RateScenario): readonly ['ratio', string, string] | readonly ['value', string | undefined] {
  const exact = exactPublicScenarioLvr(scenario);
  return exact ? ['ratio', String(exact.ratio.n), String(exact.ratio.d)] : ['value', scenario.lvr];
}
