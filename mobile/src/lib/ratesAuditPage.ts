import type { RatesPageSize } from '../data/ratesPagination';

export interface RatesAuditPagePreparation {
  selectionToken: string;
  resultIndex: number;
  pageSize: RatesPageSize;
  pageBefore: number;
  selectionModeBefore: boolean;
  requestedPage: number;
  renderedSelectionToken: string | null;
}

/** An already-rendered target needs ready probes, but no fabricated page change. */
export function isVerifiedRatesPagePreparation(actionId: string, token: unknown, result: unknown): boolean {
  if (!['search.compare.page.0', 'search.compare.page.1'].includes(actionId) ||
    typeof token !== 'string' || !token || result == null || typeof result !== 'object' || Array.isArray(result)) return false;
  const evidence = result as Partial<RatesAuditPagePreparation>;
  if (evidence.selectionToken !== token || evidence.renderedSelectionToken !== token || evidence.selectionModeBefore !== true ||
    (evidence.pageSize !== 10 && evidence.pageSize !== 20) || typeof evidence.resultIndex !== 'number' ||
    !Number.isSafeInteger(evidence.resultIndex) || evidence.resultIndex < 0) return false;
  const page = Math.floor(evidence.resultIndex / evidence.pageSize) + 1;
  return evidence.pageBefore === page && evidence.requestedPage === page;
}
