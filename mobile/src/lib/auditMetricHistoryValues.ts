import type { AuditCheck, PerformanceAuditReport } from './performanceAudit';
import { hasValidPerformanceAuditHealth, type buildPerformanceAuditCompletion } from './performanceAuditCompletion';
import { AUDIT_METRICS, type AuditMetric } from './auditMetricHistoryMetrics';

export const measuredAuditValue = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
export const measuredAuditCount = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;

/** A nonzero retained mismatch proves an observation; zero needs comparison evidence. */
export function observedHistoryMismatchCount(mismatches: unknown, comparisons: unknown): number | null {
  const count = measuredAuditCount(mismatches), compared = measuredAuditCount(comparisons);
  return count !== null && (count > 0 || compared !== null && compared > 0) ? count : null;
}

/** A missing Back sample is meaningful only for a journey with return evidence. */
export const hasAuditReturnEvidence = (check: AuditCheck): boolean =>
  check.metrics.measurementMode === 'route-round-trip'
  || Object.prototype.hasOwnProperty.call(check.metrics, 'backMs')
  || typeof check.metrics.backReturnedToAudit === 'boolean'
  || typeof check.metrics.backChangedPath === 'boolean';

/** Route navigation has forward/Back timings, not a semantic-action duration. */
export const hasAuditActionDurationEvidence = (check: AuditCheck): boolean =>
  check.metrics.measurementMode === 'semantic-action'
  || check.metrics.measurementMode !== 'route-round-trip'
    && Object.prototype.hasOwnProperty.call(check.metrics, 'actionMs');

/** Invalid/inconsistent denominators are unknown, never silently clamped to 100. */
function percent(numerator: unknown, denominator: unknown): number | null {
  const n = measuredAuditCount(numerator), d = measuredAuditCount(denominator);
  return n !== null && d !== null && d > 0 && n <= d ? Math.round(n / d * 1000) / 10 : null;
}
function percentile(values: (number | null)[], fraction: number): number | null {
  const sorted = values.filter((value): value is number => value !== null).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] : null;
}
function sampledRate(checks: AuditCheck[], samples: string, events: string, available: string): number | null {
  const observed = checks.filter(check => check.metrics[available] === true);
  if (!observed.length) return null;
  let total = 0, slow = 0;
  for (const check of observed) {
    const n = measuredAuditValue(check.metrics[samples]), e = measuredAuditValue(check.metrics[events]);
    if (n === null || e === null || !Number.isSafeInteger(n) || !Number.isSafeInteger(e) || e > n) return null;
    total += n; slow += e;
    if (!Number.isSafeInteger(total) || !Number.isSafeInteger(slow)) return null;
  }
  return percent(slow, total);
}

export function auditTaskOutcomePopulation(report: PerformanceAuditReport,
  completion: ReturnType<typeof buildPerformanceAuditCompletion>) {
  const actions = report.checks.filter(check => check.kind === 'journey' && check.status !== 'skipped'
    && check.metrics.executionAttempted !== false && check.metrics.availabilityFailure !== true && check.metrics.actionInvoked === true);
  const defects = new Set(completion.gapPositions.filter(gap => gap.source === 'performance').map(gap => gap.checkId));
  const success = actions.filter(check => check.metrics.actionCompleted === true && check.metrics.nonTimingFailure === false
    && check.diagnostic?.readiness?.ready === true && !defects.has(check.id));
  const failure = actions.filter(check => check.metrics.nonTimingFailure === true || check.metrics.actionCompleted === false);
  const withinTimingLimits = success.filter(check => check.status === 'pass'
    && check.metrics.eventLoopMeasurementAvailable === true && check.metrics.frameMeasurementAvailable === true
    && measuredAuditValue(check.metrics.forwardWorkMs) !== null).length;
  const timingFailures = success.filter(check => check.status === 'fail').length;
  return { actions, success, failure, outcomes: { success: success.length, failure: failure.length,
    indeterminate: actions.length - success.length - failure.length, withinTimingLimits, timingFailures,
    warnings: success.length - withinTimingLimits - timingFailures } };
}

