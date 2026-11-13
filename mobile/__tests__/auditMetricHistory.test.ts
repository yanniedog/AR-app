import { finalizeAppHealthReport, APP_HEALTH_CHECK_CODES } from '../src/lib/appHealth';
import type { AuditCheck } from '../src/lib/performanceAudit';
import { buildAuditMetricAnalysis } from '../src/lib/auditMetricAnalysis';
import { makePerformanceAuditReport } from '../__fixtures__/performanceAuditReport';
import { auditMetricRun, auditMetricPlot, mergeAuditMetricRuns, parseAuditMetricHistory, AUDIT_HISTORY_LIMIT, AUDIT_METRICS, AUDIT_METRIC_HISTORY_VERSION } from '../src/lib/auditMetricHistory';

test('unknown measurements and modes remain distinct from measured zero', () => {
  const report = makePerformanceAuditReport();
  const run = auditMetricRun({ ...report, appHealth: undefined,
    summary: { ...report.summary, maxEventLoopLagMs: null, maxFrameGapMs: 0 } });
  expect(run.mode).toBe('unknown');
  expect(run.metrics.maxEventLoopLagMs).toBeNull();
  expect(run.metrics.maxFrameGapMs).toBe(0);
  expect(run.coverageComplete).toBe(false);
});

test('repeated saves deduplicate by run and keep chronological bounded history', () => {
  const run = auditMetricRun(makePerformanceAuditReport());
  const rows = Array.from({ length: 125 }, (_, index) => ({ ...run,
    sessionId: `run-${index}`, finishedAt: new Date(index * 1000).toISOString() }));
  const saved = mergeAuditMetricRuns([], rows.reverse());
  expect(saved).toHaveLength(AUDIT_HISTORY_LIMIT);
  expect(saved[0].sessionId).toBe('run-5');
  expect(saved.at(-1)?.sessionId).toBe('run-124');
  expect(mergeAuditMetricRuns(saved, [saved[0]])).toEqual(saved);
});

test('time coordinates preserve spacing and missing measurements break lines', () => {
  const run = auditMetricRun(makePerformanceAuditReport());
  const rows = [0, 1000, 9000].map((time, index) => ({ ...run, sessionId: String(index),
    finishedAt: new Date(time).toISOString(), metrics: { ...run.metrics, failures: index === 1 ? null : index } }));
  const plot = auditMetricPlot(rows, 'failures');
  expect(plot.points[0]).toMatchObject({ x: 12, y: 128, value: 0 });
  expect(plot.points[1]).toBeNull();
  expect(plot.points[2]).toMatchObject({ x: 308, y: 16, value: 2 });
  expect(plot.path).not.toContain('L');
  expect(auditMetricPlot([run], 'failures').points[0]?.x).toBe(160);
  expect(auditMetricPlot([], 'failures').points).toEqual([]);
});

test('schema 2 keeps recorded values with legacy methods and plots break at method changes', () => {
  const current = auditMetricRun(makePerformanceAuditReport('new'));
  current.metrics.actionP95Ms = 20;
  const [old] = parseAuditMetricHistory(JSON.stringify({ schemaVersion: 2,
    runs: [{ ...current, sessionId: 'old', finishedAt: new Date(Date.parse(current.finishedAt) - 1000).toISOString(),
      metrics: { ...current.metrics, actionP95Ms: 200 } }] }));
  expect(old.metrics.actionP95Ms).toBe(200);
  expect(old.methodVersions.actionP95Ms).toBe(1);
  expect(current.methodVersions.actionP95Ms).toBe(2);
  expect(auditMetricPlot([old, current], 'actionP95Ms').path.match(/M/g)).toHaveLength(2);
  expect(auditMetricPlot([old, current], 'actionP95Ms').path).not.toContain('L');
  expect(auditMetricPlot([old, current], 'failures').path).toContain('L');
  expect(parseAuditMetricHistory(JSON.stringify({ schemaVersion: 3, runs: [old, current] }))).toEqual([old, current]);
  expect(() => parseAuditMetricHistory(JSON.stringify({ schemaVersion: 3, runs: [{ ...current, methodVersions: {} }] }))).toThrow();
});

test('legacy raw rendering evidence retains method 1 in history and regenerated analysis', () => {
  const legacy = makePerformanceAuditReport('legacy-rendering');
  delete legacy.renderingEvidenceVersion;
  const old = auditMetricRun(legacy);
  const current = auditMetricRun({ ...legacy, sessionId: 'new-rendering', renderingEvidenceVersion: 2,
    finishedAt: '2026-10-31T10:34:28.796Z' });
  expect(old.methodVersions.displayModelPassPercent).toBe(1);
  expect(current.methodVersions.displayModelPassPercent).toBe(2);
  expect(buildAuditMetricAnalysis(legacy).metrics.displayModelPassPercent.methodVersion).toBe(1);
  old.metrics.displayModelPassPercent = 100;
  current.metrics.displayModelPassPercent = 50;
  expect(auditMetricPlot([old, current], 'displayModelPassPercent').path).not.toContain('L');
});

