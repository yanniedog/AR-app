import type { ProductDetail, RateRow, SectionKey } from '../types';
import { sortByDisplayLabel } from './format';
import { featureEvidenceScope } from './productFactsCore';
import { productFeatureTypes } from './featuresCore';
export * from './featuresCore';

/** Distinct featureType codes for products in rows, sorted alphabetically by display label. */
export function distinctAccountFeatures(
  rows: RateRow[],
  lookup: Record<string, ProductDetail> | null | undefined,
  section?: SectionKey,
): string[] {
  if (!lookup) return [];
  const keys = new Set<string>();
  const seen = new Set<string>();
  for (const row of rows) {
    const scope = featureEvidenceScope(row.product_key, row, section);
    const scopeKey = JSON.stringify(scope);
    if (seen.has(scopeKey)) continue;
    seen.add(scopeKey);
    for (const key of productFeatureTypes(lookup[row.product_key], scope)) {
      keys.add(key);
    }
  }
  return sortByDisplayLabel(Array.from(keys));
}
