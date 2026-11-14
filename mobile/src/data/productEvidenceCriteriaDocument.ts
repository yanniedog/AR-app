import { MAX_COMPARE_PRODUCTS } from './compareSelection';
import { checkedCriteriaQuery, type CriteriaQuery } from './productEvidenceCriteria';
import { loadProductEvidenceDocument, projectProductEvidenceCriteria, releaseProductEvidenceDocument, verifyEvidenceProduct,
  type ProductEvidenceContext } from './productEvidenceDocument';
import { EvidenceError } from './productEvidenceWire';

export type CriteriaColumn = { productKey: string; status: 'observed'; observedDate: string; observationState: string; edition: string;
  criteria: Awaited<ReturnType<typeof projectProductEvidenceCriteria>> }
  | { productKey: string; status: 'disabled' | 'pending' | 'failed' | 'unavailable' | 'unsupported' | 'unknown'; reason?: string };

/** One full document at a time; only four bounded source text pages escape. */
export async function loadProductCriteria(context: ProductEvidenceContext, productKeys: readonly string[], query: CriteriaQuery,
  isCurrent: () => boolean, signal: AbortSignal): Promise<CriteriaColumn[]> {
  const keys = [...new Set(productKeys)]; checkedCriteriaQuery(query);
  if (!keys.length || keys.length > MAX_COMPARE_PRODUCTS) throw new EvidenceError('invalid', 'Invalid criteria product selection');
  const check = () => { if (signal.aborted || !isCurrent()) throw new EvidenceError('cancelled', 'Criteria edition changed'); };
  const checkpoint = async () => { check(); await new Promise<void>(resolve => setTimeout(resolve, 0)); check(); };
  check();
  if (!context.manifest || (!Object.hasOwn(context.manifest, 'product_evidence_v1') &&
      !Object.hasOwn(context.manifest, 'optional_product_evidence_status'))) return keys.map(productKey => ({ productKey, status: 'unavailable' }));
  for (const key of keys) verifyEvidenceProduct(context, key);
  const columns: CriteriaColumn[] = [];
  let alignment: string | null = null;
  for (const productKey of keys) {
    await checkpoint();
    if (columns.length && alignment === null) {
      const first = columns[0]; columns.push(first.status === 'observed' ? { productKey, status: 'unknown' } : { ...first, productKey }); continue;
    }
    const outcome = await loadProductEvidenceDocument(context, productKey, 'product_evidence_v1', isCurrent, signal);
    try {
      check();
      if (outcome.status !== 'observed') { columns.push({ productKey, status: outcome.status, ...('reason' in outcome ? { reason: outcome.reason } : {}) }); continue; }
      // The first product supplies the exact typed scope. Never align unrelated ordinal records.
      const criteria = await projectProductEvidenceCriteria(outcome.document, columns.length ? { ...query, text: '', record: 0, alignment: alignment! } : query, checkpoint);
      if (!columns.length) alignment = criteria.alignment;
      check(); verifyEvidenceProduct(context, productKey);
      columns.push({ productKey, status: 'observed', criteria, observedDate: outcome.document.observedDate,
        observationState: outcome.document.observationState, edition: outcome.document.edition });
    } finally { if (outcome.status === 'observed') releaseProductEvidenceDocument(outcome.document); }
  }
  check(); for (const key of keys) verifyEvidenceProduct(context, key);
  return columns;
}
