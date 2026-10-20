import { makePerformanceAuditReport } from '../__fixtures__/performanceAuditReport';
import { fullAuditDiagnosticLog } from '../src/lib/fullAuditDiagnosticLog';
import { createPublicPerformanceAuditReport } from '../src/lib/diagnosticsEnvelope';
import { decodeCompactDiagnosticJson } from '../src/lib/compactDiagnosticJson';
import { APP_HEALTH_CHECK_CODES, finalizeAppHealthReport, toPublicAppHealthReport } from '../src/lib/appHealth';

test('every upload includes all retained checks, errors, traces, metrics and diagnostic context', () => {
  const report = makePerformanceAuditReport('private-session');
  report.checks = [{ id: 'deep-first-pass.route.projections.projections.advanced.toggle', label: 'Private input label', kind: 'journey',
    status: 'fail', durationMs: 10031.1, metrics: { actionMs: 4.2, phaseDetail: 'model pending', accountBalance: 987654,
      renderRevisionBefore: 'private-inputs', renderRevisionAfter: 'private-inputs', secretValue: 'KEYSECRET' },
    error: 'TypeError: model was not ready; account: 123456; password=TOPSECRET; Authorization: Bearer BEARERSECRET',
    trace: 'at waitForReady (https://private.example/app.js:1:1234)',
    diagnostic: { stage: 'pre-action', readiness: null } },
    { id: 'journey-rates-cold', label: 'Rates', kind: 'journey', status: 'warn', durationMs: 41,
      metrics: { actionMs: 13, maxFrameGapMs: 23 }, error: 'Different runtime failure' }];
  const body = createPublicPerformanceAuditReport(report);
  const decoded = decodeCompactDiagnosticJson(body) as { diagnosticLog: typeof report };
  expect(decoded.diagnosticLog).toEqual(fullAuditDiagnosticLog(report, id => id));
  expect(decoded.diagnosticLog.checks.map(check => check.id)).toEqual(report.checks.map(check => check.id));
  expect(decoded.diagnosticLog.checks[1]).toMatchObject({ status: 'warn', durationMs: 41, metrics: { actionMs: 13, maxFrameGapMs: 23 } });
  expect(decoded.diagnosticLog.checks[1].error).not.toBe(decoded.diagnosticLog.checks[0].error);
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
  const aliases = [check.error, check.trace, ...Object.values(check.metrics)];
  expect(new Set(aliases).size).toBe(4);
});

test('unknown property names and numeric or boolean values are private', () => {
  const report = makePerformanceAuditReport();
  report.checks = [{ id: 'journey-rates-cold', label: 'Rates', kind: 'journey', status: 'fail', durationMs: 2,
    metrics: { 'jane@private.example': 123456789.125, customerAge: 73.5, privateEligibility: true, actionMs: 3.5 } }];
  const body = createPublicPerformanceAuditReport(report);
  expect(body).not.toMatch(/jane@private|customerAge|privateEligibility|123456789|73\.5/);
  const decoded = decodeCompactDiagnosticJson(body) as { diagnosticLog: typeof report };
  expect(decoded.diagnosticLog.checks[0].metrics).toMatchObject({ actionMs: 3.5 });
  expect(Object.values(decoded.diagnosticLog.checks[0].metrics).filter(value => typeof value === 'string')).toHaveLength(3);
});

test('generic report scalar and enum keys in arbitrary metrics remain private', () => {
  const report = makePerformanceAuditReport();
  report.checks = [{ id: 'journey-rates-cold', label: 'Rates', kind: 'journey', status: 'fail', durationMs: 2,
    metrics: { actual: 123456.25, expected: 234567.25, visible: 345678.25, pass: 456789.25, complete: true,
      stage: 'readiness', platform: 'android', appVersion: '999999999', kind: 'journey', actionMs: 3.5 } }];
  const decoded = fullAuditDiagnosticLog(report, id => id) as typeof report;
  const metrics = decoded.checks[0].metrics;
  expect(metrics.actionMs).toBe(3.5);
  for (const [key, value] of Object.entries(metrics)) if (key !== 'actionMs') expect(value).toMatch(/^~private/);
  expect(decoded.checks[0].durationMs).toBe(2);
  expect(decoded.environment.platform).toBe('android');
});

test.each(['route-round-trip', 'semantic-action', 'segmented-payload-capacity'])('retains production measurement mode %s and navigation recovery', measurementMode => {
  const report = makePerformanceAuditReport();
  const navigationKinds = ['none', 'second-back', 'replace-recovery', 'second-back+replace-recovery', 'anchor-reset', 'second-back+anchor-reset'];
  report.checks = navigationKinds.map(returnNavigationKind => ({ id: 'journey-rates-cold', label: 'Rates', kind: 'journey',
    status: 'pass', durationMs: 1, metrics: { measurementMode, returnNavigationKind } }));
  const decoded = fullAuditDiagnosticLog(report, id => id) as typeof report;
  expect(decoded.checks.map(check => check.metrics)).toEqual(report.checks.map(check => check.metrics));
});

