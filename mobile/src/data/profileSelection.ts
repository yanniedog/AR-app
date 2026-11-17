import type { NormalizedProductFact, ProductDetail, RateRow, SectionKey } from '../types';
import { curatedFeatureIdentityKey, featureEvidenceScope, normalizedProductFacts } from './productFactsCore';
import { profileFeaturesForSection, profileFilterRows, type ProfileFilters } from './profile';

/** App selection optimisation; keep the pinned history compiler's helpers unchanged. */
export function selectProfileRows(rows: RateRow[], profile: ProfileFilters, section: SectionKey,
  lookup: Record<string, ProductDetail> | null): RateRow[] {
  const features = profileFeaturesForSection(profile, section);
  if (!features.length) return profileFilterRows(rows, profile, section, lookup);
  if (!lookup) return [];
  const candidates = profileFilterRows(rows, { ...profile, accountFeatures: [] }, section, lookup);
  // Compile each product's applicable feature variants once per selection. A
  // product with only unscoped evidence has the same eligibility across tiers.
  const matchers = new Map<string, (row: RateRow) => boolean>();
  return candidates.filter(row => {
    let matches = matchers.get(row.product_key);
    if (!matches) {
      matches = prepareFeatureMatcher(lookup[row.product_key], features, section);
      matchers.set(row.product_key, matches);
    }
    return matches(row);
  });
}

function prepareFeatureMatcher(detail: ProductDetail | undefined, features: string[], section: SectionKey) {
  const selected = new Map(features.map(feature => [feature, [] as NormalizedProductFact[]]));
  for (const fact of normalizedProductFacts(detail)) {
    const target = curatedFeatureIdentityKey(fact);
    if (target) selected.get(target)?.push(fact);
  }
  const variants = [...selected.values()];
  if (variants.some(group => !group.length)) return () => false;
  const affirms = (fact: NormalizedProductFact) =>
    fact.value === true && fact.unit === 'boolean' && !fact.condition?.trim();
  if (variants.every(group => group.every(fact => !fact.appliesTo?.length))) {
    const result = variants.every(group => group.every(affirms));
    return () => result;
  }
  const scoped = new Map<string, boolean>();
  return (row: RateRow) => {
    const scope = featureEvidenceScope(row.product_key, row, section);
    const key = JSON.stringify(scope);
    const cached = scoped.get(key);
    if (cached !== undefined) return cached;
    const result = variants.every(group => {
      const applicable = group.filter(fact => !fact.appliesTo?.length ||
        fact.appliesTo.every(value => scope.includes(value.toUpperCase())));
      return applicable.length > 0 && applicable.every(affirms);
    });
    scoped.set(key, result);
    return result;
  };
}
