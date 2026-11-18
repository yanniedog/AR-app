import type { NormalizedProductFact, ProductDetail, ProductSourceDocument } from '../types';
import { trustedExternalUrl } from '../lib/trustedExternalUrl';
import { StandardUrl } from '../lib/standardUrl';
import type { ProductTerms } from './productTerms';

export interface ProductDocumentAction {
  document: ProductSourceDocument;
  url: string | null;
  page?: number;
  specificity: NonNullable<ProductSourceDocument['specificity']> | 'unknown';
  relevance: NonNullable<ProductSourceDocument['relevance']>;
}
const SPECIFICITY = ['exact-product', 'product-variant', 'product-family', 'provider-general', 'background'];
const RELEVANCE = ['verified', 'conditional', 'supplementary', 'candidate', 'superseded'];
function declaredPage(url: string | undefined): number | undefined {
  try {
    const match = url && /^#page=([1-9]\d{0,2})$/.exec(new StandardUrl(url).hash);
    return match && Number(match[1]) <= 512 ? Number(match[1]) : undefined;
  } catch { return undefined; }
}

/** Specificity and applicability are different claims. A CDR pointer alone is
 * only a candidate, and a provider homepage never verifies a product fact. */
export function productDocumentActions(detail: ProductDetail | null | undefined): ProductDocumentAction[] {
  const seen = new Set<string>();
  return (Array.isArray(detail?.sourceDocuments) ? detail.sourceDocuments : []).flatMap(raw => {
    if (!raw || typeof raw.url !== 'string' || typeof raw.sourcePath !== 'string'
      || typeof raw.relation !== 'string') return [];
    const document: ProductSourceDocument = { ...raw,
      sourceUrl: typeof raw.sourceUrl === 'string' ? raw.sourceUrl : undefined,
      documentType: typeof raw.documentType === 'string' ? raw.documentType : undefined,
      checkedAt: typeof raw.checkedAt === 'string' ? raw.checkedAt : undefined,
      capturedAt: typeof raw.capturedAt === 'string' ? raw.capturedAt : undefined,
      effectiveFrom: typeof raw.effectiveFrom === 'string' ? raw.effectiveFrom : undefined,
      effectiveTo: typeof raw.effectiveTo === 'string' ? raw.effectiveTo : undefined,
      finalUrl: typeof raw.finalUrl === 'string' ? raw.finalUrl : undefined,
      verification: ['declared-reference', 'discovery-candidate', 'pending', 'failed', 'deferred', 'captured'].includes(raw.verification ?? '') ? raw.verification : undefined,
      citations: (Array.isArray(raw.citations) ? raw.citations : []).filter(citation => citation && typeof citation === 'object'
        && (citation.page === undefined || Number.isSafeInteger(citation.page) && citation.page > 0 && citation.page <= 512)
        && (citation.section === undefined || typeof citation.section === 'string' && citation.section.length <= 240)
        && (citation.sourceUrl === undefined || typeof citation.sourceUrl === 'string' && citation.sourceUrl.length <= 8192)
        && (citation.sourcePath === undefined || typeof citation.sourcePath === 'string' && citation.sourcePath.length <= 8192)),
    };
    const target = document.verification === 'captured' && /^[a-f0-9]{64}$/.test(document.contentSha256 ?? '') && typeof document.finalUrl === 'string'
      ? document.finalUrl : document.sourceUrl || document.url;
    const admitted = trustedExternalUrl({ url: target, purpose: 'lender_source', label: 'Source' });
    let root = false;
    try { root = /^\/(?:index\.(?:html?|php)\/?|home\/?|(?:en|en-au)\/?)?$/i.test(new StandardUrl(target).pathname); } catch { /* Unavailable target. */ }
    const specificity: ProductDocumentAction['specificity'] = root ? 'background' : SPECIFICITY.includes(document.specificity ?? '') ? document.specificity! : 'unknown';
    const relevance = specificity === 'background' ? 'supplementary'
      : RELEVANCE.includes(document.relevance ?? '') ? document.relevance! : 'candidate';
    const page = document.citations?.find(citation => Number.isSafeInteger(citation.page)
      && citation.page! > 0 && citation.page! <= 512)?.page ?? declaredPage(target);
    const id = JSON.stringify([admitted.ok ? admitted.url : target, document.sourcePath, page]);
    if (seen.has(id)) return [];
    seen.add(id);
    return [{ document, url: admitted.ok ? admitted.url : null, page, specificity, relevance }];
  }).sort((a, b) => ['exact-product', 'product-variant', 'product-family', 'provider-general', 'unknown', 'background'].indexOf(a.specificity)
    - ['exact-product', 'product-variant', 'product-family', 'provider-general', 'unknown', 'background'].indexOf(b.specificity));
}

/** Published terms carry acquisition bytes and exact clause locators, but do
 * not classify document exclusivity or prove the latest URL recheck time. */
export function termsSourceDocuments(terms: ProductTerms): ProductSourceDocument[] {
  return terms.documents.map(document => ({ url: document.source_url, sourcePath: document.document_version_id,
    relation: 'supporting', relevance: 'candidate', verification: 'captured', capturedAt: document.observed_at,
    contentSha256: document.content_sha256, documentVersionId: document.document_version_id, mediaType: document.media_type,
    effectiveFrom: document.effective_from ?? undefined, effectiveTo: document.effective_to ?? undefined,
    citations: terms.clauses.filter(clause => clause.document_version_id === document.document_version_id)
      .map(clause => ({ page: clause.locator.page, section: clause.locator.section })),
  }));
}

export function factDocumentActions(detail: ProductDetail | null | undefined, fact: NormalizedProductFact): ProductDocumentAction[] {
  if (fact.sourcePathBasis !== 'raw-cdr' || !fact.sourcePath) return [];
  const matches = (pointer?: string) => pointer === fact.sourcePath || Boolean(pointer
    && /^\/(?:fees|features|eligibility|constraints|depositRates|lendingRates)\/\d+(?:\/tiers\/\d+)?$/.test(fact.sourcePath!)
    && pointer.startsWith(fact.sourcePath + '/'));
  return productDocumentActions(detail).flatMap(action => {
    if (action.specificity === 'background' || action.relevance === 'superseded') return [];
    const citation = action.document.citations?.find(value => matches(value.sourcePath));
    if (!citation && !matches(action.document.sourcePath)) return [];
    const admitted = citation?.sourceUrl && trustedExternalUrl({ url: citation.sourceUrl, purpose: 'lender_source', label: 'Source' });
    return [{ ...action, page: citation ? citation.page ?? declaredPage(citation.sourceUrl) : action.page,
      url: admitted && admitted.ok ? admitted.url : action.url }];
  });
}
