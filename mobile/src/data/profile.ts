import { matchesMortgageFacet } from './mortgageFacets';
import type { ProductDetail, RateRow, SectionKey } from '../types';
import { productHasAllFeatures } from './featuresCore';
import type { Filters } from './selectors';
import { lvrRangeContains, matchesLvrTier, parseLvrRange } from './lvrRange';

/**
 * Per-section product attributes the user locks in once — e.g. owner-occupied,
 * P&I, variable, LVR 80–90% — mandatory across the app so the
 * same choices never have to be re-selected screen by screen.
 *
 * `accountFeatures` holds CDR featureType codes (offset, extra repayments, …)
 * curated per section; Search and other surfaces seed from the subset that
 * applies to the active section. Screen filters may only narrow these requirements.
 */
export interface ProfileFilters {
  loanPurposes: string[];
  rateTypes: string[];
  repaymentTypes: string[];
  lvrTiers: string[];
  depositKinds: string[];
  interestPayments: string[];
  accountFeatures: string[];
}

export const EMPTY_PROFILE: ProfileFilters = {
  loanPurposes: [],
  rateTypes: [],
  repaymentTypes: [],
  lvrTiers: [],
  depositKinds: [],
  interestPayments: [],
  accountFeatures: [],
};

/**
 * Curated CDR featureTypes offered on intro / profile — not the full details
 * catalogue (which includes OTHER and banking noise). Search FilterSheet still
 * exposes the broader distinct set for session overrides.
 */
export const PROFILE_FEATURE_OPTIONS: Record<SectionKey, string[]> = {
  Mortgage: ['OFFSET', 'EXTRA_REPAYMENTS', 'REDRAW', 'GUARANTOR', 'CASHBACK_OFFER'],
  Savings: [
    'CARD_ACCESS',
    'NPP_PAYID',
    'UNLIMITED_TXNS',
    'BILL_PAYMENT',
    'OVERDRAFT',
    'FREE_TXNS',
    'DIGITAL_BANKING',
  ],
  TD: ['DIGITAL_BANKING', 'NOTIFICATIONS'],
};

const stringList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

export function normalizeProfileFilters(value?: Partial<ProfileFilters> | null): ProfileFilters {
  return {
    loanPurposes: stringList(value?.loanPurposes),
    rateTypes: stringList(value?.rateTypes),
    repaymentTypes: stringList(value?.repaymentTypes),
    lvrTiers: stringList(value?.lvrTiers),
    depositKinds: stringList(value?.depositKinds),
    interestPayments: stringList(value?.interestPayments),
    accountFeatures: stringList(value?.accountFeatures),
  };
}

export function profileSelectionCount(p: ProfileFilters): number {
  return (
    p.loanPurposes.length +
    p.rateTypes.length +
    p.repaymentTypes.length +
    p.lvrTiers.length +
    p.depositKinds.length +
    p.interestPayments.length +
    p.accountFeatures.length
  );
}

/** Profile feature selections that apply to `section` (intersect curated allowlist). */
export function profileFeaturesForSection(p: ProfileFilters, section: SectionKey): string[] {
  const allowed = new Set(PROFILE_FEATURE_OPTIONS[section] ?? []);
  return p.accountFeatures.filter((f) => allowed.has(f));
}

/**
 * Seed screen filters from the saved profile — only the dimensions that apply
 * to `section` (a saved Mortgage rate type must not constrain a Savings
 * search). Mandatory eligibility is independently enforced before this screen filter.
 */
export function profileToFilters(p: ProfileFilters, section: SectionKey, base: Filters): Filters {
  const accountFeatures = profileFeaturesForSection(p, section);
  if (section === 'Mortgage') {
    return {
      ...base,
      loanPurposes: [...p.loanPurposes],
      rateTypes: [...p.rateTypes],
      repaymentTypes: [...p.repaymentTypes],
      lvrTiers: [...p.lvrTiers],
      accountFeatures: [...accountFeatures],
    };
  }
  if (section === 'TD') {
    return { ...base, interestPayments: [...p.interestPayments], accountFeatures: [...accountFeatures] };
  }
  return { ...base, depositKinds: [...p.depositKinds], accountFeatures: [...accountFeatures] };
}

/**
 * Parse a raw `lvr_tier` value (e.g. "lvr_85-90%", "lvr_=60%", "lvr_unspecified")
 * into a numeric (lo, hi] band, or null when it carries no usable range.
 */
export function parseLvrTier(tier: string): { lo: number; hi: number } | null {
  const range = parseLvrRange(tier);
  return range ? { lo: range.lo, hi: range.hi } : null;
}

/**
 * Given a computed LVR percentage and the `lvr_tier` values present in the data,
 * pick the smallest matching band. Returns null outside all published limits.
 */
