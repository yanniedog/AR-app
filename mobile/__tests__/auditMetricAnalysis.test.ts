import { makePerformanceAuditReport } from '../__fixtures__/performanceAuditReport';
import { buildAuditMetricAnalysis } from '../src/lib/auditMetricAnalysis';
import { auditMetricRun, AUDIT_METRICS } from '../src/lib/auditMetricHistory';
import { finalizeAppHealthReport, toPublicAppHealthReport, APP_HEALTH_CHECK_CODES } from '../src/lib/appHealth';
import type { AuditCheck } from '../src/lib/performanceAudit';
import type { AppHealthCheck } from '../src/lib/appHealth';
import { auditCheckResultSummary } from '../src/lib/auditCheckResultSummary';

function journey(id: string, duration: number | null): AuditCheck {
  return { id, kind: 'journey', label: 'Rates', status: 'pass', durationMs: duration,
    metrics: { executionAttempted: true, actionInvoked: true, actionCompleted: true, nonTimingFailure: false,
      eventLoopMeasurementAvailable: true, frameMeasurementAvailable: true, eventLoopSamples: 10,
      stallsOver100Ms: 1, frameSamples: 20, framesOver50Ms: 2, runtimeErrors: 0,
      actionMs: duration, forwardWorkMs: duration, backMs: duration },
    diagnostic: { stage: 'complete', readiness: { ready: true, capturing: true, blockers: [], surfaces: [] } } };
}

function healthMetricReport(code: AppHealthCheck['code'], metrics: AppHealthCheck['metrics']) {
  const report = makePerformanceAuditReport();
  report.appHealth = finalizeAppHealthReport({ sessionId: report.sessionId, mode: 'local',
    startedAt: report.startedAt, finishedAt: report.finishedAt, plannedCheckIds: [code],
    checks: [{ id: code, code, domain: 'data-completeness', label: 'Evidence', status: 'pass', metrics }] });
  return report;
}

test('lightweight result summaries retain full-analysis operands across valid, missing, invalid and unavailable evidence', () => {
  for (const code of [APP_HEALTH_CHECK_CODES.DISPLAY_CONTRACT, APP_HEALTH_CHECK_CODES.DISPLAY_MODEL,
    APP_HEALTH_CHECK_CODES.DISPLAY_LIST, APP_HEALTH_CHECK_CODES.DISPLAY_VISIBILITY, APP_HEALTH_CHECK_CODES.DISPLAY_LAYOUT,
    APP_HEALTH_CHECK_CODES.DISPLAY_CHART, APP_HEALTH_CHECK_CODES.DISPLAY_EMPTY_STATE, APP_HEALTH_CHECK_CODES.DISPLAY_LOGO,
    APP_HEALTH_CHECK_CODES.CORE_SCHEMA]) {
    for (const variant of ['valid', 'missing', 'invalid', 'unavailable', 'zero'] as const) {
      const metrics: AppHealthCheck['metrics'] = { plannedSurfaces: 5, missingSurfaces: 1, duplicateContracts: 0,
        checked: 4, missing: 1, failed: 1, warned: 1, unavailable: 0 };
      if (variant === 'missing') delete metrics.failed;
      if (variant === 'invalid') metrics.failed = 10;
      if (variant === 'zero') Object.keys(metrics).forEach(key => { metrics[key] = 0; });
      const report = healthMetricReport(code, metrics);
      if (variant === 'unavailable') report.appHealth!.checks[0].status = 'unavailable';
      const full = buildAuditMetricAnalysis(report), summary = auditCheckResultSummary(report);
      expect(Object.keys(summary.metrics).sort()).toEqual([
        'checkPassPercent', 'healthPassPercent', 'dataIntegrityPassPercent', 'dataCompletenessPassPercent',
        'timingFailures', 'historyProcessingMismatches', 'historyProjectionMismatches', 'surfaceCoveragePercent',
        'displayModelPassPercent', 'displayListPassPercent', 'displayVisiblePassPercent', 'displayLayoutPassPercent',
        'displayChartPassPercent', 'displayEmptyPassPercent', 'displayLogoPassPercent',
      ].sort());
      for (const [metric, { inventory: _inventory, ...operands }] of Object.entries(summary.metrics)) {
        const expected = full.metrics[metric as keyof typeof full.metrics];
        expect({ code, variant, metric, ...operands }).toEqual({ code, variant, metric,
          numerator: expected.numerator, denominator: expected.denominator, missingCount: expected.missingCount,
          unit: expected.unit, unitOfAnalysis: expected.unitOfAnalysis });
      }
      expect(summary).not.toHaveProperty('observations');
      expect(summary.taskEvidence.outcomes).toEqual(full.metrics.automatedTaskSuccessPercent.outcomes);
    }
  }
});

