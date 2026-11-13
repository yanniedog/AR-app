import type { ProductDetail, RateRow, SectionKey } from '../types';
import { featureEvidenceMatches, featureEvidenceScope } from './productFactsCore';
import { profileFeaturesForSection, profileFilterRows, type ProfileFilters } from './profile';

/** App selection optimisation; keep the pinned history compiler's helpers unchanged. */
export function selectProfileRows(rows: RateRow[], profile: ProfileFilters, section: SectionKey,
  lookup: Record<string, ProductDetail> | null): RateRow[] {
  const features = profileFeaturesForSection(profile, section);
  if (!features.length) return profileFilterRows(rows, profile, section, lookup);
  if (!lookup) return [];
  const candidates = profileFilterRows(rows, { ...profile, accountFeatures: [] }, section, lookup);
  // Invocation-local: changed profiles, details and even in-place corrections
  // are re-evaluated on the next selection. No evidence owner is retained.
  const matches = new Map<string, boolean>();
  return candidates.filter(row => {
    const scope = featureEvidenceScope(row.product_key, row, section);
    // Preserve the exact lookup key as well as case-normalized evidence scope.
    const key = JSON.stringify([row.product_key, scope]);
    const cached = matches.get(key);
    if (cached !== undefined) return cached;
    const matched = features.every(feature => featureEvidenceMatches(lookup[row.product_key], feature, true, scope));
    matches.set(key, matched);
    return matched;
  });
}
