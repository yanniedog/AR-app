import { withMortgageAlternatives } from './publicRateAlternatives';
import { canonicalPurpose, canonicalRepayment } from './mortgageFacets';
import { publicRateScenario } from './publicRateIntegration';
import { normalizeProfileFilters } from './profile';
import type { Filters } from './selectors';
import type { SectionKey } from '../types';
import { calculatorAmount, calculatorRateFraction, MAX_CALCULATOR_MORTGAGE_AMOUNT } from './calc';
import type { MortgageComparisonInputs } from './mortgageComparison';
import type { RateScenario } from './publicRateModel';

/** Ephemeral comparison inputs override pricing assumptions without saving them. */
export function mortgageComparisonScenario(section: SectionKey, scenario: RateScenario,
  inputs: MortgageComparisonInputs, temporary?: Pick<Filters, 'loanPurposes' | 'repaymentTypes'>): RateScenario {
  if (section !== 'Mortgage') return scenario;
  const result = { ...scenario };
  if (temporary) {
    const unique = (values: string[], canonical: (value?: string) => string | undefined) =>
      [...new Map(values.map(value => [canonical(value), value])).values()];
    const facets = publicRateScenario('Mortgage', undefined, normalizeProfileFilters({
      loanPurposes: unique(temporary.loanPurposes, canonicalPurpose),
      repaymentTypes: unique(temporary.repaymentTypes, canonicalRepayment),
    }));
    if (temporary.loanPurposes.length) {
      result.purpose = facets.purpose; result.profileLoanPurpose = facets.profileLoanPurpose;
    }
    if (temporary.repaymentTypes.length) {
      result.repayment = facets.repayment; result.profileRepayment = facets.profileRepayment;
    }
  }
  if (inputs.loanAmount.trim()) {
    const amount = calculatorAmount(inputs.loanAmount, MAX_CALCULATOR_MORTGAGE_AMOUNT);
    result.amount = amount != null && amount > 0 ? String(amount) : undefined;
  }
  if (inputs.lvr.trim()) {
    const lvr = calculatorRateFraction(inputs.lvr);
    result.lvr = lvr != null ? String(lvr) : undefined;
  }
  const purposes = [...new Set((temporary?.loanPurposes ?? []).map(canonicalPurpose))]
    .filter((value): value is string => value === 'OWNER_OCCUPIED' || value === 'INVESTMENT');
  const repayments = [...new Set((temporary?.repaymentTypes ?? []).map(canonicalRepayment))]
    .filter((value): value is string => value === 'PRINCIPAL_AND_INTEREST' || value === 'INTEREST_ONLY');
  return purposes.length > 1 || repayments.length > 1
    ? withMortgageAlternatives(result, purposes, repayments) : result;
}