test('unmeasured ready-model evidence retains its unavailable inventory instead of implying zero gaps', () => {
  const report = healthMetricReport(APP_HEALTH_CHECK_CODES.DISPLAY_MODEL,
    { checked: 1, missing: 0, failed: 0, warned: 0, unavailable: 1 });
  report.appHealth!.checks[0].status = 'unavailable';
  expect(auditCheckResultSummary(report).metrics.displayModelPassPercent).toMatchObject({
    numerator: null, denominator: null, missingCount: 0, inventory: { observed: 1, expected: 1, unavailable: 1 } });
});

test('count admission rejects fractional operands before subtraction and unsafe sums while durations retain fractions', () => {
  const cases = [
    [APP_HEALTH_CHECK_CODES.COVERAGE, 'providerSuccessPercent', { providersSucceeded: 1.5, providersAttempted: 3, invalidCounts: false }],
    [APP_HEALTH_CHECK_CODES.DETAILS_COMPLETENESS, 'detailsCoveragePercent', { matchedProducts: 1, coreProducts: Number.MAX_SAFE_INTEGER + 1, runMatches: true, impossibleCounts: false }],
    [APP_HEALTH_CHECK_CODES.DISPLAY_LAYOUT, 'displayLayoutPassPercent', { checked: 1.5, failed: 0.5, missing: 0.5, warned: 0, unavailable: 0 }],
    [APP_HEALTH_CHECK_CODES.DISPLAY_LAYOUT, 'displayLayoutPassPercent', { checked: Number.MAX_SAFE_INTEGER, failed: 0, missing: 1, warned: 0, unavailable: 0 }],
    [APP_HEALTH_CHECK_CODES.DISPLAY_CONTRACT, 'surfaceCoveragePercent', { plannedSurfaces: 3.5, missingSurfaces: 0.5, duplicateContracts: 0 }],
  ] as const;
  for (const [code, metric, counts] of cases) {
    const report = healthMetricReport(code, counts);
    expect(auditMetricRun(report).metrics[metric]).toBeNull();
    const evidence = buildAuditMetricAnalysis(report).metrics[metric];
    expect(evidence.value).toBeNull();
    expect(evidence.missingEvidence).toContain('inconsistent-counts');
  }
  const report = makePerformanceAuditReport('fractional-duration', [journey('fractional-duration', 10.25)]);
  expect(auditMetricRun(report).metrics.actionP95Ms).toBe(10.25);
  expect(buildAuditMetricAnalysis(report).metrics.actionP95Ms.distribution?.p95).toBe(10.25);
  expect(Object.isFrozen(AUDIT_METRICS)).toBe(true);
});

test('legacy percentages remain intact when their reconstructed count total is unsafe', () => {
  const report = healthMetricReport(APP_HEALTH_CHECK_CODES.CORE_SCHEMA, {});
  report.coverage = { plannedChecks: 1, storedChecks: 0, plannedJourneyChecks: 0, executedJourneyChecks: 0,
    justifiedSkippedJourneyChecks: 0, unexpectedSkippedJourneyChecks: 0, unavailableJourneyChecks: 0,
    coveragePercent: 0, attemptedPercent: 0, missingPlannedCheckIds: ['missing'], duplicateStoredCheckIds: [],
    unexpectedStoredCheckIds: [], excludedUnsafeFacetCount: 0, complete: false };
  report.summary.coveragePercent = 99.2;
  report.appHealth!.summary.total = Number.MAX_SAFE_INTEGER;
  expect(buildAuditMetricAnalysis(report).metrics.coveragePercent).toMatchObject({ value: 99.2,
    denominator: null, missingEvidence: ['inconsistent-counts'] });
});

