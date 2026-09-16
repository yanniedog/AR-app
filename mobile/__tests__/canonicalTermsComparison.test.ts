import { canonicalTermsComparison } from '../src/data/canonicalTermsComparison';
import type { ProductTerms, TermRevision } from '../src/data/productTerms';
const revision = (product: string, change: Partial<TermRevision> = {}): TermRevision => ({ term_revision_id: product, parameter_key: 'fee.amount', value: '0', unit: 'AUD', applicability: { product_key: product, tier: 'none_source_declared', package: 'none_source_declared', cohort: 'adult', effective_from: '2026-01-01', effective_to: '2027-01-01' }, clause_ids: [], rule_set_id: null, status: 'validated', observed_at: '2026-09-15T00:00:00Z', ...change });
const product = (productKey: string, revisions: TermRevision[]) => ({ productKey, terms: { revisions } as ProductTerms });
test('aligns exact known scope and preserves zero/false/conflicting revisions without selecting a price', () => {
  const groups = canonicalTermsComparison([product('a', [revision('a'), revision('a', { term_revision_id: 'a2', value: false })]), product('b', [revision('b', { value: '10' })])]);
  expect(groups).toHaveLength(1); expect(groups[0].cells.a.map(r => r.value)).toEqual(['0', false]); expect(groups[0].cells.b[0].value).toBe('10');
});
test('separates incompatible units, cohorts and unknown scopes; missing cells remain absent', () => {
  const a = revision('a'), b = revision('b', { unit: '%' }), c = revision('c'); c.applicability.cohort = 'other';
  const d = revision('d'), e = revision('e'); d.applicability.tier = null; e.applicability.tier = null;
  const groups = canonicalTermsComparison([product('a', [a]), product('b', [b]), product('c', [c]), product('d', [d]), product('e', [e]), { productKey: 'missing', terms: null }]);
  expect(groups).toHaveLength(5); expect(groups.every(group => Object.keys(group.cells).length === 1 && group.cells.missing === undefined)).toBe(true);
});
