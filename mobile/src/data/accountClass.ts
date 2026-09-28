import type { RateRow } from '../types';

/** A mortgage without a usable LVR band belongs in the opt-in catalogue. */
export function hasUnspecifiedMortgageLvr(row: RateRow): boolean {
  const path = (row.taxonomy_path ?? '').toUpperCase().split('.');
  const mortgage = row.category?.toUpperCase() === 'RESIDENTIAL_MORTGAGES' ||
    path[0] === 'HOME_LOAN' || row.lvr_tier !== undefined ||
    !!(row.loan_purpose || row.security_purpose || row.repayment_type || row.ribbon_repayment_type);
  if (!mortgage) return false;

  // Legacy rows may carry the band only in their hierarchy. Explicit unknown
  // lvr_tier values take precedence over a conflicting numeric hierarchy band.
  const tier = (row.lvr_tier?.trim() || path.find(token => token.startsWith('LVR_')) || '')
    .toUpperCase().replace(/^LVR_/, '').replace(/%/g, '').trim();
  const range = /^(\d+(?:\.\d+)?)\s*[-–_]\s*(\d+(?:\.\d+)?)$/.exec(tier);
  if (range) return !(Number(range[1]) >= 0 && Number(range[2]) > Number(range[1]));
  const bound = /^(?:LE|GE|LT|GT|<=|>=|[<>=≤≥])?(\d+(?:\.\d+)?)\+?$/.exec(tier);
  return !bound || Number(bound[1]) <= 0;
}

/**
 * Curated provider + product cohorts treated as non-standard in the app even when
 * the payload `account_class` is absent or wrong. Keys mirror live CDR wire names
 * (e.g. Pi export uses "RACQ Bank", "Westpac").
 */
const NON_STANDARD_PRODUCTS: Readonly<Record<string, readonly string[]>> = {
  racq: ['Green Home Loan', 'Green Home Loan Investment'],
  westpac: [
    'Sustainable Upgrades Home Loan',
    'Sustainable Upgrades Investment',
    'Sustainable Upgrades Investment Loan',
  ],
};

function providerKey(provider: string): string | null {
  const p = provider.trim().toLowerCase();
  if (p.includes('racq')) return 'racq';
  if (p.includes('westpac')) return 'westpac';
  return null;
}

/** True when bank + product name match a curated non-standard cohort. */
export function isKnownNonStandardProduct(row: RateRow): boolean {
  const key = providerKey(row.provider ?? '');
  if (!key) return false;
  const product = (row.product_name ?? '').trim().toLowerCase();
  if (!product) return false;
  return (NON_STANDARD_PRODUCTS[key] ?? []).some((name) => name.toLowerCase() === product);
}