test('invalid ratio populations cannot be restored by display detail counts', () => {
  const surface = healthMetricReport(APP_HEALTH_CHECK_CODES.DISPLAY_CONTRACT,
    { plannedSurfaces: 1, missingSurfaces: 2, duplicateContracts: 0 });
  const display = healthMetricReport(APP_HEALTH_CHECK_CODES.DISPLAY_LAYOUT,
    { checked: Number.MAX_SAFE_INTEGER, missing: 1, failed: 0, warned: 0, unavailable: 0 });
  for (const [report, metric] of [[surface, 'surfaceCoveragePercent'], [display, 'displayLayoutPassPercent']] as const) {
    expect(buildAuditMetricAnalysis(report).metrics[metric]).toMatchObject({ value: null,
      numerator: null, denominator: null, sampleSize: 0, eligibleCount: null, observedCount: null, missingCount: null,
      missingEvidence: ['inconsistent-counts'] });
  }
});

test('runtime error counts reject fractional, negative and overflowed totals without fabricating zeros', () => {
  for (const invalid of [0.5, -1, Number.MAX_SAFE_INTEGER + 1]) {
    const check = journey('errors', 1); check.metrics.runtimeErrors = invalid;
    const report = makePerformanceAuditReport('errors', [check]);
    expect(auditMetricRun(report).metrics.runtimeErrors).toBeNull();
    expect(buildAuditMetricAnalysis(report).metrics.runtimeErrors).toMatchObject({ value: null,
      observedCount: 0, missingCount: 1, missingEvidence: ['inconsistent-counts'] });
  }
  const checks = [journey('first', 1), journey('second', 1)];
  checks[0].metrics.runtimeErrors = Number.MAX_SAFE_INTEGER; checks[1].metrics.runtimeErrors = 1;
  const overflow = makePerformanceAuditReport('overflow', checks);
  expect(auditMetricRun(overflow).metrics.runtimeErrors).toBeNull();
  expect(buildAuditMetricAnalysis(overflow).metrics.runtimeErrors.missingEvidence).toContain('inconsistent-counts');
  const absent = makePerformanceAuditReport('absent');
  expect(auditMetricRun(absent).metrics.runtimeErrors).toBeNull();
  expect(buildAuditMetricAnalysis(absent).metrics.runtimeErrors.value).toBeNull();
});

test.each(['historyProcessingMismatches', 'historyProjectionMismatches'] as const)(
  '%s separates unobserved zero from compared zero and retained nonzero mismatches', metric => {
    const field = metric === 'historyProcessingMismatches' ? 'historyProcessingMismatches' : 'historyChartProjectionMismatches';
    const comparisonField = metric === 'historyProcessingMismatches' ? 'historyProcessingComparisons' : 'historyChartProjectionComparisons';
    for (const available of [true, false]) {
      const unknown = healthMetricReport(APP_HEALTH_CHECK_CODES.CATALOGUE_COVERAGE, { historyAvailable: available, [field]: 0 });
      expect(auditMetricRun(unknown).metrics[metric]).toBeNull();
      expect(buildAuditMetricAnalysis(unknown).metrics[metric].missingEvidence).toContain('unverified-evidence');
      const observed = healthMetricReport(APP_HEALTH_CHECK_CODES.CATALOGUE_COVERAGE, { historyAvailable: available, [field]: 0, [comparisonField]: 3 });
      expect(auditMetricRun(observed).metrics[metric]).toBe(0);
      expect(buildAuditMetricAnalysis(observed).metrics[metric]).toMatchObject({ value: 0, numerator: 0,
        sampleSize: 3, sampleUnit: 'comparison', observedCount: 3 });
      const failed = healthMetricReport(APP_HEALTH_CHECK_CODES.CATALOGUE_COVERAGE, { historyAvailable: available, [field]: 2 });
      expect(auditMetricRun(failed).metrics[metric]).toBe(2);
      expect(buildAuditMetricAnalysis(failed).metrics[metric]).toMatchObject({ value: 2, numerator: 2,
        sampleSize: null, observedCount: null });
    }
  });

