import type { CorePayload, ProductDetail, RateRow, SectionKey } from '../types';
import { compareLvrTiers } from './lvrTier';
import {
  PROFILE_FEATURE_OPTIONS, profileFeaturesForSection, profileFilterRows,
  type ProfileFilters,
} from './profile';

/** Editor metadata deliberately bypasses result eligibility and screen filters. */
export function profileAttributeOptions(rows: readonly RateRow[], field: keyof RateRow, selected: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const raw = field === 'loan_purpose' ? row.loan_purpose ?? row.security_purpose
      : field === 'ribbon_repayment_type' ? row.ribbon_repayment_type ?? row.repayment_type : row[field];
    if (typeof raw !== 'string' || !raw.trim()) continue;
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }
  const available = [...counts.keys()].sort((a, b) => field === 'lvr_tier'
    ? compareLvrTiers(a, b) : counts.get(b)! - counts.get(a)! || a.localeCompare(b));
  // Retain exact saved keys even when the current edition has no matching metadata.
  return [...new Set([...selected, ...available])];
}

/** Clear Home-loan fields and exclusive features; shared selections keep their other scopes. */
export function clearHomeLoanRequirements(profile: ProfileFilters): ProfileFilters {
  const mortgageFeatures = new Set(PROFILE_FEATURE_OPTIONS.Mortgage);
  const otherFeatures = new Set([...PROFILE_FEATURE_OPTIONS.Savings, ...PROFILE_FEATURE_OPTIONS.TD]);
  return { ...profile, loanPurposes: [], rateTypes: [], repaymentTypes: [], lvrTiers: [],
    accountFeatures: profile.accountFeatures.filter(feature => !mortgageFeatures.has(feature) || otherFeatures.has(feature)) };
}

/** Legacy/unrecognised feature selections remain removable without assigning a new meaning. */
export function otherProfileFeatures(profile: ProfileFilters): string[] {
  const known = new Set(Object.values(PROFILE_FEATURE_OPTIONS).flat());
  return [...new Set(profile.accountFeatures.filter(feature => !known.has(feature)))];
}
/** A shared stored feature is edited once with all of its affected categories visible. */
export function sharedProfileFeatures(sections: readonly SectionKey[]) {
  const features = [...new Set(Object.values(PROFILE_FEATURE_OPTIONS).flat())];
  return features.map(feature => ({ feature, sections: (Object.keys(PROFILE_FEATURE_OPTIONS) as SectionKey[])
    .filter(section => PROFILE_FEATURE_OPTIONS[section].includes(feature)) }))
    .filter(item => item.sections.length > 1 && item.sections.some(section => sections.includes(section)));
}

export function catalogueCounts(rows: readonly RateRow[]) {
  return { rates: rows.length, products: new Set(rows.map(row => row.product_key)).size,
    banks: new Set(rows.map(row => row.provider).filter(Boolean)).size };
}

/** Counts describe the saved layer only; temporary filters and suitability are separate. */
export function profileRequirementImpact(core: CorePayload | null, profile: ProfileFilters,
  section: SectionKey, verifiedProducts: Record<string, ProductDetail> | null,
  catalogueRows?: readonly RateRow[] | null) {
  const rows = catalogueRows === undefined ? core?.sections[section].rates ?? [] : catalogueRows ?? [];
  const catalogueReady = !!core && catalogueRows !== null;
  const pending = !catalogueReady || (profileFeaturesForSection(profile, section).length > 0 && !verifiedProducts);
  return { catalogue: catalogueReady ? catalogueCounts(rows) : null,
    matching: pending ? null : catalogueCounts(profileFilterRows([...rows], profile, section, verifiedProducts)) };
}