test('readiness IDs cannot use the check-ID exception', () => {
  const report = makePerformanceAuditReport();
  report.checks = [{ id: 'deep-first-pass.route.projections.projections.advanced.toggle', label: 'Rates', kind: 'journey', status: 'fail', durationMs: 2,
    metrics: {}, diagnostic: { stage: 'readiness', readiness: { surfaces: [{ id: 'deep-first-pass.customer-123' }],
      probes: [{ id: 'deep-repeat.customer-456' }] } } as never }];
  const body = createPublicPerformanceAuditReport(report);
  expect(body).not.toMatch(/customer-123|customer-456/);
  const decoded = decodeCompactDiagnosticJson(body) as { diagnosticLog: typeof report };
  expect(decoded.diagnosticLog.checks[0].id).toBe(report.checks[0].id);
});

test('source strings matching generated alias names remain distinct values', () => {
  const report = makePerformanceAuditReport();
  report.checks = [{ id: 'journey-rates-cold', label: 'Rates', kind: 'journey', status: 'fail', durationMs: 1,
    error: 'first private value', metrics: { phaseDetail: 'first private value' } }];
  const first = fullAuditDiagnosticLog(report, id => id) as typeof report;
  report.checks[0].trace = first.checks[0].error;
  const second = fullAuditDiagnosticLog(report, id => id) as typeof report;
  expect(second.checks[0].error).toBe(first.checks[0].error);
  expect(second.checks[0].error).toBe(second.checks[0].metrics.phaseDetail);
  expect(second.checks[0].trace).not.toBe(second.checks[0].error);
});

test.each(['healthy', 'attention', 'bottleneck'] as const)('retains source-authored %s outcome and diagnostic modes', overall => {
  const report = makePerformanceAuditReport();
  report.summary.overall = overall;
  report.environment.payloadSource = 'sample';
  report.environment.auditCoverageProfile = 'basic';
  report.plan = { safety: { stateImpact: 'none' } } as never;
  report.checks = [{ id: 'journey-rates-cold', label: 'Rates', kind: 'journey', status: 'pass', durationMs: 1,
    metrics: { measurementMode: 'basic', returnNavigationKind: 'second-back' } }];
  const decoded = fullAuditDiagnosticLog(report, id => id) as typeof report;
  expect(decoded.summary.overall).toBe(overall);
  expect(decoded.environment).toMatchObject({ payloadSource: 'sample', auditCoverageProfile: 'basic' });
  expect(decoded.plan).toMatchObject({ safety: { stateImpact: 'none' } });
  expect(decoded.checks[0].metrics).toMatchObject({ measurementMode: 'basic', returnNavigationKind: 'second-back' });
});

test('fixed enum text is readable only in its source-authored field', () => {
  const report = makePerformanceAuditReport();
  report.checks = [{ id: 'journey-rates-cold', label: 'Rates', kind: 'journey', status: 'fail', durationMs: 1,
    metrics: { customerName: 'Hermes', person: 'Android', phoneOwner: 'ready', unexpected: 'TypeError' } }];
  const decoded = decodeCompactDiagnosticJson(createPublicPerformanceAuditReport(report)) as { diagnosticLog: typeof report };
  expect(decoded.diagnosticLog.environment).toMatchObject({ jsEngine: 'Hermes', osName: 'Android' });
  expect(decoded.diagnosticLog.checks[0]).toMatchObject({ kind: 'journey', status: 'fail' });
  for (const value of Object.values(decoded.diagnosticLog.checks[0].metrics)) expect(value).toMatch(/^~private/);
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

test('preserves the complete dedicated public app-health schema', () => {
  const report = makePerformanceAuditReport();
  report.appHealth = finalizeAppHealthReport({ sessionId: 'private-health-session', mode: 'local',
    startedAt: '2026-10-21T00:00:00Z', finishedAt: '2026-10-21T00:00:01Z',
    plannedCheckIds: [APP_HEALTH_CHECK_CODES.SOURCE_STATE, APP_HEALTH_CHECK_CODES.AUDIT_PLAN],
    checks: [{ id: APP_HEALTH_CHECK_CODES.SOURCE_STATE, code: APP_HEALTH_CHECK_CODES.SOURCE_STATE,
      label: 'Source state', domain: 'data-integrity', status: 'fail', metrics: { source: 'cache', coreAvailable: false },
      localEvidence: { providerNames: ['Private Bank'] } }] });
  const body = createPublicPerformanceAuditReport(report);
  const decoded = decodeCompactDiagnosticJson(body) as { diagnosticLog: { appHealth: unknown } };
  expect(decoded.diagnosticLog.appHealth).toEqual(toPublicAppHealthReport(report.appHealth));
  expect(JSON.stringify(decoded.diagnosticLog.appHealth)).toContain('coreAvailable');
  expect(body).not.toMatch(/Private Bank|private-health-session/);
});