test.each([
  ['providerSuccessPercent', APP_HEALTH_CHECK_CODES.COVERAGE, 'providersSucceeded', 'providersAttempted', 'invalidCounts', false],
  ['detailsCoveragePercent', APP_HEALTH_CHECK_CODES.DETAILS_COMPLETENESS, 'matchedProducts', 'coreProducts', 'runMatches', true],
] as const)('%s analysis honors its validity guard and preserves raw rejected observations', (metric, code, numerator, denominator, guard, accepted) => {
  for (const guardValue of [accepted, !accepted, undefined]) {
    const report = healthMetricReport(code, { [numerator]: 2, [denominator]: 3, impossibleCounts: false,
      ...(guardValue === undefined ? {} : { [guard]: guardValue }) });
    const analysis = buildAuditMetricAnalysis(report), evidence = analysis.metrics[metric];
    expect(evidence.value).toBe(auditMetricRun(report).metrics[metric]);
    if (guardValue === accepted) {
      expect(evidence).toMatchObject({ value: 66.7, numerator: 2, denominator: 3, applicability: 'observed' });
    } else {
      expect(evidence).toMatchObject({ value: null, numerator: null, denominator: null, applicability: 'not-observed',
        missingEvidence: ['unverified-evidence', 'missing-denominator'] });
      expect(evidence.contributors.map(index => analysis.observations[index])).toContainEqual(
        expect.objectContaining({ field: numerator, value: 2 }));
    }
  }
});

test.each([true, false, undefined])('details consistency guard must explicitly validate counts: %s', impossibleCounts => {
  const report = healthMetricReport(APP_HEALTH_CHECK_CODES.DETAILS_COMPLETENESS,
    { matchedProducts: 2, coreProducts: 3, runMatches: true,
      ...(impossibleCounts === undefined ? {} : { impossibleCounts }) });
  const analysis = buildAuditMetricAnalysis(report), evidence = analysis.metrics.detailsCoveragePercent;
  expect(evidence.value).toBe(auditMetricRun(report).metrics.detailsCoveragePercent);
  expect(evidence).toMatchObject(impossibleCounts === false ? { value: 66.7, numerator: 2, denominator: 3 }
    : { value: null, numerator: null, denominator: null,
      missingEvidence: [impossibleCounts === true ? 'inconsistent-counts' : 'unverified-evidence', 'missing-denominator'] });
  expect(evidence.contributors.map(index => analysis.observations[index])).toContainEqual(
    expect.objectContaining({ field: 'impossibleCounts', value: impossibleCounts ?? null }));
});

test.each([true, false, undefined])('historical source operands require positive availability evidence: %s', available => {
  const report = healthMetricReport(APP_HEALTH_CHECK_CODES.CATALOGUE_COVERAGE, {
    historyDaysChecked: 3, historySourceGapDays: '["2026-11-01"]',
    ...(available === undefined ? {} : { historyAvailable: available }),
  });
  const evidence = buildAuditMetricAnalysis(report).metrics.historySourceCoveragePercent;
  expect(evidence.value).toBe(auditMetricRun(report).metrics.historySourceCoveragePercent);
  expect(evidence).toMatchObject(available === true ? { value: 66.7, numerator: 2, denominator: 3 }
    : { value: null, numerator: null, denominator: null, missingEvidence: ['unverified-evidence', 'missing-denominator'] });
});

test.each([0, 1, undefined])('surface operands require unique contract evidence: %s', duplicates => {
  const report = healthMetricReport(APP_HEALTH_CHECK_CODES.DISPLAY_CONTRACT, {
    plannedSurfaces: 3, missingSurfaces: 1, duplicateObservations: 0, unexpectedSurfaces: 0,
    ...(duplicates === undefined ? {} : { duplicateContracts: duplicates }),
  });
  const evidence = buildAuditMetricAnalysis(report).metrics.surfaceCoveragePercent;
  expect(evidence.value).toBe(auditMetricRun(report).metrics.surfaceCoveragePercent);
  if (duplicates === 0) expect(evidence).toMatchObject({ value: 66.7, numerator: 2, denominator: 3 });
  else expect(evidence).toMatchObject({ value: null, numerator: null, denominator: null,
    applicability: duplicates === undefined ? 'not-observed' : 'invalid-evidence',
    missingEvidence: [duplicates === undefined ? 'unverified-evidence' : 'invalid-identities', 'missing-denominator'] });
});

