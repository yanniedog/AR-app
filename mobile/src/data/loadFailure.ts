import { MissingPublicPayloadError } from '../lib/automaticDataAccess';

/** Transport failure with a machine-readable class; messages stay compatible. */
export class PayloadTransportError extends Error {
  readonly kind: 'network' | 'timeout' | 'http';
  readonly status: number | null;
  constructor(kind: 'network' | 'timeout' | 'http', status: number | null = null) {
    super(kind === 'http' ? `asset HTTP ${status}` : kind === 'timeout' ? 'network timeout' : 'network error');
    this.name = 'PayloadTransportError';
    this.kind = kind;
    this.status = status;
  }
}

export type LoadFailureKind = 'network' | 'timeout' | 'server' | 'pending' | 'update' | 'error';

export interface LoadFailure {
  kind: LoadFailureKind;
  /** HTTP status for server failures. */
  httpStatus: number | null;
  /** ISO timestamp of the failed attempt. */
  at: string;
}

/** Transient transport classes worth another attempt inside one download. */
export function isRetryableTransportError(err: unknown): boolean {
  if (err instanceof PayloadTransportError) {
    if (err.kind !== 'http') return true;
    return err.status === 429 || (err.status != null && err.status >= 500 && err.status <= 599);
  }
  return false;
}

const PENDING_PATTERNS = [
  /still uploading/i,
  /cannot verify ingest finalisation/i,
  /revision index unavailable/i,
  /update pending/i,
  /no selected payload revision/i,
  /dates-index/i,
];

/**
 * Structured reason for a failed load. The raw message stays in the local
 * debug log; the interface only shows the class, HTTP status and time.
 */
export function classifyLoadFailure(err: unknown, at: string, opts: { coldStart?: boolean } = {}): LoadFailure {
  const message = String((err as Error)?.message ?? err);
  const make = (kind: LoadFailureKind, httpStatus: number | null = null): LoadFailure => ({ kind, httpStatus, at });
  if (/update the app/i.test(message)) return make('update');
  if (err instanceof MissingPublicPayloadError) return make('pending');
  if (PENDING_PATTERNS.some((pattern) => pattern.test(message))) return make('pending');
  if (err instanceof PayloadTransportError) {
    if (err.kind === 'timeout') return make('timeout');
    if (err.kind === 'network') return make('network');
    // A cold start can race a publication that is not yet downloadable.
    if (err.status === 404 && opts.coldStart) return make('pending');
    return make('server', err.status);
  }
  if (/timeout|timed out/i.test(message)) return make('timeout');
  if (/network (error|request failed)|failed to fetch/i.test(message)) return make('network');
  const http = /HTTP (\d{3})/.exec(message);
  if (http) {
    const status = Number(http[1]);
    if (status === 404 && opts.coldStart) return make('pending');
    return make('server', status);
  }
  return make('error');
}

/** Only connectivity-class failures mean the device is offline. */
export function failureMeansOffline(failure: LoadFailure): boolean {
  return failure.kind === 'network' || failure.kind === 'timeout';
}

/** Automatic retry schedule while the unavailable state is visible. */
export const AUTO_RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000] as const;

export function autoRetryDelayMs(attempt: number): number {
  const index = Math.max(0, Math.min(AUTO_RETRY_DELAYS_MS.length - 1, Math.floor(attempt)));
  return AUTO_RETRY_DELAYS_MS[index];
}
