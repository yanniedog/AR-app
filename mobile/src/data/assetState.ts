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
