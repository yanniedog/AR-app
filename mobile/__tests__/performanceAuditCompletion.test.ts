import { makePerformanceAuditReport } from '../__fixtures__/performanceAuditReport';
import { buildPerformanceAuditCompletion, publicAuditTimestamp } from '../src/lib/performanceAuditCompletion';
import { createPublicPerformanceAuditReport } from '../src/lib/diagnosticsEnvelope';
import { decodeCompactDiagnosticJson } from '../src/lib/compactDiagnosticJson';
import { APP_HEALTH_CHECK_CODES, finalizeAppHealthReport } from '../src/lib/appHealth';

function completeReport() {
  const report = makePerformanceAuditReport('private-run', [{ id: 'journey-rates-cold', label: 'Rates', kind: 'journey',
    status: 'pass', durationMs: 5, metrics: { executionAttempted: true, actionCompleted: true },
    diagnostic: { stage: 'complete', readiness: { ready: true, capturing: true, blockers: [], surfaces: [] } } }]);
  report.coverage = { plannedChecks: 1, storedChecks: 1, plannedJourneyChecks: 1, executedJourneyChecks: 1,
    justifiedSkippedJourneyChecks: 0, unexpectedSkippedJourneyChecks: 0, unavailableJourneyChecks: 0,
    coveragePercent: 100, attemptedPercent: 100, missingPlannedCheckIds: [], duplicateStoredCheckIds: [],
    unexpectedStoredCheckIds: [], excludedUnsafeFacetCount: 0, complete: true };
  report.appHealth = finalizeAppHealthReport({ sessionId: report.sessionId, mode: 'local',
    startedAt: report.startedAt, finishedAt: report.finishedAt, plannedCheckIds: [APP_HEALTH_CHECK_CODES.CORE_SCHEMA],
    checks: [{ id: APP_HEALTH_CHECK_CODES.CORE_SCHEMA, code: APP_HEALTH_CHECK_CODES.CORE_SCHEMA,
      domain: 'data-integrity', label: 'Core', status: 'pass', metrics: {} }] });
  return report;
}

test('hosted header and decoded full report identify the same exact completed audit', () => {
  const report = completeReport();
  const body = createPublicPerformanceAuditReport(report);
  const header = JSON.parse(body).audit;
  const decoded = decodeCompactDiagnosticJson(body) as any;
  expect(header).toMatchObject({ auditId: expect.stringMatching(/^audit-[a-f0-9]{16}$/),
    finishedAt: '2026-10-15T18:01:00.000Z', outcome: 'successful', collectionComplete: true,
    coverageComplete: true, detailsComplete: true, performanceCheckCount: 1, healthCheckCount: 2, failureCount: 0 });
  expect(decoded.completion.auditId).toBe(header.auditId);
  expect(decoded.diagnosticLog.sessionId).toBe(header.auditId);
  expect(decoded.diagnosticLog.finishedAt).toBe(header.finishedAt);
  expect(body).not.toContain('private-run');
  expect(buildPerformanceAuditCompletion({ ...report, sessionId: 'another-run' }).auditId).not.toBe(header.auditId);
});

test('retained failed measurements remain complete, with timing and functional failure positions', () => {
  const report = completeReport();
  report.checks[0].status = 'fail';
  report.checks[0].metrics = { executionAttempted: true, actionCompleted: true, actionMs: 980, nonTimingFailure: false };
  report.checks[0].diagnostic!.stage = 'action';
  expect(buildPerformanceAuditCompletion(report)).toMatchObject({ outcome: 'failed', collectionComplete: true,
    coverageComplete: true, detailsComplete: true, failurePositions: [{ position: 1, source: 'performance',
      checkId: 'journey-rates-cold', stage: 'action', category: 'timing' }] });
  report.checks[0].metrics.nonTimingFailure = true;
  expect(buildPerformanceAuditCompletion(report).failurePositions[0].category).toBe('failure');
});

test('legacy bounded evidence loss remains explicit after private evidence is redacted', () => {
  const report = completeReport();
  report.checks[0].error = 'Private error…[truncated 123 chars]';
  report.checks[0].metrics.privateText = 'Private metric…[truncated 40 chars]';
  const body = createPublicPerformanceAuditReport(report);
  const decoded = decodeCompactDiagnosticJson(body) as any;
  expect(decoded.completion).toMatchObject({ outcome: 'incomplete', collectionComplete: true,
    detailsComplete: false, gaps: { truncatedEvidenceFields: 2, omittedEvidenceChars: 163 } });
  expect(body).not.toContain('Private error');
  expect(body).not.toContain('Private metric');
});

test('unbounded canonical metrics remain represented without truncation', () => {
  const report = completeReport();
  report.checks[0].metrics.privateText = 'Private input'.repeat(500);
  report.checks[0].error = 'TypeError: private error'.repeat(300);
  const decoded = decodeCompactDiagnosticJson(createPublicPerformanceAuditReport(report)) as any;
  expect(decoded.completion.gaps.truncatedEvidenceFields).toBe(0);
  expect(decoded.diagnosticLog.checks[0].metrics.privateText).toMatch(/^~private/);
  expect(decoded.diagnosticLog.checks[0].errorDetails.type).toBe('TypeError');
});