test.each([
  ['jsStallPercent', 'eventLoopSamples', 'stallsOver100Ms'],
  ['slowFramePercent', 'frameSamples', 'framesOver50Ms'],
] as const)('%s rejects fractional and unsafe callback counts before pooling', (metric, samples, events) => {
  for (const [sampleCount, eventCount] of [[10.5, 1], [10, 0.5], [Number.MAX_SAFE_INTEGER + 1, 0], [1, 2]]) {
    const first = journey('first', 10), second = journey('second', 10);
    first.metrics[samples] = sampleCount; first.metrics[events] = eventCount;
    const report = makePerformanceAuditReport('invalid-counts', [first, second]);
    expect(auditMetricRun(report).metrics[metric]).toBeNull();
    expect(buildAuditMetricAnalysis(report).metrics[metric]).toMatchObject({ value: null, numerator: null, denominator: null,
      applicability: 'invalid-evidence', missingEvidence: ['inconsistent-counts', 'missing-denominator'] });
  }
  const first = journey('first', 10), second = journey('second', 10);
  first.metrics[samples] = Number.MAX_SAFE_INTEGER; first.metrics[events] = 0;
  second.metrics[samples] = 1; second.metrics[events] = 0;
  const report = makePerformanceAuditReport('overflow', [first, second]);
  expect(auditMetricRun(report).metrics[metric]).toBeNull();
  expect(buildAuditMetricAnalysis(report).metrics[metric]).toMatchObject({ value: null, numerator: null, denominator: null,
    eligibleCount: null, observedCount: null, missingEvidence: ['inconsistent-counts', 'missing-denominator'] });
});

test('all graph values have the same versioned analysis and valid shared evidence references', () => {
  const report = makePerformanceAuditReport('analysis', [journey('journey-rates-cold', 10), journey('journey-rates-warm', 20)]);
  const analysis = buildAuditMetricAnalysis(report);
  const run = auditMetricRun(report);
  expect(Object.keys(analysis.metrics)).toHaveLength(AUDIT_METRICS.length);
  for (const metric of AUDIT_METRICS) {
    const evidence = analysis.metrics[metric];
    expect(evidence.value).toBe(run.metrics[metric]);
    expect(evidence.methodId).toBe(`ar.audit.${metric}`);
    expect(evidence.methodVersion).toBe([
      'actionP50Ms', 'actionP95Ms', 'displayModelPassPercent', 'displayListPassPercent',
      'displayVisiblePassPercent', 'displayLayoutPassPercent', 'displayEmptyPassPercent', 'displayLogoPassPercent',
    ].includes(metric) ? 2 : 1);
    expect(evidence.formula.length).toBeGreaterThan(10);
    expect(evidence.uncertainty.interval).toBeNull();
    expect(evidence.contributors.every(index => Number.isSafeInteger(index) && analysis.observations[index])).toBe(true);
    if (metric !== 'coveragePercent' && evidence.value !== null && evidence.unit === 'percent'
      && evidence.numerator !== null && evidence.denominator !== null) {
      expect(evidence.value).toBe(Math.round(evidence.numerator / evidence.denominator * 1000) / 10);
    }
  }
  expect(analysis.metrics.actionP50Ms.contributors).toEqual(analysis.metrics.actionP95Ms.contributors);
});

test('nearest-rank tails, MAD, IQR and worst observations preserve sample sizes and measured strata', () => {
  const report = makePerformanceAuditReport('distribution', [journey('journey-rates-cold', 10), journey('journey-rates-warm', 20),
    journey('deep-first-pass.action', 30), journey('deep-repeat.action', 1000), journey('unknown-sample', null)]);
  const evidence = buildAuditMetricAnalysis(report).metrics.actionP95Ms;
  expect(evidence).toMatchObject({ value: 1000, sampleSize: 4, eligibleCount: 5, observedCount: 4, missingCount: 1,
    missingEvidence: ['partial-samples'], uncertainty: { interval: null, reason: 'correlated-observations' },
    distribution: { method: 'nearest-rank', n: 4, min: 10, max: 1000, p50: 20, p90: 1000, p95: 1000, p99: 1000, mad: 10, iqr: 20 } });
  expect(evidence.distribution?.strata.map(stratum => [stratum.key, stratum.n, stratum.p50])).toEqual([
    ['cold', 1, 10], ['warm', 1, 20], ['first', 1, 30], ['repeat', 1, 1000],
  ]);
  expect(evidence.distribution?.worst.map(item => item.value)).toEqual([1000, 30, 20, 10]);
});

