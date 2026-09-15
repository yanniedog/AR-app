import { canonicalTermsJson, type ProductTerms, type TermRevision } from './productTerms';
export interface CanonicalTermGroup { key: string; parameterKey: string; scope: TermRevision['applicability']; unit: string | null; cells: Record<string, TermRevision[]> }
/** Exact identifiers only. Unknown units/scope cannot establish cross-product equivalence. */
export function canonicalTermsComparison(products: readonly { productKey: string; terms: ProductTerms | null }[]): CanonicalTermGroup[] {
  const groups = new Map<string, CanonicalTermGroup>();
  for (const product of products) for (const revision of product.terms?.revisions ?? []) {
    const { product_key: _, ...scope } = revision.applicability;
    const unknown = revision.unit === null || Object.values(scope).some(value => value === null);
    const key = canonicalTermsJson([revision.parameter_key, revision.unit, scope, unknown ? product.productKey : null]);
    let group = groups.get(key);
    if (!group) { group = { key, parameterKey: revision.parameter_key, scope: revision.applicability, unit: revision.unit, cells: Object.create(null) }; groups.set(key, group); }
    (group.cells[product.productKey] ??= []).push(revision);
  }
  return [...groups.values()].sort((a, b) => a.parameterKey.localeCompare(b.parameterKey) || a.key.localeCompare(b.key));
}