test('invalid history is rejected instead of silently erasing it', () => {
  const run = auditMetricRun(makePerformanceAuditReport());
  const encode = (runs: unknown[]) => JSON.stringify({ schemaVersion: 1, runs });
  expect(parseAuditMetricHistory(encode([run]))[0].metrics.failures).toEqual(run.metrics.failures);
  for (const invalid of [{ ...run, finishedAt: 'bad' }, { ...run, metrics: {} },
    { ...run, metrics: { ...run.metrics, coveragePercent: 101 } }]) {
    expect(() => parseAuditMetricHistory(encode([invalid]))).toThrow('Invalid audit');
  }
});


test('v1 history keeps old facts and introduces unknown metric gaps; v2 requires complete validated fields', () => {
  const run = auditMetricRun(makePerformanceAuditReport());
  const legacy = { ...run, metrics: { failures: 0, coveragePercent: 99.2, durationMs: 100,
    slowestCheckMs: 2, maxEventLoopLagMs: null, maxFrameGapMs: 0, automatedTaskSuccessPercent: 100, runtimeErrors: 3 } };
  const [migrated] = parseAuditMetricHistory(JSON.stringify({ schemaVersion: 1, runs: [legacy] }));
  expect(migrated.metrics.coveragePercent).toBe(99.2);
  expect(migrated.metrics.maxFrameGapMs).toBe(0);
  expect(migrated.metrics.automatedTaskSuccessPercent).toBeNull();
  expect(migrated.metrics.runtimeErrors).toBeNull();
  expect(Object.keys(migrated.metrics)).toHaveLength(AUDIT_METRICS.length);
  expect(() => parseAuditMetricHistory(JSON.stringify({ schemaVersion: AUDIT_METRIC_HISTORY_VERSION, runs: [legacy] }))).toThrow();
  expect(parseAuditMetricHistory(JSON.stringify({ schemaVersion: AUDIT_METRIC_HISTORY_VERSION, runs: [migrated] }))).toEqual([migrated]);
  expect(() => parseAuditMetricHistory(JSON.stringify({ schemaVersion: AUDIT_METRIC_HISTORY_VERSION,
    runs: [{ ...run, metrics: { ...run.metrics, healthPassPercent: 101 } }] }))).toThrow();
  expect(auditMetricPlot([migrated], 'healthPassPercent')).toMatchObject({ ceiling: 100, points: [null] });
});

test('persisted count metrics reject fractions and unsafe integers while measured durations and percentages retain fractions', () => {
  const run = auditMetricRun(makePerformanceAuditReport());
  const encode = (schemaVersion: number, metrics: typeof run.metrics) => JSON.stringify({ schemaVersion, runs: [{ ...run, metrics }] });
  for (const invalid of [0.5, Number.MAX_SAFE_INTEGER + 1]) {
    expect(() => parseAuditMetricHistory(encode(2, { ...run.metrics, runtimeErrors: invalid }))).toThrow('Invalid audit');
    for (const version of [1, 2]) {
      expect(() => parseAuditMetricHistory(encode(version, { ...run.metrics, failures: invalid }))).toThrow('Invalid audit');
    }
    expect(parseAuditMetricHistory(encode(1, { ...run.metrics, runtimeErrors: invalid }))[0].metrics.runtimeErrors).toBeNull();
  }
  for (const version of [1, 2]) {
    expect(parseAuditMetricHistory(encode(version, { ...run.metrics, durationMs: 10.25, coveragePercent: 99.2 }))[0].metrics)
      .toMatchObject({ durationMs: 10.25, coveragePercent: 99.2 });
  }
});

function journey(id: string, metrics: AuditCheck['metrics'] = {}): AuditCheck {
  return { id, kind: 'journey', label: 'Rates', status: 'pass', durationMs: 100,
    metrics: { executionAttempted: true, actionInvoked: true, actionCompleted: true, nonTimingFailure: false,
      eventLoopMeasurementAvailable: true, frameMeasurementAvailable: true, eventLoopSamples: 10,
      stallsOver100Ms: 1, frameSamples: 20, framesOver50Ms: 2, runtimeErrors: 0,
      actionMs: 100, forwardWorkMs: 150, backMs: 20, ...metrics },
    diagnostic: { stage: 'complete', readiness: { ready: true, capturing: true, blockers: [], surfaces: [] } } };
}

