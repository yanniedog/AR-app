import { makePerformanceAuditReport } from '../__fixtures__/performanceAuditReport';
import { fullAuditDiagnosticLog } from '../src/lib/fullAuditDiagnosticLog';
import { createPublicPerformanceAuditReport } from '../src/lib/diagnosticsEnvelope';
import { decodeCompactDiagnosticJson } from '../src/lib/compactDiagnosticJson';

test('every upload includes all retained checks, errors, traces, metrics and diagnostic context', () => {
  const report = makePerformanceAuditReport('private-session');
  report.checks = [{ id: 'deep-first-pass.route.projections.projections.advanced.toggle', label: 'Private input label', kind: 'journey',
    status: 'fail', durationMs: 10031.1, metrics: { actionMs: 4.2, phaseDetail: 'model pending', accountBalance: 987654,
      renderRevisionBefore: 'private-inputs', renderRevisionAfter: 'private-inputs', secretValue: 'KEYSECRET' },
    error: 'TypeError: model was not ready; account: 123456; password=TOPSECRET; Authorization: Bearer BEARERSECRET',
    trace: 'at waitForReady (https://private.example/app.js:1:1234)',
    diagnostic: { stage: 'pre-action', readiness: null } }];
  const body = createPublicPerformanceAuditReport(report);
  const decoded = decodeCompactDiagnosticJson(body) as { diagnosticLog: typeof report };
  expect(decoded.diagnosticLog).toEqual(fullAuditDiagnosticLog(report, id => id));
  expect(decoded.diagnosticLog.checks).toHaveLength(1);
  expect(decoded.diagnosticLog.checks[0]).toMatchObject({ durationMs: 10031.1, metrics: { actionMs: 4.2, phaseDetail: expect.stringMatching(/^~private/) }, diagnostic: { stage: 'pre-action' },
    errorDetails: { present: true, type: 'TypeError', frames: [['frame', 1, 1234]] } });
  expect(decoded.diagnosticLog.checks[0].error).toMatch(/^~private/);
  expect(decoded.diagnosticLog.checks[0].trace).toMatch(/^~private/);
  expect(decoded.diagnosticLog.checks[0].metrics.renderRevisionBefore).toBe(decoded.diagnosticLog.checks[0].metrics.renderRevisionAfter);
  expect(body).not.toMatch(/private-session|Private input label|private-inputs|private\.example|987654|123456|TOPSECRET|KEYSECRET|BEARERSECRET/);
  expect(createPublicPerformanceAuditReport(report)).toBe(body);
});

test('unlabelled runtime text defaults to opaque correlatable aliases', () => {
  const report = makePerformanceAuditReport();
  const privateValues = ['Jane Citizen', '+61 412 345 678', 'device-ABC123', 'Failed for customer ABC123'];
  report.checks = [{ id: 'journey-rates-cold', label: 'Rates', kind: 'journey', status: 'fail', durationMs: 1,
    error: privateValues[3], trace: privateValues[0], metrics: { incidental: privateValues[1], other: privateValues[2] },
    diagnostic: { stage: 'readiness', readiness: { blockers: [{ message: privateValues[3] }] } } as never }];
  const body = createPublicPerformanceAuditReport(report);
  for (const value of privateValues) expect(body).not.toContain(value);
  const decoded = decodeCompactDiagnosticJson(body) as { diagnosticLog: typeof report };
  const check = decoded.diagnosticLog.checks[0];
  expect(check.diagnostic?.readiness).toMatchObject({ blockers: [{ message: check.error }] });
});
test('unknown saved-check identities remain correlatable aliases rather than private strings', () => {
  const report = makePerformanceAuditReport('private-session');
  report.checks = [{ id: 'account-123456-private-check', label: 'Private label', kind: 'runtime', status: 'fail', durationMs: 1, metrics: {} }];
  report.summary.slowestCheckId = report.checks[0].id;
  const body = createPublicPerformanceAuditReport(report);
  const decoded = decodeCompactDiagnosticJson(body) as { diagnosticLog: typeof report };
  expect(body).not.toContain('account-123456');
  expect(decoded.diagnosticLog.summary.slowestCheckId).toBe(decoded.diagnosticLog.checks[0].id);
});
