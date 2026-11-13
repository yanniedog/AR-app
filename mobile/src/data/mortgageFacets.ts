export function canonicalPurpose(value?: string): string | undefined {
  const key = value?.toUpperCase();
  return key === 'OO' || key === 'OWNER_OCCUPIED' ? 'OWNER_OCCUPIED'
    : key === 'INV' || key === 'INVESTMENT' ? 'INVESTMENT' : value;
}

export function canonicalRepayment(value?: string): string | undefined {
  const key = value?.toUpperCase();
  return key === 'PI' || key === 'P&I' || key === 'PRINCIPAL_AND_INTEREST' ? 'PRINCIPAL_AND_INTEREST'
    : key === 'IO' || key === 'INTEREST_ONLY' ? 'INTEREST_ONLY' : value;
}

/** Recognised aliases share meaning; unknown values retain exact matching. */
export function matchesMortgageFacet(value: string | undefined, selected: readonly string[], field: 'purpose' | 'repayment'): boolean {
  const canonical = field === 'purpose' ? canonicalPurpose : canonicalRepayment;
  return selected.length === 0 || (value !== undefined && selected.some(item => canonical(item) === canonical(value)));
}

export type MortgageFacetKey = 'loanPurposes' | 'repaymentTypes';

/** Broad-market controls offer concrete customer choices, never evidence placeholders. */
export function isWidelyAvailableMortgageFacet(key: MortgageFacetKey, value: string): boolean {
  const meaning = key === 'loanPurposes' ? canonicalPurpose(value) : canonicalRepayment(value);
  return key === 'loanPurposes'
    ? meaning === 'OWNER_OCCUPIED' || meaning === 'INVESTMENT'
    : meaning === 'PRINCIPAL_AND_INTEREST' || meaning === 'INTEREST_ONLY';
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
