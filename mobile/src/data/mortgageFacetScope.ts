import { canonicalPurpose, canonicalRepayment } from './mortgageFacets';

export type MortgageFacetKey = 'loanPurposes' | 'repaymentTypes';

/** App-only choice visibility; preserve source tokens and pinned pricing semantics. */
export function isWidelyAvailableMortgageFacet(key: MortgageFacetKey, value: string): boolean {
  const meaning = key === 'loanPurposes' ? canonicalPurpose(value) : canonicalRepayment(value);
  const token = meaning?.toUpperCase();
  return key === 'loanPurposes'
    ? token === 'OWNER_OCCUPIED' || token === 'INVESTMENT' || token === 'OWNER_OCCUPIER' || token === 'INVESTOR'
    : token === 'PRINCIPAL_AND_INTEREST' || token === 'INTEREST_ONLY' || token === 'PRINCIPAL_INTEREST';
}

export function scopeMortgageFacets<T extends Record<MortgageFacetKey, string[]>>(
  filters: T, includeNonStandard: boolean,
): T {
  if (includeNonStandard) return filters;
  const loanPurposes = filters.loanPurposes.filter(value => isWidelyAvailableMortgageFacet('loanPurposes', value));
  const repaymentTypes = filters.repaymentTypes.filter(value => isWidelyAvailableMortgageFacet('repaymentTypes', value));
  return loanPurposes.length === filters.loanPurposes.length && repaymentTypes.length === filters.repaymentTypes.length
    ? filters : { ...filters, loanPurposes, repaymentTypes };
}
