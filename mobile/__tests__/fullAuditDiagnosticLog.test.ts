import { makePerformanceAuditReport } from '../__fixtures__/performanceAuditReport';
import { fullAuditDiagnosticLog } from '../src/lib/fullAuditDiagnosticLog';
import { createPublicPerformanceAuditReport } from '../src/lib/diagnosticsEnvelope';
import { decodeCompactDiagnosticJson } from '../src/lib/compactDiagnosticJson';
import { APP_HEALTH_CHECK_CODES, finalizeAppHealthReport, toPublicAppHealthReport } from '../src/lib/appHealth';
import { buildDeepPerformanceAuditPlan, buildDeepPerformanceAuditPlanFromInputs } from '../src/lib/performanceAuditPlan';
import { ANDROID_UPDATE_READINESS_AUDIT } from '../src/lib/performanceAuditCheckInventory';
import { AUDIT_REGISTERED_ACTION_IDS } from '../src/lib/auditDiagnosticProducerFields';

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

test.each(['Hermes', 'SpiderMonkey', 'V8', 'JavaScriptCore', 'unknown'])('retains emitted engine %s and the actual maximum-coverage profile', jsEngine => {
  const report = makePerformanceAuditReport();
  report.environment.jsEngine = jsEngine;
  report.environment.auditCoverageProfile = 'maximum-safe-coverage-v1';
  const decoded = fullAuditDiagnosticLog(report, id => id) as typeof report;
  expect(decoded.environment).toMatchObject({ jsEngine, auditCoverageProfile: 'maximum-safe-coverage-v1' });
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

test.each(['Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'EvalError', 'URIError', 'AggregateError'])('retains standard %s classification without raw private error text', type => {
  const report = makePerformanceAuditReport();
  report.checks = [{ id: 'journey-rates-cold', label: 'Rates', kind: 'journey', status: 'fail', durationMs: 1,
    metrics: {}, error: `${type}: PRIVATE CUSTOMER CONTENT` }];
  const body = createPublicPerformanceAuditReport(report);
  const decoded = decodeCompactDiagnosticJson(body) as { diagnosticLog: { checks: { errorDetails: unknown }[] } };
  expect(decoded.diagnosticLog.checks[0].errorDetails).toMatchObject({ present: true, type });
  expect(body).not.toContain('PRIVATE CUSTOMER CONTENT');
});

test('retains dedicated update-check technical evidence across statuses and download phases', () => {
  for (const checkStatus of ['current', 'available', 'incompatible']) for (const downloadPhase of ['idle', 'waiting', 'downloading', 'retrying', 'verifying', 'ready', 'cancelled', 'error']) {
    const report = makePerformanceAuditReport();
    const metrics = { updateMetadataTransportCalls: 2, durationMayUseTtlCache: false, manifestMetadataValidated: true,
      manifestPackageMatches: true, installedVersion: '1.0.246', installedBuild: '302', remoteVersion: '1.0.247', remoteBuild: '303',
      checkStatus, manifestBytes: 46_352_641, manifestHasSha256: true, downloadPhase, downloadedBytes: 100,
      downloadTotalBytes: 46_352_641, cachedBuild: '303', cachedReady: true, ownerCheckId: ANDROID_UPDATE_READINESS_AUDIT.checkId,
      semanticActionId: ANDROID_UPDATE_READINESS_AUDIT.semanticActionId, executionPhase: ANDROID_UPDATE_READINESS_AUDIT.phase,
      transportScope: ANDROID_UPDATE_READINESS_AUDIT.transportScope, expectedSurface: ANDROID_UPDATE_READINESS_AUDIT.expectedSurface,
      actionSource: ANDROID_UPDATE_READINESS_AUDIT.expectedSurface };
    report.checks = [{ id: 'update-readiness', label: 'Updates', kind: 'update', status: 'pass', durationMs: 1, metrics }];
    const decoded = fullAuditDiagnosticLog(report, id => id) as typeof report;
    expect(decoded.checks[0].metrics).toEqual(metrics);
  }
});

test('retains emitter-defined capacity, model, restoration and log-stall evidence', () => {
  const report = makePerformanceAuditReport();
  const metrics = { chunks: 5, cpuMs: 12.3, maxSliceMs: 4.5, firstFilterMs: 3, repeatFilterMs: 1,
    rows: 80, visibleRows: 12, logQueuedLines: 100, logFlushStageMs: 8, logFlushStage: 'rewrite',
    logFlushLastFailedStage: 'append', rollbackStatus: 'restored', navigationKind: 'stack', passId: 'first-pass',
    reason: 'No active payload is loaded', unknownPrivateMetric: 987654321,
    deepSearchEnabled: true, mortgageRateMetric: 'comparison' };
  report.checks = [{ id: 'journey-rates-cold', label: 'Rates', kind: 'journey', status: 'fail', durationMs: 1, metrics }];
  const decoded = fullAuditDiagnosticLog(report, id => id) as typeof report;
  const actual = decoded.checks[0].metrics;
  for (const [key, value] of Object.entries(metrics)) {
    if (['unknownPrivateMetric', 'deepSearchEnabled', 'mortgageRateMetric'].includes(key)) continue;
    expect(actual[key]).toBe(value);
  }
  expect(actual.deepSearchEnabled).toMatch(/^~private/);
  expect(actual.mortgageRateMetric).toMatch(/^~private/);
  expect(JSON.stringify(decoded)).not.toContain('987654321');
});

test.each(['basic', 'deep'])('retains post-creation preload metrics and conditional search mode %s', searchMode => {
  const report = makePerformanceAuditReport();
  const metrics = { preloaded: true, preloadedAgeMs: 123.5, searchMode, deepSearchAvailable: true };
  report.checks = [{ id: 'journey-rates-cold', label: 'Rates', kind: 'journey', status: 'pass', durationMs: 1, metrics }];
  const decoded = fullAuditDiagnosticLog(report, id => id) as typeof report;
  expect(decoded.checks[0].metrics).toEqual(metrics);
});

test('retains setup-factory proof, sample counts and inventory phase', () => {
  const report = makePerformanceAuditReport();
  const metrics = { rollbackJournalCreated: true, backgroundWorkStatus: 'settled', sampledProducts: 5, sampledProviders: 3,
    foregroundCatalogueRendered: false, inventoryPhase: 'setup' };
  report.checks = [{ id: 'setup-environment', label: 'Setup', kind: 'data', status: 'pass', durationMs: 1, metrics }];
  expect((fullAuditDiagnosticLog(report, id => id) as typeof report).checks[0].metrics).toEqual(metrics);
});

test('retains late-assigned inventory failure counters spread into metrics', () => {
  const report = makePerformanceAuditReport();
  const metrics = { inventoryUniqueDestinations: 14, inventoryElapsedMs: 98.5, inventoryCpuMs: 34,
    inventoryMaxSliceMs: 6, inventoryYieldMs: 10, inventoryMaxYieldMs: 4 };
  report.checks = [{ id: 'fatal-1', label: 'Inventory failed', kind: 'runtime', status: 'fail', durationMs: 100, metrics }];
  expect((fullAuditDiagnosticLog(report, id => id) as typeof report).checks[0].metrics).toEqual(metrics);
});

test('retains bounded missing-asset lists and rejects private additions', () => {
  const report = makePerformanceAuditReport();
  report.checks = [{ id: 'maximum-coverage-profile', label: 'Assets', kind: 'data', status: 'skipped', durationMs: 1,
    metrics: { missingAssets: 'details,searchIndex,bankHistory', availabilityEvidence: 'Optional assets are not cached: details, searchIndex, bankHistory' } },
    { id: 'active-data', label: 'Private assets', kind: 'data', status: 'skipped', durationMs: 1,
      metrics: { missingAssets: 'details,PRIVATE-FILE', availabilityEvidence: 'Optional assets are not cached: details, PRIVATE-FILE' } }];
  const body = createPublicPerformanceAuditReport(report);
  const decoded = decodeCompactDiagnosticJson(body) as { diagnosticLog: typeof report };
  expect(decoded.diagnosticLog.checks[0].metrics).toEqual(report.checks[0].metrics);
  expect(decoded.diagnosticLog.checks[1].metrics.missingAssets).toMatch(/^~private/);
  expect(decoded.diagnosticLog.checks[1].metrics.availabilityEvidence).toMatch(/^~private/);
  expect(body).not.toContain('PRIVATE-FILE');
});

test('retains source-owned worker stages while masking filenames and unknown labels', () => {
  const report = makePerformanceAuditReport();
  report.backgroundWorkWait = { jobs: [{ label: 'PRIVATE WORKER', stage: 'Loading RBA calendar',
    stages: [{ label: 'Reading and validating cached product details', durationMs: 15, active: true },
      { label: 'Reading C:/Users/private-account.txt', durationMs: 2, active: false }] }] } as never;
  const body = createPublicPerformanceAuditReport(report);
  const decoded = decodeCompactDiagnosticJson(body) as { diagnosticLog: typeof report };
  expect(decoded.diagnosticLog.backgroundWorkWait).toMatchObject({ jobs: [{ stage: 'Loading RBA calendar',
    stages: [{ label: 'Reading and validating cached product details', durationMs: 15, active: true },
      { label: expect.stringMatching(/^~private/), durationMs: 2, active: false }] }] });
  expect(body).not.toMatch(/PRIVATE WORKER|private-account/);
});

test.each(['No product is loaded', 'No lender is loaded', 'Fewer than two products are loaded'])('retains registry-derived skip prerequisite: %s', reason => {
  const report = makePerformanceAuditReport();
  report.checks = [{ id: 'journey-rates-cold', label: 'Rates', kind: 'journey', status: 'skipped', durationMs: 0, metrics: { reason } },
    { id: 'journey-rates-warm', label: 'Rates', kind: 'journey', status: 'skipped', durationMs: 0, metrics: { reason: 'PRIVATE USER PREREQUISITE' } }];
  const body = createPublicPerformanceAuditReport(report);
  const decoded = decodeCompactDiagnosticJson(body) as { diagnosticLog: typeof report };
  expect(decoded.diagnosticLog.checks[0].metrics.reason).toBe(reason);
  expect(decoded.diagnosticLog.checks[1].metrics.reason).toMatch(/^~private/);
  expect(body).not.toContain('PRIVATE USER PREREQUISITE');
});

test('retains bounded plan skip and state-safety reasons used as check metrics', () => {
  const plan = buildDeepPerformanceAuditPlan(null);
  const step = plan.passes[0].steps.find(item => item.skipReason != null)!;
  const report = makePerformanceAuditReport();
  const metrics = { reason: step.skipReason, skipSafety: step.skipSafety.reason };
  report.checks = [{ id: 'journey-rates-cold', label: 'Rates', kind: 'journey', status: 'skipped', durationMs: 0, metrics }];
  expect((fullAuditDiagnosticLog(report, id => id) as typeof report).checks[0].metrics).toEqual(metrics);
});

test('retains only finite source-defined live-stage timing keys', () => {
  const report = makePerformanceAuditReport();
  const metrics = { 'liveStage:Core asset:downloaded:ms': 4.5, 'liveStage:manifest:fetched:ms': 7,
    'liveStage:snapshot-built:ms': 2, 'liveStage:PRIVATE-BORROWER:ms': 987654321 };
  report.checks = [{ id: 'active-data', label: 'Live source', kind: 'data', status: 'pass', durationMs: 1, metrics }];
  const body = createPublicPerformanceAuditReport(report);
  const decoded = decodeCompactDiagnosticJson(body) as { diagnosticLog: typeof report };
  expect(decoded.diagnosticLog.checks[0].metrics).toMatchObject({ 'liveStage:Core asset:downloaded:ms': 4.5,
    'liveStage:manifest:fetched:ms': 7, 'liveStage:snapshot-built:ms': 2 });
  expect(body).not.toMatch(/PRIVATE-BORROWER|987654321/);
});

test('retains registered and planned action IDs while masking private unknown actions', () => {
  const report = makePerformanceAuditReport();
  const actions = ['search.filters.apply', 'settings.theme.next', 'product.open', 'projections.metric.next'];
  for (const action of ['search.filters.apply', 'settings.theme.next', 'projections.metric.next']) expect(AUDIT_REGISTERED_ACTION_IDS.has(action)).toBe(true);
  report.checks = [{ id: 'journey-rates-cold', label: 'Rates', kind: 'journey', status: 'pass', durationMs: 1,
    metrics: {}, diagnostic: { stage: 'complete', readiness: { surfaces: [{ id: 'rates.results',
      actions: [...actions, 'private-user@example.com'], lastCompletedAction: 'search.filters.apply' }] } } as never }];
  const body = createPublicPerformanceAuditReport(report);
  const decoded = decodeCompactDiagnosticJson(body) as { diagnosticLog: typeof report };
  expect(decoded.diagnosticLog.checks[0].diagnostic!.readiness).toMatchObject({ surfaces: [{
    actions: [...actions, expect.stringMatching(/^~private/)], lastCompletedAction: 'search.filters.apply' }] });
  expect(body).not.toContain('private-user@example.com');
});

test.each(['2026-10-21', '2024-02-29'])('retains validated source publication date %s only at source-date paths', date => {
  const report = makePerformanceAuditReport();
  report.environment.payloadRunDate = date;
  report.backgroundWorkWait = { payloadWork: { revision: { runDate: date, manifestRunDate: date } }, jobs: [{ runDate: date }] } as never;
  const decoded = fullAuditDiagnosticLog(report, id => id) as typeof report;
  expect(decoded.environment.payloadRunDate).toBe(date);
  expect(decoded.backgroundWorkWait).toMatchObject({ payloadWork: { revision: { runDate: date, manifestRunDate: date } }, jobs: [{ runDate: date }] });
  expect(decoded.startedAt).toMatch(/^~private/);
});

test.each(['2026-02-29', '2026-13-01', 'private-date'])('masks malformed or private publication date %s', date => {
  const report = makePerformanceAuditReport();
  report.environment.payloadRunDate = date;
  expect((fullAuditDiagnosticLog(report, id => id) as typeof report).environment.payloadRunDate).toMatch(/^~private/);
});

test('retains complete source-authored deep-plan metadata while hiding private inputs', () => {
  const report = makePerformanceAuditReport();
  const empty = buildDeepPerformanceAuditPlan(null, { seed: 'PRIVATE-SEED' });
  report.plan = buildDeepPerformanceAuditPlanFromInputs({ ...empty.inputs, sampledProducts: [{ section: 'Mortgage',
    provider: 'PRIVATE-PROVIDER', productKey: 'PRIVATE-PRODUCT', productName: 'PRIVATE-NAME', rateIndex: 0,
    selectionToken: 'PRIVATE-TOKEN', taxonomyPath: [] }] });
  const body = createPublicPerformanceAuditReport(report);
  const decoded = decodeCompactDiagnosticJson(body) as { diagnosticLog: typeof report };
  expect(decoded.diagnosticLog.plan).toMatchObject({ coverageProfile: report.plan.coverageProfile, safeActionCount: report.plan.safeActionCount });
  for (let pass = 0; pass < report.plan.passes.length; pass++) {
    const expected = report.plan.passes[pass];
    const actual = decoded.diagnosticLog.plan!.passes[pass];
    expect(actual.id).toBe(expected.id);
    expect(actual.label).toBe(expected.label);
    expect(actual.steps).toHaveLength(expected.steps.length);
    expected.steps.forEach(({ parameters: _parameters, expectedPath, ...step }, index) => {
      expect(actual.steps[index]).toMatchObject(step);
      if (step.scenarioId.startsWith('sample.catalogue.')) expect(actual.steps[index].expectedPath).toMatch(/^~private/);
      else expect(actual.steps[index].expectedPath).toBe(expectedPath);
    });
  }
  expect(body).not.toMatch(/PRIVATE-SEED|PRIVATE-PROVIDER|PRIVATE-PRODUCT|PRIVATE-NAME|PRIVATE-TOKEN/);
  expect(decoded.diagnosticLog.plan!.inputs).toMatch(/^~private/);
});

test('retains route identities, outcomes and background-worker evidence', () => {
  const report = makePerformanceAuditReport();
  report.routeAggregates = [{ journeyId: 'rates', label: 'Rates', coldStatus: 'fail', warmStatus: 'pass',
    coldForwardMs: 31, warmForwardMs: 12, coldBackMs: 4, warmBackMs: 3, forwardChangeMs: -19, backChangeMs: -1 }];
  report.backgroundWorkWait = { startedAt: 'PRIVATE-DATE', capturedAt: 'PRIVATE-DATE', elapsedMs: 5, status: 'interrupted',
    payloadWork: { capturedAt: 'PRIVATE-DATE', refreshing: true, postRefreshWarming: false, bankRateHistoryLoading: false,
      detailsLoading: false, activeWork: ['refreshing'], revision: { runDate: null, manifestRunDate: null, coreSha: null,
        detailsSha: null, payloadRevision: null, bundleSha: null } },
    jobs: (['completed', 'failed', 'fallback', 'superseded', 'unavailable'] as const).map((outcome, index) => ({ id: index,
      label: 'PRIVATE-WORKER', runDate: null, startedAt: 'PRIVATE-DATE', finishedAt: null, elapsedMs: 3, outcome,
      stage: 'PRIVATE-STAGE', stageElapsedMs: 2, omittedStages: 0, processingCheckpoints: 4, lastCheckpointAgeMs: 1,
      stages: [{ label: 'PRIVATE-STAGE', startedAt: 'PRIVATE-DATE', durationMs: 2, active: true }] })) };
  const body = createPublicPerformanceAuditReport(report);
  const decoded = decodeCompactDiagnosticJson(body) as { diagnosticLog: typeof report };
  expect(decoded.diagnosticLog.routeAggregates[0]).toMatchObject({ journeyId: 'rates', coldStatus: 'fail', warmStatus: 'pass', coldForwardMs: 31, warmForwardMs: 12 });
  expect(decoded.diagnosticLog.backgroundWorkWait!.jobs.map(job => job.outcome)).toEqual(report.backgroundWorkWait!.jobs.map(job => job.outcome));
  expect(decoded.diagnosticLog.backgroundWorkWait!.jobs[0]).toMatchObject({ id: 0, omittedStages: 0, processingCheckpoints: 4,
    stages: [{ durationMs: 2, active: true }] });
  expect(decoded.diagnosticLog.backgroundWorkWait!.payloadWork).toMatchObject({ refreshing: true, activeWork: ['refreshing'] });
  expect(body).not.toMatch(/PRIVATE-DATE|PRIVATE-WORKER|PRIVATE-STAGE/);
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