export function lvrTierForValue(lvr: number, tiers: string[]): string | null {
  if (!Number.isFinite(lvr) || lvr <= 0) return null;
  const ranges = tiers
    .map((tier) => ({ tier, range: parseLvrRange(tier) }))
    .filter((x): x is { tier: string; range: NonNullable<ReturnType<typeof parseLvrRange>> } => x.range !== null)
    .sort((a, b) => (a.range.hi - a.range.lo) - (b.range.hi - b.range.lo)
      || a.range.hi - b.range.hi || b.range.lo - a.range.lo);
  if (!ranges.length) return null;
  for (const { tier, range } of ranges) {
    if (lvrRangeContains(range, lvr)) return tier;
  }
  return null;
}

/** Profile dimensions that apply to a section (drives editors and row matching). */
export const PROFILE_GROUPS: {
  section: SectionKey;
  title: string;
  field: keyof RateRow;
  key: keyof ProfileFilters;
}[] = [
  { section: 'Mortgage', title: 'Purpose', field: 'loan_purpose', key: 'loanPurposes' },
  { section: 'Mortgage', title: 'Rate type', field: 'rate_type', key: 'rateTypes' },
  { section: 'Mortgage', title: 'Repayment', field: 'ribbon_repayment_type', key: 'repaymentTypes' },
  { section: 'Mortgage', title: 'LVR tier', field: 'lvr_tier', key: 'lvrTiers' },
  { section: 'Savings', title: 'Account type', field: 'ribbon_deposit_kind', key: 'depositKinds' },
  { section: 'TD', title: 'Interest paid', field: 'interest_payment', key: 'interestPayments' },
];

const matches = (value: string | undefined, list: string[]): boolean =>
  list.length === 0 || (value !== undefined && list.includes(value));

/**
 * Rows matching the profile within one section (empty dimensions match all).
 * Account-feature matching needs details; when features are selected but
 * details are absent, return no rows (fail closed) until details warm.
 */
export function profileFilterRows(
  rows: RateRow[],
  p: ProfileFilters,
  section: SectionKey,
  detailsProducts?: Record<string, ProductDetail> | null,
): RateRow[] {
  let out = rows;
  if (section === 'Mortgage') {
    if (p.loanPurposes.length || p.rateTypes.length || p.repaymentTypes.length || p.lvrTiers.length) {
      out = out.filter(
        (r) =>
          matchesMortgageFacet(r.loan_purpose ?? r.security_purpose, p.loanPurposes, 'purpose') &&
          matches(r.rate_type, p.rateTypes) &&
          matchesMortgageFacet(r.ribbon_repayment_type ?? r.repayment_type, p.repaymentTypes, 'repayment') &&
          matchesLvrTier(r.lvr_tier, p.lvrTiers),
      );
    }
  } else if (section === 'TD') {
    if (p.interestPayments.length) {
      out = out.filter((r) => matches(r.interest_payment, p.interestPayments));
    }
  } else if (p.depositKinds.length) {
    out = out.filter((r) => matches(r.ribbon_deposit_kind, p.depositKinds));
  }

  const features = profileFeaturesForSection(p, section);
  if (features.length) {
    // Fail closed until details are loaded — otherwise must-have features would
    // silently disappear and Home/Calculator could show non-matching winners.
    if (!detailsProducts) return [];
    out = out.filter((r) => productHasAllFeatures(r.product_key, features, detailsProducts, r, section));
  }
  return out;
}

/** A known scenario LVR overrides the saved band and must fit each row's bounds. */
export function scenarioProfileFilterRows(
  rows: RateRow[],
  p: ProfileFilters,
  section: SectionKey,
  lvr: number | null,
  detailsProducts?: Record<string, ProductDetail> | null,
): RateRow[] {
  if (section !== 'Mortgage' || lvr === null) {
    return profileFilterRows(rows, p, section, detailsProducts);
  }
  return profileFilterRows(rows, { ...p, lvrTiers: [] }, section, detailsProducts).filter(row => {
    const range = parseLvrRange(row.lvr_tier);
    return range !== null && lvrRangeContains(range, lvr);
  });
}

/** Selections that affect a given section (badge counts, "profile applied" hints). */
export function profileSectionCount(p: ProfileFilters, section: SectionKey): number {
  const featureCount = profileFeaturesForSection(p, section).length;
  if (section === 'Mortgage') {
    return (
      p.loanPurposes.length +
      p.rateTypes.length +
      p.repaymentTypes.length +
      p.lvrTiers.length +
      featureCount
    );
  }
  if (section === 'TD') return p.interestPayments.length + featureCount;
  return p.depositKinds.length + featureCount;
}