test('action duration population excludes route navigation without inventing missing action samples', () => {
  const route = journey('journey-rates-cold', 100);
  route.metrics.measurementMode = 'route-round-trip';
  delete route.metrics.actionMs;
  const action = journey('deep-first-pass.action', 20);
  action.metrics.measurementMode = 'semantic-action';
  const missingAction = journey('deep-repeat.action', null);
  missingAction.metrics.measurementMode = 'semantic-action';
  delete missingAction.metrics.actionMs;
  const report = makePerformanceAuditReport('action-population', [route, action, missingAction]);
  const analysis = buildAuditMetricAnalysis(report);
  for (const metric of ['actionP50Ms', 'actionP95Ms'] as const) {
    expect(analysis.metrics[metric]).toMatchObject({ value: 20, sampleSize: 1, eligibleCount: 2,
      observedCount: 1, missingCount: 1, excludedCount: 1, missingEvidence: ['partial-samples'] });
    expect(auditMetricRun(report).metrics[metric]).toBe(20);
  }
  expect(analysis.metrics.automatedTaskSuccessPercent.denominator).toBe(3);
  const onlyRoutes = buildAuditMetricAnalysis(makePerformanceAuditReport('route-only', [route]));
  expect(onlyRoutes.metrics.actionP95Ms).toMatchObject({ value: null, eligibleCount: 0, missingCount: 0,
    excludedCount: 1, missingEvidence: ['no-eligible-observations'] });
});

test('task outcomes partition measured success, failure and indeterminate evidence', () => {
  const success = journey('success', 10), failure = journey('failure', 10), unknown = journey('unknown', 10);
  failure.metrics.nonTimingFailure = true;
  delete unknown.metrics.nonTimingFailure;
  const analysis = buildAuditMetricAnalysis(makePerformanceAuditReport('outcomes', [success, failure, unknown]));
  expect(analysis.metrics.automatedTaskSuccessPercent).toMatchObject({ value: 33.3, numerator: 1, denominator: 3,
    outcomes: { success: 1, failure: 1, indeterminate: 1 }, missingCount: 1, missingEvidence: ['unverified-evidence', 'partial-samples'] });
  expect(analysis.metrics.automatedTaskFailurePercent.value).toBeNull();
});

test('functional success is separated from successful readiness within timing limits', () => {
  const fast = journey('fast', 10), slow = journey('slow', 500), warning = journey('warning', 100);
  slow.status = 'fail'; warning.status = 'warn';
  const report = makePerformanceAuditReport('timely-outcomes', [fast, slow, warning]);
  const evidence = buildAuditMetricAnalysis(report).metrics.automatedTaskSuccessPercent;
  expect(evidence.value).toBe(100);
  expect(evidence.outcomes).toEqual({ success: 3, failure: 0, indeterminate: 0,
    withinTimingLimits: 1, timingFailures: 1, warnings: 1 });
  expect(evidence.denominator).toBe(3);
});

test('pooled callbacks expose their actual denominator without pretending independent random trials', () => {
  const first = journey('first', 10), second = journey('second', 10);
  second.metrics.eventLoopSamples = 90; second.metrics.stallsOver100Ms = 0;
  const analysis = buildAuditMetricAnalysis(makePerformanceAuditReport('samples', [first, second]));
  expect(analysis.metrics.jsStallPercent).toMatchObject({ value: 1, numerator: 1, denominator: 100, sampleSize: 100,
    unitOfAnalysis: 'callback', uncertainty: { interval: null, reason: 'correlated-observations' } });
});

test('unverified links retain contributors and full-plan legacy completion has a truthful denominator', () => {
  const report = makePerformanceAuditReport('links', [{ id: 'external-link-1', label: 'Link', kind: 'network',
    status: 'warn', durationMs: 1, metrics: { httpAttempted: false, httpReachability: 'unknown' } }]);
  const first = buildAuditMetricAnalysis(report);
  expect(first.metrics.coveragePercent.denominator).toBeNull();
  expect(first.metrics.linkVerificationPercent).toMatchObject({ value: 0, numerator: 0, denominator: 1, missingCount: 1 });
  expect(first.observations[first.metrics.linkVerificationPercent.contributors[0]]).toMatchObject({
    source: 'performance', checkId: 'external-link-1', position: 1, field: 'destinationClassified', value: false });
});

