export function canonicalPurpose(value?: string): string | undefined {
  const key = value?.toUpperCase();
  return key === 'OO' || key === 'OWNER_OCCUPIED' ? 'OWNER_OCCUPIED'
    : key === 'INV' || key === 'INVESTMENT' ? 'INVESTMENT' : value;
}

export function canonicalRepayment(value?: string): string | undefined {
  const key = value?.toUpperCase();
  return key === 'PI' || key === 'P&I' || key === 'PRINCIPAL_INTEREST' || key === 'PRINCIPAL_AND_INTEREST' ? 'PRINCIPAL_AND_INTEREST'
    : key === 'IO' || key === 'INTEREST_ONLY' ? 'INTEREST_ONLY' : value;
}

/** Recognised aliases share meaning; unknown values retain exact matching. */
export function matchesMortgageFacet(value: string | undefined, selected: readonly string[], field: 'purpose' | 'repayment'): boolean {
  const canonical = field === 'purpose' ? canonicalPurpose : canonicalRepayment;
  return selected.length === 0 || (value !== undefined && selected.some(item => canonical(item) === canonical(value)));
}

/** Keep equivalent ribbon keys for saved filters, but never override the source meaning. */
export function rowRepaymentType(row: { repayment_type?: string; ribbon_repayment_type?: string }): string | undefined {
  const source = row.repayment_type, ribbon = row.ribbon_repayment_type;
  return source === undefined || canonicalRepayment(source) === canonicalRepayment(ribbon) ? ribbon : source;
}
