import { makePerformanceAuditReport } from '../__fixtures__/performanceAuditReport';
import { auditMetricRun, AUDIT_METRICS } from '../src/lib/auditMetricHistory';
import { buildDeidentifiedPerformanceAudit, createPublicPerformanceAuditReport } from '../src/lib/diagnosticsEnvelope';
import { decodeCompactDiagnosticJson } from '../src/lib/compactDiagnosticJson';
import { fullAuditDiagnosticLog } from '../src/lib/fullAuditDiagnosticLog';
import { publicAuditMetricAnalysis } from '../src/lib/publicAuditMetricAnalysis';

function reportFixture() {
  return makePerformanceAuditReport('private-analysis-session', [{
    id: 'journey-rates-cold', label: 'Private borrower name', kind: 'journey', status: 'pass', durationMs: 100,
    metrics: { executionAttempted: true, actionInvoked: true, actionCompleted: true, nonTimingFailure: false,
      forwardWorkMs: 75, actionMs: 25, eventLoopMeasurementAvailable: true, frameMeasurementAvailable: true,
      eventLoopSamples: 10, stallsOver100Ms: 1, maxEventLoopLagMs: 110, frameSamples: 20, framesOver50Ms: 2, maxFrameGapMs: 60 },
    diagnostic: { stage: 'complete', readiness: { ready: true, capturing: true, blockers: [], surfaces: [] } },
  }]);
}

test('hosted and standalone reports contain the same derived metric evidence with one hosted observation table', () => {
  const report = reportFixture();
  const publicReport = buildDeidentifiedPerformanceAudit(report);
  const values = auditMetricRun(report).metrics;
  expect(Object.keys(publicReport.metricAnalysis.metrics).sort()).toEqual([...AUDIT_METRICS].sort());
  for (const metric of AUDIT_METRICS) {
    expect(publicReport.metricAnalysis.metrics[metric]).toMatchObject({ value: values[metric], methodVersion: 1 });
    expect(publicReport.metricAnalysis.metrics[metric].formula).toEqual(expect.any(String));
  }
  const standalone = fullAuditDiagnosticLog(report, id => id) as { metricAnalysis: unknown };
  expect(standalone.metricAnalysis).toEqual(publicReport.metricAnalysis);
  const hosted = decodeCompactDiagnosticJson(createPublicPerformanceAuditReport(report)) as {
    metricAnalysis: typeof publicReport.metricAnalysis; diagnosticLog: { metricAnalysis: unknown };
  };
  expect(hosted.metricAnalysis).toEqual(publicReport.metricAnalysis);
  expect(hosted.diagnosticLog.metricAnalysis).toEqual({ $ref: '$.metricAnalysis' });
  expect(hosted.metricAnalysis.observations.length).toBeGreaterThan(0);
  const count = hosted.metricAnalysis.observations.length;
  for (const metric of Object.values(hosted.metricAnalysis.metrics)) {
    expect(metric.contributors.every(index => Number.isInteger(index) && index >= 0 && index < count)).toBe(true);
  }
});

test('saved analysis cannot forge derived scores or leak private labels and identifiers', () => {
  const report = reportFixture();
  report.checks[0].id = 'private-person@example.invalid';
  Object.assign(report, { metricAnalysis: { privateAnalysisKey: 'PRIVATE_ANALYSIS_SECRET',
    metrics: { actionP50Ms: { value: 987654321, formula: 'PRIVATE_ANALYSIS_FORMULA' } } } });
  const shared = buildDeidentifiedPerformanceAudit(report);
  expect(shared.metricAnalysis.metrics.actionP50Ms.value).toBe(25);
  expect(JSON.stringify(shared.metricAnalysis)).not.toMatch(/private-person|Private borrower|PRIVATE_ANALYSIS|987654321/);
  expect(shared.metricAnalysis.observations.some(item => item.source === 'performance' && item.checkId === null
    && Number.isInteger(item.position))).toBe(true);
  const hosted = decodeCompactDiagnosticJson(createPublicPerformanceAuditReport(report));
  expect(JSON.stringify(hosted)).not.toMatch(/private-person|Private borrower|PRIVATE_ANALYSIS|987654321/);
});

test('performance evidence identifiers use the caller privacy boundary without changing observation indexes', () => {
  const report = reportFixture();
  const fixed = publicAuditMetricAnalysis(report, id => id);
  const hidden = publicAuditMetricAnalysis(report, () => null);
  expect(hidden.observations.length).toBe(fixed.observations.length);
  expect(hidden.metrics).toEqual(fixed.metrics);
  const positions = fixed.observations.flatMap((item, index) => item.source === 'performance' && item.checkId ? [index] : []);
  expect(positions.length).toBeGreaterThan(0);
  for (const index of positions) expect(hidden.observations[index]).toEqual({ ...fixed.observations[index], checkId: null });
});


test('public completion and metric observations redact arbitrary target role IDs while retaining defect evidence', () => {
  const report = reportFixture();
  report.checks[0].metrics.expectedSurface = 'private-borrower-surface';
  report.checks[0].diagnostic!.readiness = { ready: false, capturing: true, blockers: [], surfaces: [{
    id: 'private-borrower-surface', actionRevision: 0, probes: [{ id: 'private-account-probe',
      kind: 'layout', required: true, status: 'error', renderMatches: false }],
  }] } as never;
  const exported = buildDeidentifiedPerformanceAudit(report);
  expect(exported.completion.gaps.targetProbeDefects).toBe(2);
  expect(exported.completion.gapPositions.filter(gap => gap.reason === 'probe-error')).toEqual([
    expect.objectContaining({ surfaceId: null, probeId: null, position: 1, checkId: 'journey-rates-cold' }),
  ]);
  const observed = exported.metricAnalysis.observations.filter(item => item.field === 'probe-error');
  expect(observed).toEqual([expect.objectContaining({ surfaceId: null, probeId: null, position: 1, value: true })]);
  const hosted = decodeCompactDiagnosticJson(createPublicPerformanceAuditReport(report));
  expect(JSON.stringify(hosted)).not.toMatch(/private-borrower-surface|private-account-probe/);
});
