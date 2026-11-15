import { withMortgageAlternatives } from './publicRateAlternatives';
import { canonicalPurpose, canonicalRepayment } from './mortgageFacets';
import { publicRateScenario } from './publicRateIntegration';
import { normalizeProfileFilters } from './profile';
import type { Filters } from './selectors';
import type { SectionKey } from '../types';
import { calculatorAmount, calculatorRateFraction, MAX_CALCULATOR_MORTGAGE_AMOUNT } from './calc';
import type { MortgageComparisonInputs } from './mortgageComparison';
import { mortgageComparisonInputsInvalid, mortgageComparisonValues } from './mortgageComparison';
import type { RateScenario } from './publicRateModel';
import { attachExactPublicLvr, clearExactPublicLvr } from './publicScenarioLvr';

export const DEFAULT_MORTGAGE_BROWSE_INPUTS: MortgageComparisonInputs = { loanAmount: '', lvr: '80' };
export const DEFAULT_MORTGAGE_BROWSE_FACETS: Pick<Filters, 'loanPurposes' | 'repaymentTypes'> = {
  loanPurposes: ['OWNER_OCCUPIED'],
  repaymentTypes: ['PRINCIPAL_AND_INTEREST'],
};

/** Derives cold-launch default mortgage browse assumptions when comparison inputs and facets are both empty. */
export function effectiveMortgageBrowseAssumptions(
  section: SectionKey,
  inputs: MortgageComparisonInputs,
  filters: Pick<Filters, 'loanPurposes' | 'repaymentTypes'>,
): {
  isDefaultBrowse: boolean;
  inputsInvalid: boolean;
  inputs: MortgageComparisonInputs;
  facets: Pick<Filters, 'loanPurposes' | 'repaymentTypes'>;
  pricingFacets: Pick<Filters, 'loanPurposes' | 'repaymentTypes'>;
} {
  const pricingFacets: Pick<Filters, 'loanPurposes' | 'repaymentTypes'> = {
    loanPurposes: filters.loanPurposes.length ? filters.loanPurposes : DEFAULT_MORTGAGE_BROWSE_FACETS.loanPurposes,
    repaymentTypes: filters.repaymentTypes.length ? filters.repaymentTypes : DEFAULT_MORTGAGE_BROWSE_FACETS.repaymentTypes,
  };
  if (section !== 'Mortgage') {
    return { isDefaultBrowse: false, inputsInvalid: false, inputs, facets: filters, pricingFacets };
  }
  const inputsInvalid = mortgageComparisonInputsInvalid(inputs);
  const inputsEmpty = !inputs.loanAmount.trim()
    && !inputs.lvr.trim()
    && !(inputs.fundsAvailable ?? '').trim()
    && !(inputs.propertyValue ?? '').trim();
  const facetsEmpty = filters.loanPurposes.length === 0 && filters.repaymentTypes.length === 0;
  const isDefaultBrowse = inputsEmpty && facetsEmpty && !inputsInvalid;
  return {
    isDefaultBrowse,
    inputsInvalid,
    inputs: isDefaultBrowse ? DEFAULT_MORTGAGE_BROWSE_INPUTS : inputs,
    facets: isDefaultBrowse ? DEFAULT_MORTGAGE_BROWSE_FACETS : filters,
    pricingFacets,
  };
}

/** Resolves the effective Rates comparison scenario including cold-launch browse defaults for product/compare/receipt routes. */
export function ratesComparisonScenario(
  section: SectionKey,
  scenario: RateScenario,
  inputs: MortgageComparisonInputs,
  temporary?: Pick<Filters, 'loanPurposes' | 'repaymentTypes'>,
): RateScenario {
  if (section !== 'Mortgage') return scenario;
  const effective = effectiveMortgageBrowseAssumptions(
    section,
    inputs,
    temporary ?? { loanPurposes: [], repaymentTypes: [] },
  );
  return mortgageComparisonScenario(section, scenario, effective.inputs, effective.facets);
}

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
  if (inputs.lvrMode === 'funds') {
    const values = mortgageComparisonValues(inputs);
    // Funds mode owns both dimensions, even before all required fields exist.
    // Missing/invalid values must not inherit a saved property's assumptions.
    result.amount = values.lvrFraction !== undefined ? String(values.amount) : undefined;
    result.lvr = values.lvrFraction;
    result.offsetBalance = values.offsetBalance !== null ? String(values.offsetBalance) : undefined;
    clearExactPublicLvr(result);
    if (values.lvrFraction !== undefined) attachExactPublicLvr(result, String(values.amount), String(values.propertyValue));
  } else if (inputs.loanAmount.trim()) {
    const amount = calculatorAmount(inputs.loanAmount, MAX_CALCULATOR_MORTGAGE_AMOUNT);
    result.amount = amount != null && amount > 0 ? String(amount) : undefined;
  }
  if (inputs.lvrMode !== 'funds' && (inputs.lvrMode === 'lvr' || inputs.loanAmount.trim() || inputs.lvr.trim())) {
    clearExactPublicLvr(result);
    // Once direct comparison is active, a blank LVR is missing, not permission
    // to borrow the saved property's ratio. An untouched legacy reset retains
    // the existing saved-scenario behaviour for non-comparison consumers.
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
