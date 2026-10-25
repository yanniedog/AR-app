import { makePerformanceAuditReport } from '../__fixtures__/performanceAuditReport';
import { buildPerformanceAuditCompletion, publicAuditTimestamp } from '../src/lib/performanceAuditCompletion';
import { createDeidentifiedDiagnosticsShare, createPublicPerformanceAuditReport } from '../src/lib/diagnosticsEnvelope';
import { decodeCompactDiagnosticJson } from '../src/lib/compactDiagnosticJson';
import * as diagnosticCodec from '../src/lib/compactDiagnosticJson';
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

test('an oversized compressed upload fails preparation without returning a partial summary', () => {
  const encode = jest.spyOn(diagnosticCodec, 'encodeCompressedDiagnosticJson')
    .mockReturnValueOnce('x'.repeat(2 * 1024 * 1024 + 1));
  try {
    expect(() => createPublicPerformanceAuditReport(completeReport())).toThrow('public upload limit');
  } finally { encode.mockRestore(); }
});

test('hosted header and decoded full report identify the same exact completed audit', () => {
  const report = completeReport();
  const body = createPublicPerformanceAuditReport(report);
  const header = JSON.parse(body).audit;
  const decoded = decodeCompactDiagnosticJson(body) as any;
  expect(header).toMatchObject({ auditId: expect.stringMatching(/^audit-[a-f0-9]{16}$/),
    appVersion: report.app.appVersion, buildVersion: report.app.buildVersion,
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
  report.checks[0].metrics = { executionAttempted: true, actionCompleted: true, actionMs: 2_600, nonTimingFailure: false };
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

test.each([{}, { plannedChecks: 1, storedChecks: 1, complete: true }, { missingPlannedCheckIds: null }])(
  'recovered legacy optional coverage shape %j is incomplete evidence without crashing', coverage => {
    const report = completeReport();
    report.coverage = coverage as never;
    expect(buildPerformanceAuditCompletion(report)).toMatchObject({ outcome: 'incomplete', collectionComplete: false,
      coverageComplete: false, detailsComplete: false, gaps: { invalidCoverageReports: 1 } });
  });

test.each([{}, { coverage: {}, checks: [] }, { coverage: null, checks: 'invalid' }])(
  'recovered optional health shape %j is incomplete evidence without crashing', health => {
    const report = completeReport();
    report.appHealth = health as never;
    expect(buildPerformanceAuditCompletion(report)).toMatchObject({ outcome: 'incomplete', coverageComplete: false,
      detailsComplete: false, gaps: { invalidHealthReports: 1, missingHealthReports: 1 } });
  });

test('health with valid check accounting but missing display schema remains invalid evidence', () => {
  const report = completeReport();
  delete (report.appHealth as unknown as Record<string, unknown>).domains;
  expect(buildPerformanceAuditCompletion(report).gaps.invalidHealthReports).toBe(1);
});

test('health evidence truncation prevents complete details without publishing private text', () => {
  const report = completeReport();
  report.appHealth!.checks[0].metrics.privateText = 'Private health evidence…[truncated 77 chars]';
  const body = createPublicPerformanceAuditReport(report);
  const decoded = decodeCompactDiagnosticJson(body) as any;
  expect(decoded.completion).toMatchObject({ detailsComplete: false, outcome: 'incomplete',
    gaps: { truncatedEvidenceFields: 1, omittedEvidenceChars: 77 } });
  expect(body).not.toContain('Private health evidence');
});

test.each([{}, { httpReachability: 'pass' }, { browserHandler: 'pass' },
  { httpReachability: 'invalid', browserHandler: 'pass' }])('missing or unknown link verification evidence remains incomplete: %j', evidence => {
  const report = completeReport();
  const metrics: Record<string, string | boolean> = { httpAttempted: true };
  for (const [key, value] of Object.entries(evidence)) if (value !== undefined) metrics[key] = value;
  report.checks[0] = { id: 'external-link-1', label: 'Link', kind: 'network', status: 'pass', durationMs: 1,
    metrics };
  expect(buildPerformanceAuditCompletion(report)).toMatchObject({ coverageComplete: false, outcome: 'incomplete', gaps: { unverifiedLinks: 1 } });
  report.checks[0].metrics = { httpAttempted: true, httpReachability: 'pass', browserHandler: 'pass' };
  expect(buildPerformanceAuditCompletion(report)).toMatchObject({ coverageComplete: true, outcome: 'successful', gaps: { unverifiedLinks: 0 } });
});

test('all duplicate, unexpected, pending and missing-readiness gaps identify their source positions', () => {
  const report = completeReport();
  report.checks.push({ ...report.checks[0] });
  report.coverage!.storedChecks = 2;
  report.coverage!.plannedChecks = 2;
  report.coverage!.unexpectedStoredCheckIds = ['journey-rates-cold'];
  report.checks[0].diagnostic = { stage: 'readiness', readiness: { ready: false, capturing: true, blockers: [],
    surfaces: [{ id: 'rates', probes: [{ id: 'rates.data', required: true, status: 'pending' }] }] } } as never;
  delete report.checks[1].diagnostic;
  const result = buildPerformanceAuditCompletion(report);
  expect(result.gapPositions).toEqual(expect.arrayContaining([
    { source: 'performance', position: 1, checkId: 'journey-rates-cold', reason: 'duplicate' },
    { source: 'performance', position: 2, checkId: 'journey-rates-cold', reason: 'duplicate' },
    { source: 'performance', position: 1, checkId: 'journey-rates-cold', reason: 'unexpected' },
    { source: 'performance', position: 2, checkId: 'journey-rates-cold', reason: 'unexpected' },
    { source: 'performance', position: 1, checkId: 'journey-rates-cold', reason: 'pending-probe', surfaceId: 'rates', probeId: 'rates.data' },
    { source: 'performance', position: 2, checkId: 'journey-rates-cold', reason: 'missing-readiness' },
  ]));
  expect(result.duplicateStoredChecks).toEqual([{ source: 'performance', checkId: 'journey-rates-cold', positions: [1, 2] }]);
  expect(result.unexpectedStoredChecks).toEqual(result.duplicateStoredChecks);
});

test('capacity failures cannot claim complete diagnostic evidence even when all result slots exist', () => {
  const report = completeReport();
  report.checks[0].status = 'fail';
  report.checks[0].metrics.evidenceCapacityExceeded = true;
  expect(buildPerformanceAuditCompletion(report)).toMatchObject({ outcome: 'failed', detailsComplete: false,
    gaps: { evidenceCapacityFailures: 1 } });
});

test.each([{}, { coverage: {}, domains: 'private-domains', checks: [{ id: 'private-health-id', metrics: { account: 'private-account' } }] }])(
  'malformed recovered health evidence %j remains shareable and fully represented through privacy aliases', malformed => {
    const report = completeReport();
    report.appHealth = malformed as never;
    const share = JSON.parse(createDeidentifiedDiagnosticsShare(report).body);
    const body = createPublicPerformanceAuditReport(report);
    const decoded = decodeCompactDiagnosticJson(body) as any;
    expect(share).toMatchObject({ appHealth: null, completion: { outcome: 'incomplete', detailsComplete: false,
      gaps: { invalidHealthReports: 1, missingHealthReports: 1 } } });
    const { privacyBoundary: decodedBoundary, ...decodedRest } = decoded.completion;
    const { privacyBoundary: shareBoundary, ...shareRest } = share.completion;
    expect(decodedRest).toEqual(shareRest);
    expect(shareBoundary.generalApplicationJournal).toBe('included-deidentified');
    expect(decodedBoundary.generalApplicationJournal).toBe('included-deidentified');
    expect(decoded.diagnosticLog.appHealth).not.toBeNull();
    expect(Object.keys(decoded.diagnosticLog.appHealth)).toHaveLength(Object.keys(malformed).length);
    if ('checks' in malformed) expect(decoded.diagnosticLog.appHealth.checks).toMatchObject([
      { id: expect.stringMatching(/^~private/), metrics: { account: expect.stringMatching(/^~private/) } },
    ]);
    for (const privateValue of ['private-domains', 'private-health-id', 'private-account']) {
      expect(body).not.toContain(privateValue);
      expect(JSON.stringify(share)).not.toContain(privateValue);
    }
    expect(report.appHealth).toBe(malformed);
  });

test('destinations left out of the HTTP sample are not unverified coverage holes', () => {
  const report = completeReport();
  report.checks[0] = { id: 'external-link-1', label: 'Link', kind: 'network', status: 'warn', durationMs: 1,
    metrics: { executionAttempted: true, httpSelected: false, httpAttempted: false, httpReachability: 'unknown',
      browserHandler: 'pass', handlerAttempted: true, handlerResolution: 'pass' } };
  expect(buildPerformanceAuditCompletion(report)).toMatchObject({ coverageComplete: true, outcome: 'warning',
    gaps: { unverifiedLinks: 0 } });
  const hosted = decodeCompactDiagnosticJson(createPublicPerformanceAuditReport(report)) as {
    checks: { metrics: { httpSelected?: boolean; handlerResolution?: string } }[];
  };
  expect(hosted.checks[0].metrics.httpSelected).toBe(false);
  expect(hosted.checks[0].metrics.handlerResolution).toBe('pass');
  report.checks[0].metrics = { executionAttempted: true, httpSelected: false, httpAttempted: false, httpReachability: 'unknown',
    browserHandler: 'unknown', handlerAttempted: false, handlerResolution: 'not-attempted' };
  expect(buildPerformanceAuditCompletion(report)).toMatchObject({ coverageComplete: true, outcome: 'warning',
    gaps: { unverifiedLinks: 0 } });
});

test('an HTTP sample member without a pass or fail stays unverified', () => {
  const report = completeReport();
  report.checks[0] = { id: 'external-link-2', label: 'Link', kind: 'network', status: 'warn', durationMs: 1,
    metrics: { httpSelected: true, httpAttempted: true, httpReachability: 'unknown', browserHandler: 'pass', handlerResolution: 'pass' } };
  expect(buildPerformanceAuditCompletion(report)).toMatchObject({ coverageComplete: false, outcome: 'incomplete',
    gaps: { unverifiedLinks: 1 }, gapPositions: [{ source: 'performance', position: 1, checkId: 'external-link-2', reason: 'unverified-link' }] });
  report.checks[0].metrics = { httpSelected: true, httpAttempted: false, httpReachability: 'unknown', urlValidation: 'pass',
    browserHandler: 'pass', handlerResolution: 'pass' };
  expect(buildPerformanceAuditCompletion(report).gaps.unverifiedLinks).toBe(1);
});

test('a handler the platform could not resolve does not fail coverage, and a missing handler does', () => {
  const report = completeReport();
  report.checks[0] = { id: 'external-link-4', label: 'Link', kind: 'network', status: 'warn', durationMs: 1,
    metrics: { httpSelected: true, httpAttempted: true, httpReachability: 'pass', browserHandler: 'unknown',
      handlerAttempted: true, handlerResolution: 'unresolved' } };
  expect(buildPerformanceAuditCompletion(report)).toMatchObject({ coverageComplete: true, outcome: 'warning', gaps: { unverifiedLinks: 0 } });
  report.checks[0].status = 'fail';
  report.checks[0].metrics = { httpSelected: true, httpAttempted: true, httpReachability: 'pass', browserHandler: 'fail',
    handlerAttempted: true, handlerResolution: 'fail', nonTimingFailure: true, executionAttempted: true };
  expect(buildPerformanceAuditCompletion(report)).toMatchObject({ coverageComplete: true, outcome: 'failed', gaps: { unverifiedLinks: 0 } });
  report.checks[0].status = 'fail';
  report.checks[0].metrics = { urlValidation: 'fail', httpSelected: true, httpAttempted: false, httpReachability: 'unknown',
    browserHandler: 'unknown', handlerResolution: 'not-attempted', nonTimingFailure: true, executionAttempted: true };
  expect(buildPerformanceAuditCompletion(report)).toMatchObject({ coverageComplete: true, outcome: 'failed', gaps: { unverifiedLinks: 0 } });
});

test('optional and contract availability skips do not force coverage incomplete', () => {
  const report = completeReport();
  report.coverage!.complete = false;
  report.checks[0] = { id: 'manifest-network', label: 'Manifest', kind: 'network', status: 'skipped', durationMs: null,
    metrics: { executionAttempted: false, skipClassification: 'terminal-availability', availabilityFailure: true,
      availabilityEvidence: 'local app-health mode blocks fetch and XMLHttpRequest before transport',
      reason: 'Not run: local mode has a zero-network contract' } };
  expect(buildPerformanceAuditCompletion(report)).toMatchObject({ coverageComplete: true, outcome: 'successful',
    gaps: { skippedChecks: 0, unavailableChecks: 0, justifiedAvailabilitySkips: 1 } });
  report.checks[0] = { id: 'deep-first-pass.route.rba.rba.forecast.next', label: 'Forecast', kind: 'journey', status: 'skipped', durationMs: null,
    metrics: { executionAttempted: false, availabilityFailure: true, skipClassification: 'terminal-availability',
      availabilityEvidence: 'the planned action had no reachable safe target in the pinned dataset' } };
  report.plan = { passes: [{ steps: [{ id: 'first-pass.route.rba.rba.forecast.next', optional: true, expectedSurface: 'rba.dashboard' }] }] } as never;
  expect(buildPerformanceAuditCompletion(report)).toMatchObject({ coverageComplete: true,
    gaps: { skippedChecks: 0, justifiedAvailabilitySkips: 1 } });
  report.checks[0].metrics.skipClassification = 'scenario-recovery';
  expect(buildPerformanceAuditCompletion(report)).toMatchObject({ coverageComplete: false,
    gaps: { skippedChecks: 1, unavailableChecks: 1, justifiedAvailabilitySkips: 0 } });
});

test('a required skip stays a coverage gap', () => {
  const report = completeReport();
  report.checks[0] = { id: 'deep-first-pass.route.rates.search.open', label: 'Search', kind: 'journey', status: 'skipped', durationMs: null,
    metrics: { executionAttempted: false, availabilityFailure: true, skipClassification: 'terminal-availability',
      availabilityEvidence: 'the planned action had no reachable safe target in the pinned dataset' } };
  report.plan = { passes: [{ steps: [{ id: 'first-pass.route.rates.search.open', optional: false, expectedSurface: 'rates.results' }] }] } as never;
  expect(buildPerformanceAuditCompletion(report)).toMatchObject({ coverageComplete: false,
    gaps: { skippedChecks: 1, unavailableChecks: 1, justifiedAvailabilitySkips: 0 },
    gapPositions: [expect.objectContaining({ checkId: 'deep-first-pass.route.rates.search.open', reason: 'unavailable' })] });
});

test('optional assets that were not exercised do not make health unavailable a coverage hole', () => {
  const report = completeReport();
  const health = report.appHealth!;
  health.checks.push({ id: APP_HEALTH_CHECK_CODES.ASSET_AVAILABILITY, code: APP_HEALTH_CHECK_CODES.ASSET_AVAILABILITY,
    domain: 'asset-availability', label: 'Assets', status: 'unavailable',
    metrics: { requiredUnavailable: 0, requiredEmpty: 0, mismatchedRunDates: 0, optionalUnavailable: 0, optionalEmpty: 0, optionalNotObserved: 1 } });
  health.coverage.plannedChecks += 1;
  health.coverage.storedChecks += 1;
  expect(buildPerformanceAuditCompletion(report)).toMatchObject({ coverageComplete: true, gaps: { unavailableChecks: 0 } });
  health.checks[health.checks.length - 1].metrics.requiredUnavailable = 1;
  expect(buildPerformanceAuditCompletion(report)).toMatchObject({ coverageComplete: false, gaps: { unavailableChecks: 1 },
    gapPositions: [expect.objectContaining({ source: 'health', reason: 'unavailable', checkId: APP_HEALTH_CHECK_CODES.ASSET_AVAILABILITY })] });
});

test('a pending required probe is a gap only for the check surface and for audit-owned probes', () => {
  const report = completeReport();
  report.plan = { passes: [{ steps: [{ id: 'first-pass.route.rba.rba.forecast.next', optional: true, expectedSurface: 'rba.dashboard' }] }] } as never;
  report.checks[0] = { id: 'deep-first-pass.route.rba.rba.forecast.next', label: 'Forecast', kind: 'journey', status: 'pass', durationMs: 1,
    metrics: { executionAttempted: true, actionCompleted: true, expectedSurface: 'rba.dashboard' },
    diagnostic: { stage: 'complete', readiness: { ready: false, capturing: true, blockers: [], surfaces: [
      { id: 'outlook.dashboard', probes: [{ id: 'bank-insights', required: true, status: 'pending' }] },
      { id: 'rba.dashboard', probes: [{ id: 'rba.data', required: true, status: 'ready' }] },
      { id: 'audit.progress', probes: [{ id: 'audit.state', required: true, status: 'pending' }] },
    ] } } as never };
  const result = buildPerformanceAuditCompletion(report);
  expect(result.gaps.pendingProbes).toBe(1);
  expect(result.coverageComplete).toBe(false);
  expect(result.gapPositions).toEqual([expect.objectContaining({
    source: 'performance', position: 1, checkId: 'deep-first-pass.route.rba.rba.forecast.next', reason: 'pending-probe',
    surfaceId: 'audit.progress', probeId: 'audit.state',
  })]);
});

test('a measured journey failure remains covered when the stored aggregate flag is incomplete', () => {
  const report = completeReport();
  report.coverage!.complete = false;
  report.checks[0].status = 'fail';
  report.checks[0].metrics = { executionAttempted: true, actionInvoked: true, actionCompleted: false, nonTimingFailure: true };
  expect(buildPerformanceAuditCompletion(report)).toMatchObject({ outcome: 'failed', collectionComplete: true, coverageComplete: true });
});