test('automated task outcomes stay distinct from timing failures and sample rates use weighted denominators', () => {
  const first = journey('first'); first.status = 'fail'; first.metrics.actionMs = 3000;
  const second = journey('second', { eventLoopSamples: 90, stallsOver100Ms: 0, frameSamples: 180,
    framesOver50Ms: 0, actionMs: 10, forwardWorkMs: 30, backMs: 60, secondBackMs: 15 });
  const report = makePerformanceAuditReport('tasks', [first, second]);
  const metrics = auditMetricRun(report).metrics;
  expect(metrics.automatedTaskSuccessPercent).toBe(100);
  expect(metrics.checkPassPercent).toBe(50);
  expect(metrics.timingFailures).toBe(1);
  expect(metrics.jsStallPercent).toBe(1);
  expect(metrics.slowFramePercent).toBe(1);
  expect(metrics.actionP50Ms).toBe(10);
  expect(metrics.actionP95Ms).toBe(3000);
  expect(metrics.backP95Ms).toBe(60);
  expect(metrics.recoveryPercent).toBe(0);
  second.metrics.replaceRecoveryMs = 15;
  expect(auditMetricRun(report).metrics.recoveryPercent).toBe(50);
  expect(metrics.runtimeErrors).toBe(0);
  second.metrics.frameMeasurementAvailable = false;
  expect(auditMetricRun(report).metrics.responsivenessCoveragePercent).toBe(50);
  delete second.metrics.runtimeErrors;
  expect(auditMetricRun(report).metrics.runtimeErrors).toBeNull();
});

test('coverage scores retain missing plans, unverified local links and display failures in their denominator', () => {
  const link: AuditCheck = { id: 'external-link-1', label: 'Link', kind: 'network', status: 'warn', durationMs: 1,
    metrics: { httpAttempted: false, httpReachability: 'unknown', browserHandler: 'pass' } };
  const report = makePerformanceAuditReport('coverage', [journey('first'), link]);
  report.coverage = { plannedChecks: 3, storedChecks: 2, plannedJourneyChecks: 2, executedJourneyChecks: 1,
    justifiedSkippedJourneyChecks: 0, unexpectedSkippedJourneyChecks: 0, unavailableJourneyChecks: 0,
    coveragePercent: 50, attemptedPercent: 66.7, missingPlannedCheckIds: ['missing'], duplicateStoredCheckIds: [],
    unexpectedStoredCheckIds: [], excludedUnsafeFacetCount: 0, complete: false };
  report.appHealth = finalizeAppHealthReport({ sessionId: report.sessionId, mode: 'local',
    startedAt: report.startedAt, finishedAt: report.finishedAt, plannedCheckIds: [APP_HEALTH_CHECK_CODES.DISPLAY_LAYOUT],
    checks: [{ id: APP_HEALTH_CHECK_CODES.DISPLAY_LAYOUT, code: APP_HEALTH_CHECK_CODES.DISPLAY_LAYOUT,
      domain: 'display-completeness', label: 'Layout', status: 'fail',
      metrics: { checked: 4, missing: 1, failed: 1, warned: 0, unavailable: 1 } }] });
  expect(auditMetricRun(report).metrics).toMatchObject({ collectionPercent: 66.7, journeyCoveragePercent: 50,
    missingChecks: 1, linkVerificationPercent: 0, unverifiedLinks: 1, displayLayoutPassPercent: 40,
    detailsCoveragePercent: null, providerSuccessPercent: null, historySourceCoveragePercent: null });
});

test('absent or invalid evidence does not fabricate healthy quality scores', () => {
  const report = makePerformanceAuditReport();
  expect(auditMetricRun(report).metrics).toMatchObject({ automatedTaskSuccessPercent: null,
    runtimeErrors: null, checkPassPercent: null, dataIntegrityPassPercent: null, healthPassPercent: null,
    displayLayoutPassPercent: null, collectionPercent: null, readinessCoveragePercent: null });
  const check = journey('invalid', { eventLoopSamples: 1, stallsOver100Ms: 2 });
  expect(auditMetricRun(makePerformanceAuditReport('invalid', [check])).metrics.jsStallPercent).toBeNull();
});


test('duplicate health results and unexpected surfaces cannot replace missing planned evidence', () => {
  const report = makePerformanceAuditReport();
  const layout = { id: APP_HEALTH_CHECK_CODES.DISPLAY_CONTRACT, code: APP_HEALTH_CHECK_CODES.DISPLAY_CONTRACT,
    domain: 'display-completeness' as const, label: 'Surfaces', status: 'fail' as const,
    metrics: { plannedSurfaces: 2, observedSurfaces: 2, missingSurfaces: 1,
      duplicateContracts: 0, duplicateObservations: 1, unexpectedSurfaces: 0 } };
  report.appHealth = finalizeAppHealthReport({ sessionId: report.sessionId, mode: 'local',
    startedAt: report.startedAt, finishedAt: report.finishedAt, plannedCheckIds: [layout.id], checks: [layout] });
  expect(auditMetricRun(report).metrics.surfaceCoveragePercent).toBe(50);
  report.appHealth.checks.push(report.appHealth.checks[0]);
  expect(auditMetricRun(report).metrics.healthCoveragePercent).toBeNull();
  expect(auditMetricRun(report).metrics.healthPassPercent).toBeNull();
  expect(auditMetricRun(report).metrics.dataCompletenessPassPercent).toBeNull();
});