test.each(['missing', 'public-only'] as const)('legacy completion does not invent a zero health population from %s metadata', healthMetadata => {
  const report = makePerformanceAuditReport('legacy-completion', [journey('journey-rates-cold', 10)]);
  report.coverage = { plannedChecks: 1, storedChecks: 1, plannedJourneyChecks: 1, executedJourneyChecks: 1,
    justifiedSkippedJourneyChecks: 0, unexpectedSkippedJourneyChecks: 0, unavailableJourneyChecks: 0,
    coveragePercent: 100, attemptedPercent: 100, missingPlannedCheckIds: [], duplicateStoredCheckIds: [],
    unexpectedStoredCheckIds: [], excludedUnsafeFacetCount: 0, complete: true };
  report.summary.coveragePercent = 99.2;
  const code = APP_HEALTH_CHECK_CODES.CORE_SCHEMA;
  const health = finalizeAppHealthReport({ sessionId: report.sessionId, mode: 'local',
    startedAt: report.startedAt, finishedAt: report.finishedAt, plannedCheckIds: [code],
    checks: [{ id: code, code, domain: 'data-integrity', label: 'Schema', status: 'pass', metrics: {} }] });
  if (healthMetadata === 'public-only') report.appHealth = toPublicAppHealthReport(health) as never;
  const evidence = buildAuditMetricAnalysis(report).metrics.coveragePercent;
  expect(evidence).toMatchObject({ value: 99.2, numerator: 1, denominator: null,
    missingEvidence: expect.arrayContaining(['missing-denominator']) });
  expect(auditMetricRun(report).metrics.coveragePercent).toBe(99.2);
  report.appHealth = health;
  const combinedChecks = 1 + health.summary.total;
  report.summary.executed = combinedChecks;
  report.summary.coveragePercent = 100;
  expect(buildAuditMetricAnalysis(report).metrics.coveragePercent).toMatchObject({
    value: 100, numerator: combinedChecks, denominator: combinedChecks, missingEvidence: [],
  });
});

test.each([
  ['surfaceCoveragePercent', APP_HEALTH_CHECK_CODES.DISPLAY_CONTRACT],
  ['displayModelPassPercent', APP_HEALTH_CHECK_CODES.DISPLAY_MODEL],
  ['displayListPassPercent', APP_HEALTH_CHECK_CODES.DISPLAY_LIST],
  ['displayVisiblePassPercent', APP_HEALTH_CHECK_CODES.DISPLAY_VISIBILITY],
  ['displayLayoutPassPercent', APP_HEALTH_CHECK_CODES.DISPLAY_LAYOUT],
  ['displayChartPassPercent', APP_HEALTH_CHECK_CODES.DISPLAY_CHART],
  ['displayEmptyPassPercent', APP_HEALTH_CHECK_CODES.DISPLAY_EMPTY_STATE],
  ['displayLogoPassPercent', APP_HEALTH_CHECK_CODES.DISPLAY_LOGO],
] as const)('unavailable display observations cannot produce %s despite retained counts', (metric, code) => {
  const report = healthMetricReport(code, { plannedSurfaces: 1, missingSurfaces: 0, duplicateContracts: 0,
    checked: 1, missing: 0, failed: 0, warned: 0, unavailable: 0 });
  report.appHealth!.checks[0].status = 'unavailable';
  expect(auditMetricRun(report).metrics[metric]).toBeNull();
  const analysis = buildAuditMetricAnalysis(report), evidence = analysis.metrics[metric];
  expect(evidence).toMatchObject({ value: null, numerator: null, denominator: null,
    missingEvidence: ['incomplete-health-collection', 'missing-denominator'], applicability: 'not-observed' });
  expect(evidence.contributors.map(index => analysis.observations[index])).toContainEqual(
    expect.objectContaining({ field: 'completeDisplayObservation', value: false }));
});

test('partial display observations cannot become 100 percent design scores', () => {
  const report = makePerformanceAuditReport();
  const code = APP_HEALTH_CHECK_CODES.DISPLAY_LAYOUT;
  report.appHealth = finalizeAppHealthReport({ sessionId: report.sessionId, mode: 'local',
    startedAt: report.startedAt, finishedAt: report.finishedAt, plannedCheckIds: [code],
    checks: [{ id: code, code, domain: 'display-completeness', label: 'Layout', status: 'not-run',
      metrics: { checked: 1, missing: 0, failed: 0, warned: 0, unavailable: 0, partial: true } }] });
  expect(buildAuditMetricAnalysis(report).metrics.displayLayoutPassPercent).toMatchObject({ value: null,
    missingEvidence: ['incomplete-health-collection', 'missing-denominator'], applicability: 'not-observed' });
});