function extendedAuditMetricValues(report: PerformanceAuditReport,
  completion: ReturnType<typeof buildPerformanceAuditCompletion>): Partial<Record<AuditMetric, number | null>> {
  const health = hasValidPerformanceAuditHealth(report) ? report.appHealth : undefined;
  const healthCheck = (code: string) => {
    const matches = health?.checks.filter(check => check.code === code) ?? [];
    return matches.length === 1 ? matches[0] : undefined;
  };
  const value = (code: string, name: string) => measuredAuditCount(healthCheck(code)?.metrics[name]);
  const ratio = (code: string, numerator: string, denominator: string) => percent(value(code, numerator), value(code, denominator));
  const healthIdentityValid = health != null && health.coverage.duplicateStoredCheckIds.length === 0
    && health.coverage.unexpectedStoredCheckIds.length === 0
    && new Set(health.checks.map(check => check.id)).size === health.checks.length;
  const domainPass = (domain: string) => {
    if (!healthIdentityValid || !health?.coverage.complete) return null;
    const checks = health?.checks.filter(check => check.domain === domain) ?? [];
    return percent(checks.filter(check => check.status === 'pass').length, checks.length);
  };
  const displayPass = (code: string) => {
    if (healthCheck(code)?.metrics.partial === true || ['not-run', 'unavailable'].includes(healthCheck(code)?.status ?? '')) return null;
    const [checked, missing, failed, warned, unavailable] = ['checked', 'missing', 'failed', 'warned', 'unavailable'].map(key => value(code, key));
    if (checked === null || missing === null || failed === null || warned === null || unavailable === null) return null;
    return percent(checked - failed - warned - unavailable, checked + missing);
  };
  const journeys = report.checks.filter(check => check.kind === 'journey' && check.status !== 'skipped'
    && check.metrics.executionAttempted !== false && check.metrics.availabilityFailure !== true);
  const { actions, success: successful, failure: failed } = auditTaskOutcomePopulation(report, completion);
  const actionTimes = actions.filter(check => check.metrics.actionCompleted === true && hasAuditActionDurationEvidence(check))
    .map(check => measuredAuditValue(check.metrics.actionMs));
  const journeyTimes = journeys.map(check => measuredAuditValue(check.metrics.forwardWorkMs));
  const links = report.checks.filter(check => /^external-link-[0-9]+$/.test(check.id));
  const coverage = completion.gaps.invalidCoverageReports === 0 ? report.coverage : undefined;
  const observedIds = new Set(report.checks.map(check => check.id));
  const unexpected = new Set(coverage?.unexpectedStoredCheckIds ?? []);
  const collected = [...observedIds].filter(id => !unexpected.has(id)).length;
  const returnChecks = journeys.filter(hasAuditReturnEvidence);
  const backChecks = returnChecks.filter(check => measuredAuditValue(check.metrics.backMs) !== null);
  const recoveryChecks = backChecks.filter(check => ['replaceRecoveryMs', 'anchorResetMs']
    .some(key => (measuredAuditValue(check.metrics[key]) ?? 0) > 0));
  const errorCounts = journeys.map(check => measuredAuditCount(check.metrics.runtimeErrors));
  let historySourceCoverage: number | null = null;
  const history = healthCheck('catalogue-identity-coverage')?.metrics;
  if (history?.historyAvailable === true && typeof history.historySourceGapDays === 'string') {
    try {
      const gaps: unknown = JSON.parse(history.historySourceGapDays);
      const days = measuredAuditCount(history.historyDaysChecked);
      if (days !== null && Array.isArray(gaps) && gaps.every(day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day))) {
        historySourceCoverage = percent(days - new Set(gaps).size, days);
      }
    } catch { /* Unknown historical evidence stays a gap. */ }
  }
  const plannedSurfaces = value('display-contract', 'plannedSurfaces');
  const missingSurfaces = value('display-contract', 'missingSurfaces');
  const surfaceCoverage = plannedSurfaces !== null && missingSurfaces !== null
    && healthCheck('display-contract')?.metrics.partial !== true
    && !['not-run', 'unavailable'].includes(healthCheck('display-contract')?.status ?? '')
    && value('display-contract', 'duplicateContracts') === 0
    ? percent(plannedSurfaces - missingSurfaces, plannedSurfaces) : null;
  return {
    wallClockMs: measuredAuditValue(report.wallClockMs),
    journeyP50Ms: percentile(journeyTimes, .5), journeyP95Ms: percentile(journeyTimes, .95),
    jsStallPercent: sampledRate(journeys, 'eventLoopSamples', 'stallsOver100Ms', 'eventLoopMeasurementAvailable'),
    slowFramePercent: sampledRate(journeys, 'frameSamples', 'framesOver50Ms', 'frameMeasurementAvailable'),
    collectionPercent: coverage ? percent(collected, coverage.plannedChecks) : null,
    journeyCoveragePercent: coverage ? percent(coverage.executedJourneyChecks, coverage.plannedJourneyChecks) : null,
    healthCoveragePercent: health && healthIdentityValid ? percent(health.checks.filter(check => !['not-run', 'unavailable'].includes(check.status)).length,
      health.coverage.plannedChecks) : null,
    readinessCoveragePercent: percent(journeys.filter(check => check.diagnostic?.readiness?.capturing === true
      && typeof check.diagnostic.readiness.ready === 'boolean').length, journeys.length),
    responsivenessCoveragePercent: percent(journeys.filter(check => check.metrics.eventLoopMeasurementAvailable === true
      && check.metrics.frameMeasurementAvailable === true).length, journeys.length),
    linkVerificationPercent: percent(links.length - completion.gaps.unverifiedLinks, links.length),
    providerSuccessPercent: healthCheck('coverage-reconciliation')?.metrics.invalidCounts === false
      ? ratio('coverage-reconciliation', 'providersSucceeded', 'providersAttempted') : null,
    detailsCoveragePercent: healthCheck('details-completeness')?.metrics.runMatches === true
      && healthCheck('details-completeness')?.metrics.impossibleCounts === false
      ? ratio('details-completeness', 'matchedProducts', 'coreProducts') : null,
    historySourceCoveragePercent: historySourceCoverage,
    missingChecks: coverage ? completion.gaps.missingChecks : null,
    targetProbeDefects: journeys.length ? completion.gaps.targetProbeDefects : null,
    unverifiedLinks: links.length ? completion.gaps.unverifiedLinks : null,
    automatedTaskSuccessPercent: percent(successful.length, actions.length),
    automatedTaskFailurePercent: actions.every(check => typeof check.metrics.nonTimingFailure === 'boolean'
      && typeof check.metrics.actionCompleted === 'boolean') ? percent(failed.length, actions.length) : null,
    actionP50Ms: percentile(actionTimes, .5), actionP95Ms: percentile(actionTimes, .95),
    backP95Ms: percentile(returnChecks.map(check => measuredAuditValue(check.metrics.backMs)), .95),
    recoveryPercent: percent(recoveryChecks.length, backChecks.length),
    runtimeErrors: errorCounts.length && errorCounts.every(count => count !== null)
      ? measuredAuditCount(errorCounts.reduce<number>((sum, count) => sum + (count ?? 0), 0)) : null,
    checkPassPercent: percent(report.checks.filter(check => check.status === 'pass').length, report.checks.length),
    healthPassPercent: health && healthIdentityValid ? percent(health.checks.filter(check => check.status === 'pass').length, health.coverage.plannedChecks) : null,
    dataIntegrityPassPercent: domainPass('data-integrity'), dataCompletenessPassPercent: domainPass('data-completeness'),
    timingFailures: report.checks.length ? completion.failurePositions.filter(failure => failure.category === 'timing').length : null,
    historyProcessingMismatches: observedHistoryMismatchCount(history?.historyProcessingMismatches, history?.historyProcessingComparisons),
    historyProjectionMismatches: observedHistoryMismatchCount(history?.historyChartProjectionMismatches, history?.historyChartProjectionComparisons),
    surfaceCoveragePercent: surfaceCoverage,
    displayModelPassPercent: displayPass('display-model'), displayListPassPercent: displayPass('display-list'),
    displayVisiblePassPercent: displayPass('display-visible'), displayLayoutPassPercent: displayPass('display-layout'),
    displayChartPassPercent: displayPass('display-chart'), displayEmptyPassPercent: displayPass('display-empty-state'),
    displayLogoPassPercent: displayPass('display-logo'),
  };
}


/** Canonical lightweight value derivation shared by storage and full analysis. */
export function auditMetricValues(report: PerformanceAuditReport,
  completion: ReturnType<typeof buildPerformanceAuditCompletion>): Record<AuditMetric, number | null> {
  return {
    ...Object.fromEntries(AUDIT_METRICS.map(metric => [metric, null])) as Record<AuditMetric, number | null>,
    ...extendedAuditMetricValues(report, completion),
    failures: completion.failurePositions.length,
    coveragePercent: measuredAuditValue(report.summary.coveragePercent), durationMs: measuredAuditValue(report.durationMs),
    slowestCheckMs: measuredAuditValue(report.summary.slowestCheckMs),
    maxEventLoopLagMs: measuredAuditValue(report.summary.maxEventLoopLagMs), maxFrameGapMs: measuredAuditValue(report.summary.maxFrameGapMs),
  };
}
