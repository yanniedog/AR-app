import type { AuditCheck } from './performanceAudit';

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
  let attempted = 0, notAttempted = aggregateNotAttempted;
  for (const check of destinations.values()) {
    if (check?.metrics?.httpAttempted === true) attempted += 1;
    else if (check?.metrics?.httpAttempted === false) notAttempted += 1;
  }
  return { total, attempted, notAttempted,
    missingEvidence: total == null ? null : total - attempted - notAttempted };
}
