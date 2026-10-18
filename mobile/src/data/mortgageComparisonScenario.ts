import type { SectionKey } from '../types';
import { calculatorAmount, calculatorRateFraction, MAX_CALCULATOR_MORTGAGE_AMOUNT } from './calc';
import type { MortgageComparisonInputs } from './mortgageComparison';
import type { RateScenario } from './publicRateModel';

/** Ephemeral comparison inputs override pricing assumptions without saving them. */
export function mortgageComparisonScenario(section: SectionKey, scenario: RateScenario,
  inputs: MortgageComparisonInputs): RateScenario {
  if (section !== 'Mortgage') return scenario;
  const result = { ...scenario };
  if (inputs.loanAmount.trim()) {
    const amount = calculatorAmount(inputs.loanAmount, MAX_CALCULATOR_MORTGAGE_AMOUNT);
    result.amount = amount != null && amount > 0 ? String(amount) : undefined;
  }
  if (inputs.lvr.trim()) {
    const lvr = calculatorRateFraction(inputs.lvr);
    result.lvr = lvr != null ? String(lvr) : undefined;
  }
  return result;
}
