import type { DetailItem, ProductDetail, RateRow, SectionKey } from '../types';
import { curatedFeatureFactKey, featureEvidenceMatches, featureEvidenceScope, normalizedProductFacts } from './productFactsCore';


/** CDR featureType code from a details payload feature row (label or name). */
export function featureTypeKey(item: DetailItem): string {
  return (item.label ?? item.name ?? '').trim();
}

export function productFeatureTypes(detail: ProductDetail | null | undefined, scope: readonly string[] = []): Set<string> {
  const out = new Set<string>();
  const facts = normalizedProductFacts(detail).filter((fact) => fact.kind === 'feature');
  if (facts.length > 0) {
    for (const fact of facts) {
      const key = curatedFeatureFactKey(fact);
      if (key && featureEvidenceMatches(detail, key, true, scope)) out.add(key);
    }
    return out;
  }
  return out;
}

/** Only applicable positive boolean evidence can satisfy a required feature. */
export function productHasAllFeatures(
  productKey: string,
  required: string[],
  lookup: Record<string, ProductDetail> | null | undefined,
  row?: RateRow,
  section?: SectionKey,
): boolean {
  if (required.length === 0) return true;
  if (!lookup) return false;
  const scope = featureEvidenceScope(productKey, row, section);
  return required.every(feature => featureEvidenceMatches(lookup[productKey], feature, true, scope));
}
