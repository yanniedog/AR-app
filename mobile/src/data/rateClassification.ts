import type { ProductDetail, RateRow } from '../types';
import { hasUnspecifiedMortgageLvr, isKnownNonStandardProduct } from './accountClass';
import { accessExcludesFromStandard, assessAccess } from './access';

export function isNonStandard(row: RateRow): boolean {
  if ((row.account_class ?? '') === 'non_standard') return true;
  if (hasUnspecifiedMortgageLvr(row)) return true;
  return isKnownNonStandardProduct(row);
}

/**
 * Whether a deposit row's advertised rate depends on bonus actions or an
 * introductory window. These remain available in the opt-in full catalogue,
 * but are not unconditional rates that broadly apply without further steps.
 */
export function isConditionalDepositRate(row: RateRow): boolean {
  // Mortgage introductory/discounted rates are loan structures, not savings
  // bonus actions. The producer also uses ribbon_rate_structure for home loans.
  if (row.category === 'RESIDENTIAL_MORTGAGES' || row.taxonomy_path === 'HOME_LOAN' || row.taxonomy_path?.startsWith('HOME_LOAN.')) return false;
  const depositKind = (row.ribbon_deposit_kind ?? '').toLowerCase().trim();
  const rateStructure = (row.ribbon_rate_structure ?? '').toLowerCase().trim();
  if (depositKind === 'bonus' || depositKind === 'introductory' || depositKind === 'intro') {
    return true;
  }
  if (rateStructure === 'bonus' || rateStructure === 'introductory' || rateStructure === 'intro') {
    return true;
  }
  const pathTokens = (row.taxonomy_path ?? '').toUpperCase().split('.');
  return pathTokens.some(
    (token) => token === 'BONUS' || token === 'INTRO' || token === 'INTRODUCTORY',
  );
}

/**
 * The unified default-suitability gate. A product is shown to ordinary users by
 * default only when it is *broadly available*: not a non-standard account class,
 * not a curated non-standard cohort, not a conditional bonus/introductory rate,
 * and not access-restricted (youth, region, staff, occupation, membership,
 * business, student, pension, package/existing-customer gates — via product
 * name, lender brand, or loaded eligibility).
 * Known LVR bands, deposit size, TD term, OO/investor and fixed/variable
 * structure are allowed; mortgages with unspecified LVR are non-standard.
 * Advanced users opt everything back in via the
 * "Broadly applicable products" setting (`includeNonStandard`). This is the ONE
 * predicate every surface must use; it shares {@link assessAccess} with the
 * orange restricted badge so badge and filter never disagree.
 */
export function isBroadlyAvailable(
  row: RateRow | null | undefined,
  detail?: ProductDetail | null,
): boolean {
  if (!row) return false;
  if (isNonStandard(row)) return false;
  if (isConditionalDepositRate(row)) return false;
  const access = assessAccess(row.product_name, detail ?? null, row.provider);
  if (accessExcludesFromStandard(access)) return false;
  return true;
}
