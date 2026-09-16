import type { DetailItem, ProductDetail, RateRow, SectionKey } from '../types';
import { sortByDisplayLabel } from './format';
import { curatedFeatureFactKey, curatedFeatureIdentityKey, normalizedProductFacts } from './productFacts';

/** CDR featureType code from a details payload feature row (label or name). */
export function featureTypeKey(item: DetailItem): string {
  return (item.label ?? item.name ?? '').trim();
}

export function productFeatureTypes(detail: ProductDetail | null | undefined): Set<string> {
  const out = new Set<string>();
  const facts = normalizedProductFacts(detail).filter((fact) => fact.kind === 'feature');
  if (facts.length > 0) {
    for (const fact of facts) {
      const key = curatedFeatureFactKey(fact);
      if (key) out.add(key);
    }
    return out;
  }
  for (const it of detail?.features ?? []) {
    const key = featureTypeKey(it);
    if (key) out.add(key);
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
  const facts = normalizedProductFacts(lookup[productKey]);
  const scope = new Set([productKey, section, row?.rate_type, row?.loan_purpose, row?.security_purpose,
    row?.repayment_type, row?.ribbon_repayment_type].filter((value): value is string => typeof value === 'string').map(value => value.toUpperCase()));
  return required.every(feature => {
    const applicable = facts.filter(fact => curatedFeatureIdentityKey(fact) === feature
      && (!fact.appliesTo?.length || fact.appliesTo.every(value => scope.has(value.toUpperCase()))));
    return applicable.length > 0 && applicable.every(fact => fact.value === true && fact.unit === 'boolean');
  });
}

/** Distinct featureType codes for products in rows, sorted alphabetically by display label. */
export function distinctAccountFeatures(
  rows: RateRow[],
  lookup: Record<string, ProductDetail> | null | undefined,
): string[] {
  if (!lookup) return [];
  const keys = new Set<string>();
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.product_key)) continue;
    seen.add(row.product_key);
    for (const key of productFeatureTypes(lookup[row.product_key])) {
      keys.add(key);
    }
  }
  return sortByDisplayLabel(Array.from(keys));
}
