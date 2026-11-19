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

/** Each missing Mortgage criterion keeps its default (Owner occupied,
 * Principal & interest, LVR 80%) until the user replaces it, so entering only
 * a loan amount never empties the list. Invalid inputs receive no defaults. */
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
  if (inputsInvalid) return { isDefaultBrowse: false, inputsInvalid, inputs, facets: filters, pricingFacets };
  const inputsEmpty = !inputs.loanAmount.trim()
    && !inputs.lvr.trim()
    && !(inputs.fundsAvailable ?? '').trim()
    && !(inputs.propertyValue ?? '').trim();
  const values = mortgageComparisonValues(inputs);
  const effectiveInputs: MortgageComparisonInputs = inputsEmpty ? DEFAULT_MORTGAGE_BROWSE_INPUTS
    : values.lvrFraction !== undefined ? inputs
      // A partially entered funds scenario keeps its known ratio; otherwise 80%.
      : { loanAmount: inputs.loanAmount, lvr: values.lvr !== null ? String(values.lvr) : DEFAULT_MORTGAGE_BROWSE_INPUTS.lvr, lvrMode: 'lvr' };
  const isDefaultBrowse = effectiveInputs !== inputs
    || pricingFacets.loanPurposes !== filters.loanPurposes || pricingFacets.repaymentTypes !== filters.repaymentTypes;
  return { isDefaultBrowse, inputsInvalid, inputs: effectiveInputs, facets: pricingFacets, pricingFacets };
}

export type MortgageComparisonField = 'Loan amount' | 'LVR' | 'Deposit' | 'Offset balance' | 'Property value';

/** The first entered value that prevents a comparison, if any. */
export function invalidMortgageComparisonField(inputs: MortgageComparisonInputs): MortgageComparisonField | null {
  const invalidMoney = (text: string | undefined, minimum = 0) => {
    const value = (text ?? '').trim();
    if (!value) return false;
    const amount = calculatorAmount(value, MAX_CALCULATOR_MORTGAGE_AMOUNT);
    return amount === null || amount <= minimum;
  };
  if (invalidMoney(inputs.loanAmount)) return 'Loan amount';
  if (inputs.lvrMode === 'funds') {
    if (invalidMoney(inputs.fundsAvailable, -1)) return inputs.fundsType === 'offset' ? 'Offset balance' : 'Deposit';
    if (inputs.fundsType === 'offset' && mortgageComparisonInputsInvalid(inputs)) return 'Property value';
    return null;
  }
  return mortgageComparisonInputsInvalid(inputs) ? 'LVR' : null;
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
  // Funds-mode pricing must retain explicitly missing inputs, even when Rates
  // can use a fallback LVR to display products.
  const pricingInputs = inputs.lvrMode === 'funds' ? inputs : effective.inputs;
  return mortgageComparisonScenario(section, scenario, pricingInputs, effective.facets);
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