test('missing, unavailable and health not-run results cannot claim complete coverage', () => {
  const report = completeReport();
  report.checks[0].status = 'skipped';
  report.checks[0].metrics = { availabilityFailure: true, executionAttempted: false };
  report.coverage!.plannedChecks = 2;
  report.coverage!.missingPlannedCheckIds = ['journey-market-cold'];
  report.coverage!.complete = false;
  report.appHealth = finalizeAppHealthReport({ sessionId: report.sessionId, mode: 'local',
    startedAt: report.startedAt, finishedAt: report.finishedAt, checks: [],
    plannedCheckIds: [APP_HEALTH_CHECK_CODES.CORE_SCHEMA] });
  const result = buildPerformanceAuditCompletion(report);
  expect(result).toMatchObject({ outcome: 'failed', collectionComplete: false, coverageComplete: false,
    gaps: { missingChecks: 2, skippedChecks: 1, unavailableChecks: 1 } });
  expect(result.missingPlannedChecks).toContainEqual({ source: 'performance', checkId: 'journey-market-cold' });
  expect(result.gapPositions).toContainEqual({ source: 'performance', position: 1, checkId: 'journey-rates-cold', reason: 'unavailable' });
  delete report.coverage;
  expect(buildPerformanceAuditCompletion(report).collectionComplete).toBe(false);
});

test('public completion identities and stages never export arbitrary saved text', () => {
  const report = completeReport();
  report.checks[0].id = 'private-account-id';
  report.checks[0].status = 'fail';
  report.checks[0].diagnostic = { stage: 'private-stage', readiness: null } as never;
  report.startedAt = 'private-date';
  report.finishedAt = '2026-02-29T10:00:00Z';
  const decoded = decodeCompactDiagnosticJson(createPublicPerformanceAuditReport(report)) as any;
  expect(decoded.completion).toMatchObject({ startedAt: null, finishedAt: null, timestampsValid: false,
    failurePositions: [{ checkId: null, stage: null }] });
  expect(publicAuditTimestamp('2024-02-29T10:00:00Z')).toBe('2024-02-29T10:00:00.000Z');
});

test('independent evidence checks expose false complete flags and missing readiness', () => {
  const report = completeReport();
  delete report.checks[0].diagnostic;
  expect(buildPerformanceAuditCompletion(report)).toMatchObject({ collectionComplete: true, detailsComplete: false,
    outcome: 'incomplete', gaps: { missingReadinessChecks: 1 } });
  report.checks.push({ ...report.checks[0] });
  report.coverage!.storedChecks = 2;
  report.coverage!.plannedChecks = 2;
  expect(buildPerformanceAuditCompletion(report)).toMatchObject({ collectionComplete: false,
    gaps: { duplicateChecks: 1, missingChecks: 1 } });
});

test('health failures, unavailable and not-run evidence retain separate positions and counts', () => {
  const report = completeReport();
  const codes = [APP_HEALTH_CHECK_CODES.CORE_SCHEMA, APP_HEALTH_CHECK_CODES.FRESHNESS, APP_HEALTH_CHECK_CODES.DISPLAY_CHART];
  report.appHealth = finalizeAppHealthReport({ sessionId: report.sessionId, mode: 'local',
    startedAt: report.startedAt, finishedAt: report.finishedAt, plannedCheckIds: codes,
    checks: codes.map((code, index) => ({ id: code, code, domain: 'data-integrity', label: 'Private health label',
      status: (['fail', 'unavailable', 'not-run'] as const)[index], metrics: {} })) });
  const result = buildPerformanceAuditCompletion(report);
  expect(result).toMatchObject({ outcome: 'failed', collectionComplete: true, coverageComplete: false,
    performanceCheckCount: 1, healthCheckCount: 4, gaps: { unavailableChecks: 1, notRunChecks: 1 },
    failurePositions: [{ source: 'health', position: 1, checkId: codes[0], category: 'failure' }] });
  expect(result.gapPositions).toEqual([{ source: 'health', position: 2, checkId: codes[1], reason: 'unavailable' },
    { source: 'health', position: 3, checkId: codes[2], reason: 'not-run' }]);
});

test('recorded links with no HTTP attempt stay incomplete with their exact positions', () => {
  const report = completeReport();
  report.checks[0] = { id: 'external-link-3', label: 'Private destination', kind: 'network', status: 'warn', durationMs: 0,
    metrics: { httpAttempted: false, httpReachability: 'unknown', browserHandler: 'available' } };
  expect(buildPerformanceAuditCompletion(report)).toMatchObject({ outcome: 'incomplete', collectionComplete: true,
    coverageComplete: false, gaps: { unverifiedLinks: 1 }, gapPositions: [{ source: 'performance',
      position: 1, checkId: 'external-link-3', reason: 'unverified-link' }] });
});

test('current schema without health diagnosis cannot claim exhaustive detail', () => {
  const report = completeReport();
  delete report.appHealth;
  expect(buildPerformanceAuditCompletion(report)).toMatchObject({ outcome: 'incomplete',
    coverageComplete: false, detailsComplete: false, gaps: { missingHealthReports: 1 } });
});
