import { auditOutcome, auditOutcomeCounts, uploadOutcome } from '../src/lib/auditPresentation';
import { enforcePerformanceAuditStepLimit, type AuditCheck } from '../src/lib/performanceAudit';

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

test('scenario recovery remains skipped while terminal source availability remains unavailable', () => {
  const recovered: AuditCheck = { id: 'deep-recovery', kind: 'journey', status: 'skipped', durationMs: null, label: 'Recovery',
    metrics: { skipClassification: 'scenario-recovery', scenarioRecoveryCascade: true, executionAttempted: false,
      actionInvoked: false, actionCompleted: false, routeStateInvalidated: false } };
  const unavailable: AuditCheck = { ...recovered, id: 'deep-unavailable', metrics: { skipClassification: 'terminal-availability', executionAttempted: false } };
  const before = JSON.stringify([recovered, unavailable]);
  expect(auditOutcome(recovered)).toBe('skipped');
  expect(auditOutcome(unavailable)).toBe('unavailable');
  expect(auditOutcomeCounts([recovered, unavailable])).toMatchObject({ skipped: 1, unavailable: 1 });
  expect(JSON.stringify([recovered, unavailable])).toBe(before);
});

test('the actual step-limit producer marks non-journey overruns as timing unless a real failure is recorded', () => {
  const source: AuditCheck = { id: 'integrity-check', kind: 'data', status: 'pass', durationMs: 10_001, label: 'Integrity', metrics: {} };
  const overrun = enforcePerformanceAuditStepLimit(source);
  expect(overrun.metrics.stepLimitExceeded).toBe(true);
  expect(auditOutcome(overrun)).toBe('timing');
  expect(auditOutcome(enforcePerformanceAuditStepLimit({ ...source, status: 'fail', metrics: { nonTimingFailure: true } }))).toBe('failure');
  expect(auditOutcome(enforcePerformanceAuditStepLimit({ ...source, durationMs: 10_000 }))).toBe('pass');
  expect(source.status).toBe('pass'); expect(source.metrics).toEqual({});
});


test('background settle and an unfinished journey are not timing failures', () => {
  const check = (metrics: AuditCheck['metrics']): AuditCheck => ({
    id: 'journey-search', kind: 'journey', label: 'Search', status: 'fail', durationMs: 6_189, metrics,
  });
  expect(auditOutcome(check({
    measurementMode: 'semantic-action', actionCompleted: true, actionMs: 444.7, forwardMs: 700,
    backgroundSettleMs: 5_003.9, nonTimingFailure: false, maxEventLoopLagMs: 40, maxFrameGapMs: 20,
  }))).toBe('failure');
  expect(auditOutcome(check({
    actionCompleted: false, stepLimitExceeded: true, nonTimingFailure: false, backgroundSettleMs: 8_444,
  }))).toBe('failure');
  expect(auditOutcome(check({
    measurementMode: 'semantic-action', actionCompleted: true, actionMs: 3_000, forwardMs: 400, nonTimingFailure: false,
  }))).toBe('timing');
});

test('completed route round trips classify latency while navigation and back contract failures remain failures', () => {
  const route: AuditCheck = { id: 'journey-product-1', kind: 'journey', label: 'Product', status: 'fail', durationMs: 3500,
    metrics: { measurementMode: 'route-round-trip', actionCompleted: true, forwardMs: 2800, backMs: 300,
      backReturnedToAudit: true, backChangedPath: true, nonTimingFailure: false } };
  expect(auditOutcome(route)).toBe('timing');
  const invalid: AuditCheck['metrics'][] = [{ nonTimingFailure: true }, { actionCompleted: false }, { backChangedPath: false },
    { backReturnedToAudit: false }, { backMs: null }, { forwardMs: NaN }];
  for (const metrics of invalid) {
    expect(auditOutcome({ ...route, metrics: { ...route.metrics, ...metrics } })).toBe('failure');
  }
});