test('JS maxima distributions are per-check maxima and unmeasured zero remains missing', () => {
  const first = journey('first', 10), second = journey('second', 10), third = journey('third', 10);
  first.metrics.maxEventLoopLagMs = 5; second.metrics.maxEventLoopLagMs = 0; second.metrics.eventLoopSamples = 0;
  const evidence = buildAuditMetricAnalysis(makePerformanceAuditReport('maxima', [first, second, third])).metrics.maxEventLoopLagMs;
  expect(evidence).toMatchObject({ value: 5, unitOfAnalysis: 'check-maximum', sampleSize: 1, eligibleCount: 3, missingCount: 2,
    distribution: { population: 'check-maximum', n: 1, p95: 5 }, uncertainty: { reason: 'correlated-observations' } });
});

test('normal Back and an observed zero timing-failure count have no invented missing samples', () => {
  const check = journey('journey-rates-cold', 10); check.metrics.forwardMs = 10;
  const analysis = buildAuditMetricAnalysis(makePerformanceAuditReport('normal', [check]));
  expect(analysis.metrics.recoveryPercent).toMatchObject({ value: 0, missingCount: 0, missingEvidence: [] });
  expect(analysis.metrics.slowestCheckMs).toMatchObject({ missingCount: 0, missingEvidence: [] });
  expect(analysis.metrics.timingFailures).toMatchObject({ value: 0, sampleSize: 1, eligibleCount: 1 });
});


test('unknown aggregate numerators do not claim a fully observed denominator', () => {
  const report = makePerformanceAuditReport();
  const code = APP_HEALTH_CHECK_CODES.DETAILS_COMPLETENESS;
  report.appHealth = finalizeAppHealthReport({ sessionId: report.sessionId, mode: 'local',
    startedAt: report.startedAt, finishedAt: report.finishedAt, plannedCheckIds: [code],
    checks: [{ id: code, code, domain: 'data-completeness', label: 'Details', status: 'unavailable',
      metrics: { coreProducts: 100, runMatches: true, impossibleCounts: false } }] });
  expect(buildAuditMetricAnalysis(report).metrics.detailsCoveragePercent).toMatchObject({ value: null,
    numerator: null, denominator: 100, eligibleCount: 100, observedCount: 0, missingCount: 100,
    sampleSize: 0, missingEvidence: ['missing-evidence'] });
});

test('uninstrumented journeys leave the unobserved callback population unknown', () => {
  const first = journey('first', 10), second = journey('second', 10);
  second.metrics.eventLoopMeasurementAvailable = false;
  expect(buildAuditMetricAnalysis(makePerformanceAuditReport('partial', [first, second])).metrics.jsStallPercent)
    .toMatchObject({ value: 10, numerator: 1, denominator: 10, sampleSize: 10, sampleUnit: 'callback',
      eligibleCount: null, observedCount: 10, missingCount: null, excludedCount: null,
      instrumentation: { contributingJourneys: 1, missingJourneys: 1 } });
});


test('an incomplete health plan cannot assign absent checks to a domain denominator', () => {
  const report = makePerformanceAuditReport();
  const code = APP_HEALTH_CHECK_CODES.CORE_SCHEMA;
  report.appHealth = finalizeAppHealthReport({ sessionId: report.sessionId, mode: 'local',
    startedAt: report.startedAt, finishedAt: report.finishedAt, plannedCheckIds: [code, APP_HEALTH_CHECK_CODES.DISPLAY_LAYOUT],
    incompleteReason: 'Stopped', checks: [{ id: code, code, domain: 'data-integrity', label: 'Schema', status: 'pass', metrics: {} }] });
  expect(buildAuditMetricAnalysis(report).metrics.dataIntegrityPassPercent).toMatchObject({ value: null,
    eligibleCount: null, missingCount: null, missingEvidence: ['incomplete-health-collection', 'missing-denominator'] });
});
