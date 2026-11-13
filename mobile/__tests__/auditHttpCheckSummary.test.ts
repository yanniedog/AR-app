import { auditHttpCheckSummary } from '../src/lib/auditHttpCheckSummary';
import type { AuditCheck } from '../src/lib/performanceAudit';

const entry = (id: string, metrics: AuditCheck['metrics']): AuditCheck => ({ id, label: 'Link', kind: 'network', status: 'warn', durationMs: 0, metrics });

test('local links record zero HTTP attempts without claiming verified destinations', () => {
  expect(auditHttpCheckSummary([entry('external-link-inventory', { uniqueDestinations: 2 }),
    entry('external-link-1', { httpAttempted: false, httpReachability: 'unknown' }),
    entry('external-link-2', { httpAttempted: false, httpReachability: 'unknown' })]))
    .toEqual({ total: 2, attempted: 0, notAttempted: 2, missingEvidence: 0 });
});

test('the supplied local audit population remains 0 HTTP attempts out of 2373 destinations', () => {
  // audit-f63bbcf8998f77f9: every inventoried destination was locally checked,
  // with an explicit false HTTP attempt flag and unknown reachability.
  const links = Array.from({ length: 2373 }, (_, index) => entry(`external-link-${index + 1}`,
    { httpAttempted: false, httpReachability: 'unknown' }));
  expect(auditHttpCheckSummary([entry('external-link-inventory', { uniqueDestinations: 2373 }), ...links]))
    .toEqual({ total: 2373, attempted: 0, notAttempted: 2373, missingEvidence: 0 });
});

test('live unknown/failed responses still count as attempts; unrecorded evidence does not count as unattempted', () => {
  expect(auditHttpCheckSummary([entry('external-link-inventory', { uniqueDestinations: 5 }),
    entry('external-link-1', { httpAttempted: true, httpReachability: 'unknown' }),
    entry('external-link-2', { httpAttempted: true, httpReachability: 'fail' }),
    entry('external-link-3', { httpAttempted: false }), entry('external-link-4', {})]))
    .toEqual({ total: 5, attempted: 2, notAttempted: 1, missingEvidence: 2 });
});

test('missing or inconsistent inventory remains unknown and duplicate rows cannot inflate attempts', () => {
  const attempted = entry('external-link-1', { httpAttempted: true });
  expect(auditHttpCheckSummary([attempted])).toEqual({ total: null, attempted: 1, notAttempted: 0, missingEvidence: null });
  expect(auditHttpCheckSummary([entry('external-link-inventory', { uniqueDestinations: 0 }), attempted]).total).toBeNull();
  expect(auditHttpCheckSummary([entry('external-link-inventory', { uniqueDestinations: 1 }), attempted, attempted]))
    .toEqual({ total: 1, attempted: 0, notAttempted: 0, missingEvidence: 1 });
});
