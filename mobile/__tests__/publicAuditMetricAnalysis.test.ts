import { makePerformanceAuditReport } from '../__fixtures__/performanceAuditReport';
import { auditMetricRun, AUDIT_METRICS } from '../src/lib/auditMetricHistory';
import { buildDeidentifiedPerformanceAudit, createPublicPerformanceAuditReport, encodeHostedPerformanceAudit } from '../src/lib/diagnosticsEnvelope';
import { decodeCompactDiagnosticJson, encodeCompressedDiagnosticJson } from '../src/lib/compactDiagnosticJson';
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
    expect(publicReport.metricAnalysis.metrics[metric]).toMatchObject({ value: values[metric],
      methodVersion: [
        'actionP50Ms', 'actionP95Ms', 'displayModelPassPercent', 'displayListPassPercent',
        'displayVisiblePassPercent', 'displayLayoutPassPercent', 'displayEmptyPassPercent', 'displayLogoPassPercent',
      ].includes(metric) ? 2 : 1 });
    expect(publicReport.metricAnalysis.metrics[metric].formula).toEqual(expect.any(String));
  }
  const standalone = fullAuditDiagnosticLog(report, id => id) as { metricAnalysis: unknown };
  expect(standalone.metricAnalysis).toEqual(publicReport.metricAnalysis);
  expect(JSON.parse(JSON.stringify(standalone)).metricAnalysis).toEqual(publicReport.metricAnalysis);
  const hosted = decodeCompactDiagnosticJson(createPublicPerformanceAuditReport(report)) as {
    metricAnalysis: typeof publicReport.metricAnalysis; diagnosticLog: { metricAnalysis: unknown };
  };
  expect(hosted.metricAnalysis).toEqual(publicReport.metricAnalysis);
  expect(hosted.diagnosticLog.metricAnalysis).toEqual({ $ref: '$.metricAnalysis' });
  expect(hosted.diagnosticLog.metricAnalysis).not.toHaveProperty('metrics');
  // An extracted log becomes self-contained only when its envelope-owned analysis is retained.
  const extracted = { ...hosted.diagnosticLog, metricAnalysis: hosted.metricAnalysis };
  expect(JSON.parse(JSON.stringify(extracted)).metricAnalysis).toEqual(standalone.metricAnalysis);
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

test('budget fallback omits only regenerable analysis and retains complete source evidence', () => {
  const report = reportFixture();
  report.checks = Array.from({ length: 100 }, (_, index) => ({ ...report.checks[0],
    id: `external-link-${index + 1}`, metrics: { ...report.checks[0].metrics, actionMs: index + .125 } }));
  const source = { ...buildDeidentifiedPerformanceAudit(report),
    diagnosticLog: fullAuditDiagnosticLog(report, id => id, { metricAnalysis: 'top-level' }),
    applicationJournal: { beforeAudit: { entries: [{ message: 'retained', count: 0 }] },
      duringAndAfterAudit: { entries: [{ failed: false, unknown: null }] } } };
  const omission = { schemaVersion: 1, methodVersions: [1, 2], status: 'omitted', reason: 'export-budget',
    regenerableFrom: 'retained-local-report' };
  const expected = { ...source, metricAnalysis: omission,
    diagnosticLog: { ...(source.diagnosticLog as Record<string, unknown>), metricAnalysis: omission } };
  const budget = new TextEncoder().encode(encodeCompressedDiagnosticJson(expected)).length;
  expect(new TextEncoder().encode(encodeCompressedDiagnosticJson(source)).length).toBeGreaterThan(budget);
  const body = encodeHostedPerformanceAudit(source, {}, budget);
  expect(decodeCompactDiagnosticJson(body)).toEqual(expected);
  expect(JSON.stringify(decodeCompactDiagnosticJson(body))).not.toContain('"$ref":"$.metricAnalysis"');
  expect(() => encodeHostedPerformanceAudit(source, {}, budget - 1)).toThrow('exceeds the public upload limit');
  // Hosted fallback cannot mutate the retained report or standalone full evidence.
  expect((fullAuditDiagnosticLog(report, id => id) as { metricAnalysis: unknown }).metricAnalysis)
    .toEqual(source.metricAnalysis);
  expect(source.metricAnalysis.observations.length).toBeGreaterThan(0);
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
