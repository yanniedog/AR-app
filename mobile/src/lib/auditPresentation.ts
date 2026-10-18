import type { AuditCheck } from './performanceAudit';
import type { DebugLogUploadSnapshot } from './debugLogSharing';

export type AuditOutcome = 'pass' | 'warning' | 'failure' | 'timing' | 'skipped' | 'unavailable' | 'untested-link';
/** Mutually exclusive display buckets. The original recorded scores stay intact. */
export function auditOutcome(check: AuditCheck): AuditOutcome {
  if (check.status === 'fail' && check.metrics.nonTimingFailure === true) return 'failure';
  if (check.status === 'fail' && check.metrics.stepLimitExceeded === true) return 'timing';
  if (check.status === 'skipped' && check.metrics.availabilityFailure !== true &&
    check.metrics.skipClassification !== 'terminal-availability') return 'skipped';
  if (check.id.startsWith('external-link-') && check.status !== 'fail' &&
    (check.metrics.httpAttempted !== true || check.metrics.httpReachability === 'unknown' || check.metrics.browserHandler === 'unknown')) return 'untested-link';
  if (check.metrics.executionAttempted === false || check.metrics.availabilityFailure === true) return 'unavailable';
  if (check.status === 'skipped') return 'skipped';
  if (check.status === 'fail') {
    const measured = check.metrics.performanceStatus === 'fail' || check.metrics.measurementAvailable === true
      || (check.metrics.actionCompleted === true && typeof check.metrics.actionMs === 'number')
      || (check.id === 'runtime-responsiveness' && (Number(check.metrics.eventLoopSamples) > 0 || Number(check.metrics.frameSamples) > 0));
    return check.metrics.nonTimingFailure === false && measured ? 'timing' : 'failure';
  }
  return check.status === 'warn' ? 'warning' : 'pass';
}
export function auditOutcomeCounts(checks: readonly AuditCheck[]): Record<AuditOutcome, number> {
  const counts = { pass: 0, warning: 0, failure: 0, timing: 0, skipped: 0, unavailable: 0, 'untested-link': 0 };
  for (const check of checks) counts[auditOutcome(check)]++;
  return counts;
}
export type UploadOutcome = 'local' | 'pending' | 'verified' | 'failed' | 'uncertain';
export function uploadOutcome(state: Pick<DebugLogUploadSnapshot, 'phase' | 'verified' | 'url' | 'mayHaveUploaded'>): UploadOutcome {
  if (state.verified) return 'verified';
  if (state.phase === 'idle') return 'local';
  if (['preparing', 'uploading', 'verifying', 'copying'].includes(state.phase)) return 'pending';
  if (state.url || state.mayHaveUploaded || state.phase === 'copied') return 'uncertain';
  return 'failed';
}
