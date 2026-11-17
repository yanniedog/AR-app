import type { AuditCheck } from './performanceAudit';

export const verifiedAuditHttpDestination = (check: AuditCheck): boolean =>
  check.metrics.httpAttempted === true && check.metrics.httpReachability === 'pass'
  && check.metrics.urlValidation !== 'fail';

/** Transport attempts are independent of a destination's verified outcome. */
export function auditHttpCheckSummary(checks: readonly AuditCheck[]) {
  const inventories = checks.filter(check => check.id === 'external-link-inventory');
  const declared = inventories.length === 1 ? inventories[0].metrics?.uniqueDestinations : null;
  const destinations = new Map<string, AuditCheck | null>();
  let aggregateNotAttempted = 0;
  for (const check of checks) {
    if (/^external-link-\d+$/.test(check.id))
      destinations.set(check.id, destinations.has(check.id) ? null : check);
    else if (check.id === 'external-link-unverified') {
      const count = check.metrics?.destinationCount;
      if (typeof count === 'number' && Number.isSafeInteger(count) && count > 0) aggregateNotAttempted += count;
    }
  }
  const total = typeof declared === 'number' && Number.isSafeInteger(declared)
    && declared >= destinations.size + aggregateNotAttempted ? declared : null;
  let attempted = 0, notAttempted = aggregateNotAttempted, verified = 0, failed = 0, rejected = 0, timedOut = 0, restricted = 0;
  for (const check of destinations.values()) {
    if (check?.metrics?.urlValidation === 'fail') rejected += 1;
    if (check?.metrics?.httpAttempted === true) {
      attempted += 1;
      if (check.metrics.httpIssue === 'timeout') timedOut += 1;
      if (['restricted', 'response-rejected'].includes(String(check.metrics.httpIssue))) restricted += 1;
      if (verifiedAuditHttpDestination(check)) verified += 1;
      else if (check.metrics.httpReachability === 'fail') failed += 1;
    }
    else if (check?.metrics?.httpAttempted === false) notAttempted += 1;
  }
  return { total, attempted, verified, failed, unresolved: attempted - verified - failed, timedOut, restricted, rejected, notAttempted,
    missingEvidence: total == null ? null : total - attempted - notAttempted };
}
