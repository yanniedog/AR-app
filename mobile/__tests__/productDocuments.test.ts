import { factDocumentActions, productDocumentActions } from '../src/data/productDocuments';
import { trustedExternalUrl } from '../src/lib/trustedExternalUrl';
import type { ProductDetail, NormalizedProductFact } from '../src/types';

// Direct official document observed during this investigation. Metadata below
// exercises applicability controls; it is not a reviewed legal interpretation.
const url = 'https://up.com.au/docs/Up-Home-Loan-Booklet.pdf';
const detail: ProductDetail = { sourceDocuments: [{ url, sourcePath: '/constraints/0/additionalInfoUri', relation: 'terms',
  specificity: 'exact-product', relevance: 'verified', documentType: 'terms', citations: [{ page: 3, section: 'Interest charges', sourcePath: '/constraints/0/additionalValue' }] }] };
test('separates specificity, relevance and page location from the direct document URL', () => {
  expect(productDocumentActions(detail)[0]).toMatchObject({ url, specificity: 'exact-product', relevance: 'verified', page: 3 });
  expect(trustedExternalUrl({ url, purpose: 'lender_source', label: 'Source', page: 3 })).toMatchObject({ ok: true, url: url + '#page=3' });
  expect(trustedExternalUrl({ url, purpose: 'lender_source', label: 'Source', page: 0 })).toMatchObject({ ok: true, url });
});
test('a homepage cannot become verified product evidence through supplied labels', () => {
  expect(productDocumentActions({ sourceDocuments: [{ ...detail.sourceDocuments![0], url: 'https://up.com.au/' }] })[0])
    .toMatchObject({ specificity: 'background', relevance: 'supplementary' });
});
test('matches citations only against original source pointers, never compacted cleaner indexes', () => {
  const fact: NormalizedProductFact = { id: 'control', kind: 'constraint', canonicalKey: 'constraint.max_lvr',
    sourcePath: '/constraints/0/additionalValue', sourcePathBasis: 'raw-cdr' };
  expect(factDocumentActions(detail, fact)).toHaveLength(1);
  expect(factDocumentActions(detail, { ...fact, sourcePathBasis: 'cleaned-cdr' })).toHaveLength(0);
  expect(factDocumentActions(detail, { ...fact, sourcePath: '/constraints/1/additionalValue' })).toHaveLength(0);
  expect(factDocumentActions({ sourceDocuments: [{ ...detail.sourceDocuments![0], relevance: 'candidate' }] }, fact)[0]).toMatchObject({ relevance: 'candidate' });
});
test('legacy references stay available without a fabricated specificity or applicability claim', () => {
  const legacy = productDocumentActions({ sourceDocuments: [{ url, sourcePath: '/additionalInformation/termsUri', relation: 'terms' }] });
  expect(legacy[0]).toMatchObject({ url, specificity: 'unknown', relevance: 'candidate' });
  expect(productDocumentActions({ sourceDocuments: [{ ...detail.sourceDocuments![0], citations: 'broken' as never }] })).toHaveLength(1);
});
test('merged document actions open the locator associated with the selected raw fact', () => {
  const sources: ProductDetail = { sourceDocuments: [{ ...detail.sourceDocuments![0], citations: [
    { page: 2, sourcePath: '/constraints/1/additionalValue' },
    { page: 7, sourcePath: '/constraints/0/additionalValue' },
  ] }] };
  expect(factDocumentActions(sources, { id: 'control', kind: 'constraint', canonicalKey: 'constraint.max_lvr',
    sourcePath: '/constraints/0/additionalValue', sourcePathBasis: 'raw-cdr' })[0]).toMatchObject({ page: 7 });
});
