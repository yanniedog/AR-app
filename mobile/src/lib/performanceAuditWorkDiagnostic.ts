/** Bounded machine facts only. Financial inputs, queries, identifiers and free
 * text are deliberately outside this diagnostic contract. */
export const AUDIT_WORK_BOOLEAN_FIELDS = ['catalogueAllLoaded', 'mortgageCriteriaReady', 'mortgageInputsInvalid',
  'suitabilityReady', 'detailsLoading', 'searchIndexLoading', 'intentPending', 'filterReady', 'focused', 'pricingSnapshotReused', 'filterRowsReused', 'preparingMortgageDefaults', 'mortgageIndexReady'] as const;
export const AUDIT_WORK_COUNT_FIELDS = ['pricingRequestRevision', 'workerStarts', 'workerRestarts', 'workerCancellations',
  'mortgageIndexRows', 'pricingIndexHits', 'pricingIndexMisses', 'pricingIndexPrepared', 'sourceRowCount', 'candidateCount', 'pricedRowCount', 'catalogueProductCount', 'catalogueProgrammeCount', 'schedulerNativeScheduleAttempts', 'schedulerNativeCompleted', 'schedulerNativeFallbacks'] as const;
export const AUDIT_WORK_STAGES = ['queued', 'candidates', 'resolution', 'scope', 'ready', 'error'] as const;
export interface AuditWorkDiagnostic {
  pricingStage?: typeof AUDIT_WORK_STAGES[number];
  pricingErrorStage?: typeof AUDIT_WORK_STAGES[number];
  catalogueStatus?: 'unavailable' | 'loading' | 'ready' | 'error';
  pricingRequestRevision?: number; workerStarts?: number; workerRestarts?: number; workerCancellations?: number;
  mortgageIndexStatus?: 'preparing' | 'ready' | 'unsupported' | 'error'; mortgageIndexReady?: boolean; mortgageIndexRows?: number;
  pricingIndexHits?: number; pricingIndexMisses?: number; pricingIndexPrepared?: number;
  pricingSnapshotReused?: boolean; filterRowsReused?: boolean; preparingMortgageDefaults?: boolean;
  sourceRowCount?: number; candidateCount?: number | null; pricedRowCount?: number | null;
  catalogueProductCount?: number; catalogueProgrammeCount?: number;
  schedulerNativeScheduleAttempts?: number; schedulerNativeCompleted?: number; schedulerNativeFallbacks?: number;
  catalogueAllLoaded?: boolean; mortgageCriteriaReady?: boolean; mortgageInputsInvalid?: boolean;
  suitabilityReady?: boolean; detailsLoading?: boolean; searchIndexLoading?: boolean; intentPending?: boolean;
  filterReady?: boolean; focused?: boolean;
}
export function publicAuditWorkDiagnostic(value: unknown): AuditWorkDiagnostic | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>, result: Record<string, unknown> = {};
  for (const field of AUDIT_WORK_BOOLEAN_FIELDS) if (typeof source[field] === 'boolean') result[field] = source[field];
  for (const field of AUDIT_WORK_COUNT_FIELDS) {
    const count = source[field];
    if (count === null && (field === 'candidateCount' || field === 'pricedRowCount') ||
      typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 && count <= 10_000_000) result[field] = count;
  }
  for (const field of ['pricingStage', 'pricingErrorStage'] as const) if (AUDIT_WORK_STAGES.includes(source[field] as typeof AUDIT_WORK_STAGES[number])) result[field] = source[field];
  if (typeof source.catalogueStatus === 'string' && ['unavailable', 'loading', 'ready', 'error'].includes(source.catalogueStatus)) result.catalogueStatus = source.catalogueStatus;
  if (typeof source.mortgageIndexStatus === 'string' && ['preparing', 'ready', 'unsupported', 'error'].includes(source.mortgageIndexStatus)) result.mortgageIndexStatus = source.mortgageIndexStatus;
  return result as AuditWorkDiagnostic;
}
