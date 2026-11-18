import type { NormalizedProductFact, ProductDetail } from '../types';
import { normalizedProductFacts } from './productFactsCore';

export interface ComparableFactRow { key: string; representative: NormalizedProductFact; cells: Record<string, NormalizedProductFact[]> }
/** Same parameter is insufficient: units, cadence and conditions must also
 * agree. Preserve every occurrence instead of selecting the most favourable. */
export function comparableProductFacts(products: readonly { key: string; detail: ProductDetail | null | undefined }[]): ComparableFactRow[] {
  const groups = new Map<string, ComparableFactRow>();
  for (const product of products) for (const fact of normalizedProductFacts(product.detail)) {
    const key = JSON.stringify([fact.kind, fact.canonicalKey, fact.unit ?? null, fact.cadence ?? null,
      [...(fact.appliesTo ?? [])].sort(), fact.condition ?? null]);
    let group = groups.get(key);
    if (!group) { group = { key, representative: fact, cells: Object.create(null) }; groups.set(key, group); }
    (group.cells[product.key] ??= []).push(fact);
  }
  const order = ['rate', 'tier', 'eligibility', 'constraint', 'fee', 'feature', 'condition', 'bundle', 'attribute'];
  return [...groups.values()].sort((a, b) => order.indexOf(a.representative.kind) - order.indexOf(b.representative.kind)
    || a.representative.canonicalKey.localeCompare(b.representative.canonicalKey) || a.key.localeCompare(b.key));
}
