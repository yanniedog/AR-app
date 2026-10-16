import { auditOutcome, auditOutcomeCounts, uploadOutcome } from '../src/lib/auditPresentation';
import type { AuditCheck } from '../src/lib/performanceAudit';

test('audit buckets keep timing, real failures, unavailable, skipped and untested links distinct without changing scores', () => {
  const check = (id: string, status: AuditCheck['status'], metrics: AuditCheck['metrics'] = {}): AuditCheck => ({ id, status, metrics, kind: 'journey', durationMs: null, label: id });
  const checks = [check('timing', 'fail', { nonTimingFailure: false, actionCompleted: true, actionMs: 3000 }),
    check('runtime', 'fail', { nonTimingFailure: true, availabilityFailure: true }), check('unproven', 'fail'),
    check('skipped', 'skipped'), check('missing', 'fail', { executionAttempted: false, availabilityFailure: true }),
    check('external-link-1', 'warn', { httpAttempted: false }), check('external-link-2', 'pass', { httpAttempted: true, httpReachability: 'pass', browserHandler: 'pass' })];
  const before = JSON.stringify(checks), counts = auditOutcomeCounts(checks);
  expect(counts).toEqual({ pass: 1, warning: 0, failure: 2, timing: 1, skipped: 1, unavailable: 1, 'untested-link': 1 });
  expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(checks.length);
  expect(auditOutcome(check('external-link-3', 'fail', { nonTimingFailure: true, httpAttempted: false }))).toBe('failure');
  expect(JSON.stringify(checks)).toBe(before);
});
test('a verified upload with a clipboard failure stays verified; an unknown POST or unverified URL stays uncertain', () => {
  const state = { phase: 'idle' as const, verified: false, url: null, mayHaveUploaded: false };
  expect(uploadOutcome(state)).toBe('local');
  expect(uploadOutcome({ ...state, phase: 'uploading' })).toBe('pending');
  expect(uploadOutcome({ ...state, phase: 'failed' })).toBe('failed');
  expect(uploadOutcome({ ...state, phase: 'failed', mayHaveUploaded: true })).toBe('uncertain');
  expect(uploadOutcome({ ...state, phase: 'failed', url: 'https://example.test/report' })).toBe('uncertain');
  expect(uploadOutcome({ ...state, phase: 'failed', verified: true })).toBe('verified');
});
