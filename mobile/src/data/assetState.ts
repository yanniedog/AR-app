/**
 * Truth state for an independently validated payload capability.
 *
 * `data` remains available in partial/error states when a last-known-good or
 * freshly verified in-memory value exists. Callers must inspect `status`
 * before making freshness or completeness claims.
 */
export type AssetState<T> =
  | { status: 'loading'; data: T | null }
  | { status: 'live'; data: T }
  | { status: 'cached'; data: T }
  | { status: 'sample'; data: T }
  | { status: 'partial'; data: T; reason: string }
  | { status: 'unavailable'; data: null; reason: string }
  | { status: 'error'; data: T | null; error: string };

export function assetData<T>(state: AssetState<T>): T | null {
  return state.data;
}

export function replaceAssetData<T>(state: AssetState<T>, data: T): AssetState<T> {
  switch (state.status) {
    case 'loading': return { status: 'loading', data };
    case 'live': return { status: 'live', data };
    case 'cached': return { status: 'cached', data };
    case 'sample': return { status: 'sample', data };
    case 'partial': return { status: 'partial', data, reason: state.reason };
    case 'error': return { status: 'error', data, error: state.error };
    case 'unavailable': return { status: 'cached', data };
  }
}

export function liveAssetStateForProviderCoverage<T>(
  data: T,
  coverage: {
    counts?: {
      providers_partial?: number;
      providers_failed?: number;
    };
  } | null | undefined,
): AssetState<T> {
  const partial = coverage?.counts?.providers_partial ?? 0;
  const failed = coverage?.counts?.providers_failed ?? 0;
  if (partial + failed === 0) return { status: 'live', data };
  const reasons = [
    partial > 0 ? `${partial} provider observation(s) are partial` : null,
    failed > 0 ? `${failed} provider observation(s) failed` : null,
  ].filter((reason): reason is string => reason !== null);
  return { status: 'partial', data, reason: `${reasons.join('; ')}.` };
}

export function cachedAssetStateForProviderCoverage<T>(
  data: T,
  coverage: Parameters<typeof liveAssetStateForProviderCoverage<T>>[1],
): AssetState<T> {
  const state = liveAssetStateForProviderCoverage(data, coverage);
  return state.status === 'live' ? { status: 'cached', data } : state;
}

/** Preserve producer CoverageV2 truth without squeezing it into the v1 shape. */
export function assetStateForV3Coverage<T>(
  data: T,
  coverage: {
    reconciliation_status: 'reconciled' | 'partial' | 'failed';
    providers_partial: number;
    providers_failed: number;
    providers_not_attempted: number;
    corrupt_failure_records: number;
    register_provenance_complete: boolean;
  },
  observationState: 'complete' | 'partial',
  source: 'live' | 'cache',
): AssetState<T> {
  const incomplete =
    observationState === 'partial' ||
    coverage.reconciliation_status !== 'reconciled' ||
    coverage.providers_partial > 0 ||
    coverage.providers_failed > 0 ||
    coverage.providers_not_attempted > 0 ||
    coverage.corrupt_failure_records > 0 ||
    !coverage.register_provenance_complete;
  if (!incomplete) return { status: source === 'live' ? 'live' : 'cached', data };
  const reasons = [
    observationState === 'partial' ? 'The observation is partial' : null,
    coverage.providers_partial > 0 ? `${coverage.providers_partial} provider observation(s) are partial` : null,
    coverage.providers_failed > 0 ? `${coverage.providers_failed} provider observation(s) failed` : null,
    coverage.providers_not_attempted > 0 ? `${coverage.providers_not_attempted} provider observation(s) were not attempted` : null,
    coverage.corrupt_failure_records > 0 ? `${coverage.corrupt_failure_records} failure record(s) are corrupt` : null,
    !coverage.register_provenance_complete ? 'Register provenance is incomplete' : null,
    coverage.reconciliation_status !== 'reconciled'
      ? `Coverage reconciliation is ${coverage.reconciliation_status}`
      : null,
  ].filter((reason): reason is string => reason !== null);
  return { status: 'partial', data, reason: `${reasons.join('; ')}.` };
}
