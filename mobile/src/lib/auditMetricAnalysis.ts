import type { AuditCheck, PerformanceAuditReport } from './performanceAudit';
import { buildPerformanceAuditCompletion, hasValidPerformanceAuditHealth } from './performanceAuditCompletion';
import { AUDIT_METRIC_DEFINITIONS, AUDIT_METRIC_METHODS, type AuditMetric } from './auditMetricHistoryMetrics';
import { auditMetricValues, hasAuditReturnEvidence, measuredAuditValue as measured } from './auditMetricHistoryValues';

export type AuditMetricMissingEvidence = 'missing-evidence' | 'missing-denominator' | 'missing-samples'
  | 'partial-samples' | 'inconsistent-counts' | 'invalid-identities' | 'incomplete-health-collection'
  | 'no-eligible-observations' | 'unverified-evidence';
export interface AuditMetricObservation {
  source: 'performance' | 'health' | 'report';
  checkId?: string;
  position?: number;
  field: string;
  value: number | boolean | null;
  surfaceId?: string;
  probeId?: string;
}
export interface AuditMetricDistributionSummary {
  n: number; min: number; max: number; p50: number; p90: number; p95: number; p99: number; mad: number; iqr: number;
}
export interface AuditMetricDistribution extends AuditMetricDistributionSummary {
  method: 'nearest-rank';
  population: 'journey-forward' | 'action-duration' | 'return-duration' | 'check-maximum';
  worst: { observation: number; value: number }[];
  strata: (AuditMetricDistributionSummary & { key: 'cold' | 'warm' | 'first' | 'repeat' })[];
}
export interface AuditMetricEvidence {
  value: number | null;
  unit: 'count' | 'percent' | 'ms';
  methodId: string;
  methodVersion: 1;
  formula: string;
  unitOfAnalysis: string;
  numerator: number | null;
  denominator: number | null;
  sampleSize: number;
  sampleUnit: string;
  eligibleCount: number | null;
  observedCount: number | null;
  missingCount: number | null;
  excludedCount: number | null;
  instrumentation?: { contributingJourneys: number; missingJourneys: number };
  applicability: 'observed' | 'not-observed' | 'invalid-evidence';
  missingEvidence: AuditMetricMissingEvidence[];
  /** Indices into the shared observations table, avoiding repeated raw evidence. */
  contributors: number[];
  distribution?: AuditMetricDistribution;
  outcomes?: { success: number; failure: number; indeterminate: number };
  uncertainty: { interval: null; reason: 'deterministic-inventory' | 'correlated-observations' };
}
export interface AuditMetricAnalysis {
  schemaVersion: 1;
  context: {
    plannedChecks: number | null; plannedJourneys: number | null;
    payloadProducts: number | null; payloadProviders: number | null;
    viewportWidth: number | null; fontScale: number | null; developmentBuild: boolean | null;
  };
  observations: AuditMetricObservation[];
  metrics: Record<AuditMetric, AuditMetricEvidence>;
}

function statistics(values: number[]): AuditMetricDistributionSummary {
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (items: number[], q: number) => items[Math.max(0, Math.ceil(items.length * q) - 1)];
  const median = rank(sorted, .5);
  const deviations = sorted.map(value => Math.abs(value - median)).sort((a, b) => a - b);
  return { n: sorted.length, min: sorted[0], max: sorted[sorted.length - 1], p50: median,
    p90: rank(sorted, .9), p95: rank(sorted, .95), p99: rank(sorted, .99),
    mad: rank(deviations, .5), iqr: rank(sorted, .75) - rank(sorted, .25) };
}

/** All numbers are descriptive observations of this run, not independent random trials. */
export function buildAuditMetricAnalysis(report: PerformanceAuditReport,
  completion = buildPerformanceAuditCompletion(report)): AuditMetricAnalysis {
  const values = auditMetricValues(report, completion);
  const observations: AuditMetricObservation[] = [];
  const indices = new Map<string, number>();
  const add = (observation: AuditMetricObservation): number => {
    const key = JSON.stringify(observation);
    const existing = indices.get(key);
    if (existing !== undefined) return existing;
    const index = observations.length; observations.push(observation); indices.set(key, index); return index;
  };
  const reportField = (field: string, value: unknown) => add({ source: 'report', field,
    value: typeof value === 'boolean' ? value : measured(value) });
  const performancePositions = new Map(report.checks.map((check, index) => [check, index + 1]));
  const perf = (check: AuditCheck, field: string, value: unknown = check.metrics[field]) => add({
    source: 'performance', checkId: check.id, position: performancePositions.get(check), field,
    value: typeof value === 'boolean' ? value : measured(value),
  });
  const health = hasValidPerformanceAuditHealth(report) ? report.appHealth : undefined;
  const healthIdsValid = health != null && health.coverage.duplicateStoredCheckIds.length === 0
    && health.coverage.unexpectedStoredCheckIds.length === 0 && new Set(health.checks.map(check => check.id)).size === health.checks.length;
  const healthObservations = (code: string, fields: string[]): number[] => {
    const matches = health?.checks.map((check, index) => ({ check, index })).filter(({ check }) => check.code === code) ?? [];
    if (matches.length !== 1) return fields.map(field => add({ source: 'health', field, value: null }));
    const { check, index } = matches[0];
    return fields.map(field => add({ source: 'health', checkId: check.id, position: index + 1, field,
      value: typeof check.metrics[field] === 'boolean' ? check.metrics[field] : measured(check.metrics[field]) }));
  };
  const displayAdmission = (code: string) => {
    const index = health?.checks.findIndex(check => check.code === code) ?? -1;
    const check = index >= 0 ? health!.checks[index] : undefined;
    const partial = check?.metrics.partial === true || check?.status === 'not-run';
    const refs = check ? [add({ source: 'health', checkId: check.id, position: index + 1,
      field: 'completeDisplayObservation', value: !partial })] : [];
    return { refs, reasons: partial ? ['incomplete-health-collection' as const] : [] };
  };
  const numeric = (index: number) => measured(observations[index].value);
  const total = (refs: number[]) => refs.length && refs.every(ref => numeric(ref) !== null)
    ? refs.reduce((sum, ref) => sum + numeric(ref)!, 0) : null;
  const metrics = {} as Record<AuditMetric, AuditMetricEvidence>;
  type Detail = Partial<Pick<AuditMetricEvidence, 'numerator' | 'denominator' | 'sampleSize' | 'eligibleCount'
    | 'observedCount' | 'missingCount' | 'excludedCount' | 'outcomes' | 'sampleUnit' | 'instrumentation'>>;
  const put = (metric: AuditMetric, refs: number[], detail: Detail = {}, reasons: AuditMetricMissingEvidence[] = []) => {
    const value = values[metric];
    const missing = refs.filter(ref => observations[ref].value === null).length;
    const observed = refs.length - missing;
    const evidence = [...reasons];
    if (value === null && !evidence.length) evidence.push(observed ? 'inconsistent-counts' : 'missing-evidence');
    if (value !== null && missing) evidence.push('partial-samples');
    metrics[metric] = {
      value, unit: AUDIT_METRIC_DEFINITIONS[metric].unit, methodId: `ar.audit.${metric}`,
      methodVersion: 1, formula: AUDIT_METRIC_METHODS[metric][0], unitOfAnalysis: AUDIT_METRIC_METHODS[metric][1],
      numerator: null, denominator: null, sampleSize: observed, sampleUnit: 'evidence-field', eligibleCount: refs.length,
      observedCount: observed, missingCount: missing, excludedCount: 0,
      ...detail, applicability: value !== null ? 'observed' : evidence.some(reason =>
        ['inconsistent-counts', 'invalid-identities'].includes(reason)) ? 'invalid-evidence' : 'not-observed',
      missingEvidence: [...new Set(evidence)], contributors: [...new Set(refs)],
      uncertainty: { interval: null, reason: ['callback', 'check-maximum', 'journey', 'action', 'error'].includes(AUDIT_METRIC_METHODS[metric][1])
        ? 'correlated-observations' : 'deterministic-inventory' },
    };
  };
  const ratio = (metric: AuditMetric, numerator: number | null, denominator: number | null,
    refs: number[], detail: Detail = {}, reasons: AuditMetricMissingEvidence[] = []) => {
    const invalid = numerator !== null && denominator !== null && (numerator < 0 || numerator > denominator);
    const missing = numerator === null || denominator === null;
    put(metric, refs, { numerator, denominator, sampleSize: missing || invalid ? 0 : denominator!,
      sampleUnit: AUDIT_METRIC_METHODS[metric][1], eligibleCount: denominator,
      observedCount: denominator === null ? null : numerator === null || invalid ? 0 : denominator,
      missingCount: denominator === null ? null : numerator === null || invalid ? denominator : 0, excludedCount: 0, ...detail },
    [...reasons, ...(invalid ? ['inconsistent-counts' as const] : denominator === null ? ['missing-denominator' as const]
      : numerator === null ? ['missing-evidence' as const] : denominator === 0 ? ['no-eligible-observations' as const] : [])]);
  };
  const distribution = (metric: AuditMetric, checks: AuditCheck[], field: string, excluded = 0,
    population: AuditMetricDistribution['population'] = 'journey-forward', read?: (check: AuditCheck) => number | null) => {
    const refs = checks.map(check => perf(check, field, read ? read(check) : check.metrics[field]));
    const samples = refs.flatMap(ref => numeric(ref) === null ? [] : [{ observation: ref, value: numeric(ref)! }]);
    put(metric, refs, { sampleSize: samples.length, sampleUnit: population, eligibleCount: checks.length, observedCount: samples.length,
      missingCount: checks.length - samples.length, excludedCount: excluded },
    samples.length ? [] : [checks.length ? 'missing-samples' : 'no-eligible-observations']);
    if (!samples.length) return;
    const strata: AuditMetricDistribution['strata'] = [];
    for (const key of ['cold', 'warm', 'first', 'repeat'] as const) {
      const subset = samples.filter(sample => {
        const id = observations[sample.observation].checkId ?? '';
        return key === 'first' ? id.startsWith('deep-first-pass.') : key === 'repeat'
          ? id.startsWith('deep-repeat.') : id.endsWith(`-${key}`);
      });
      if (subset.length) strata.push({ key, ...statistics(subset.map(sample => sample.value)) });
    }
    metrics[metric].distribution = { method: 'nearest-rank', population, ...statistics(samples.map(sample => sample.value)),
      worst: [...samples].sort((a, b) => b.value - a.value).slice(0, 5), strata };
  };
  const allJourneys = report.checks.filter(check => check.kind === 'journey');
  const journeys = allJourneys.filter(check => check.status !== 'skipped' && check.metrics.executionAttempted !== false
    && check.metrics.availabilityFailure !== true);
  const actions = journeys.filter(check => check.metrics.actionInvoked === true);
  const gaps = new Set(completion.gapPositions.filter(gap => gap.source === 'performance').map(gap => gap.checkId));
  const success = actions.filter(check => check.metrics.actionCompleted === true && check.metrics.nonTimingFailure === false
    && check.diagnostic?.readiness?.ready === true && !gaps.has(check.id));
  const failure = actions.filter(check => check.metrics.nonTimingFailure === true || check.metrics.actionCompleted === false);
  const outcomes = { success: success.length, failure: failure.length, indeterminate: actions.length - success.length - failure.length };
  const actionRefs = actions.flatMap(check => [perf(check, 'actionInvoked'), perf(check, 'actionCompleted'), perf(check, 'nonTimingFailure'),
    perf(check, 'readinessReady', check.diagnostic?.readiness?.ready), perf(check, 'completionGap', gaps.has(check.id))]);
  for (const metric of ['automatedTaskSuccessPercent', 'automatedTaskFailurePercent'] as const) {
    ratio(metric, metric === 'automatedTaskSuccessPercent' ? success.length : failure.length, actions.length,
      actionRefs, { outcomes, eligibleCount: actions.length, observedCount: actions.length - outcomes.indeterminate,
        missingCount: outcomes.indeterminate, excludedCount: allJourneys.length - actions.length },
      outcomes.indeterminate ? ['unverified-evidence'] : []);
  }
  distribution('journeyP50Ms', journeys, 'forwardWorkMs', allJourneys.length - journeys.length);
  distribution('journeyP95Ms', journeys, 'forwardWorkMs', allJourneys.length - journeys.length);
  const completed = actions.filter(check => check.metrics.actionCompleted === true);
  distribution('actionP50Ms', completed, 'actionMs', allJourneys.length - completed.length, 'action-duration');
  distribution('actionP95Ms', completed, 'actionMs', allJourneys.length - completed.length, 'action-duration');
  const returns = journeys.filter(hasAuditReturnEvidence);
  const back = returns.filter(check => measured(check.metrics.backMs) !== null);
  distribution('backP95Ms', returns, 'backMs', allJourneys.length - returns.length, 'return-duration');
  const recoveries = back.filter(check => ['replaceRecoveryMs', 'anchorResetMs'].some(field => (measured(check.metrics[field]) ?? 0) > 0));
  ratio('recoveryPercent', recoveries.length, back.length,
    back.flatMap(check => [perf(check, 'backMs'), perf(check, 'replacementRecoveryObserved', (measured(check.metrics.replaceRecoveryMs) ?? 0) > 0),
      perf(check, 'anchorRecoveryObserved', (measured(check.metrics.anchorResetMs) ?? 0) > 0)]),
    { excludedCount: allJourneys.length - back.length });
  for (const [metric, samples, events, available] of [
    ['jsStallPercent', 'eventLoopSamples', 'stallsOver100Ms', 'eventLoopMeasurementAvailable'],
    ['slowFramePercent', 'frameSamples', 'framesOver50Ms', 'frameMeasurementAvailable'],
  ] as const) {
    const checks = journeys.filter(check => check.metrics[available] === true);
    const sampleRefs = checks.map(check => perf(check, samples)), eventRefs = checks.map(check => perf(check, events));
    const consistent = checks.length === 0 || sampleRefs.every((ref, index) => Number.isSafeInteger(numeric(ref))
      && Number.isSafeInteger(numeric(eventRefs[index])) && numeric(eventRefs[index])! <= numeric(ref)!)
      && Number.isSafeInteger(total(sampleRefs)) && Number.isSafeInteger(total(eventRefs));
    ratio(metric, consistent ? total(eventRefs) : null, consistent ? total(sampleRefs) : null, [...sampleRefs, ...eventRefs],
      { observedCount: consistent ? total(sampleRefs) : null,
        eligibleCount: !consistent || checks.length < journeys.length ? null : total(sampleRefs),
        missingCount: !consistent || checks.length < journeys.length ? null : 0,
        excludedCount: !consistent || checks.length < journeys.length ? null : 0,
        instrumentation: { contributingJourneys: checks.length, missingJourneys: journeys.length - checks.length } },
      [...(consistent ? [] : ['inconsistent-counts' as const]),
        ...(checks.length < journeys.length ? ['partial-samples' as const] : [])]);
  }
  put('runtimeErrors', journeys.map(check => perf(check, 'runtimeErrors')),
    { sampleUnit: 'journey', eligibleCount: journeys.length, excludedCount: allJourneys.length - journeys.length });
  put('durationMs', [reportField('durationMs', report.durationMs)]);
  put('wallClockMs', [reportField('wallClockMs', report.wallClockMs)]);
  const slowest = report.checks.filter(check => check.id === report.summary.slowestCheckId);
  const slowestRefs = slowest.flatMap(check => {
    const fields = check.kind === 'journey' ? ['forwardMs', 'backMs']
      : check.id === 'runtime-responsiveness' ? ['maxEventLoopLagMs', 'maxFrameGapMs']
        : check.id === 'active-data' ? ['stringifyMs', 'parseMs', 'traversalMs', 'maxEventLoopLagMs']
          : check.id === 'async-storage' ? ['maxWriteMs', 'maxReadMs']
            : check.id === 'file-system' ? ['writeMs', 'readMs'] : [];
    const measuredFields = fields.filter(field => measured(check.metrics[field]) !== null);
    return measuredFields.length ? measuredFields.map(field => perf(check, field)) : [perf(check, 'durationMs', check.durationMs)];
  });
  put('slowestCheckMs', [reportField('summary.slowestCheckMs', report.summary.slowestCheckMs), ...slowestRefs],
    { sampleSize: slowest.length, sampleUnit: 'winning-check', eligibleCount: report.checks.length, observedCount: slowest.length, missingCount: 0 });
  for (const metric of ['maxEventLoopLagMs', 'maxFrameGapMs'] as const) {
    const sampleField = metric === 'maxFrameGapMs' ? 'frameSamples' : 'eventLoopSamples';
    const eligible = report.checks.filter(check => journeys.includes(check) || check.id === 'runtime-responsiveness'
      || Object.prototype.hasOwnProperty.call(check.metrics, metric));
    distribution(metric, eligible, metric, report.checks.length - eligible.length, 'check-maximum', check => {
      const value = measured(check.metrics[metric]);
      return value !== null && (value > 0 || (measured(check.metrics[sampleField]) ?? 0) > 0) ? value : null;
    });
    metrics[metric].contributors.push(reportField(`summary.${metric}`, report.summary[metric]),
      ...eligible.map(check => perf(check, sampleField)));
  }
  const failureRefs = completion.failurePositions.map(failed => add({ source: failed.source,
    checkId: failed.checkId ?? undefined, position: failed.position, field: 'failed', value: true }));
  put('failures', failureRefs, { sampleSize: report.checks.length + (health?.checks.length ?? 0), sampleUnit: 'check',
    eligibleCount: report.checks.length + (health?.checks.length ?? 0), observedCount: report.checks.length + (health?.checks.length ?? 0) });
  put('timingFailures', completion.failurePositions.filter(failed => failed.category === 'timing').map(failed => add({
    source: failed.source, checkId: failed.checkId ?? undefined, position: failed.position, field: 'timingFailure', value: true })),
  { sampleSize: report.checks.length, sampleUnit: 'check', eligibleCount: report.checks.length, observedCount: report.checks.length, missingCount: 0 });
  // The legacy numerator includes health checks. A public or older report may
  // retain that percentage while omitting the canonical health inventory;
  // absent health metadata cannot establish a zero-sized health population.
  const legacyCompletionTotal = report.coverage && completion.gaps.invalidCoverageReports === 0 && health
    ? measured(report.coverage.plannedChecks + health.summary.total) : null;
  put('coveragePercent', [reportField('summary.coveragePercent', report.summary.coveragePercent),
    reportField('summary.executed', report.summary.executed), reportField('coverage.plannedChecks', report.coverage?.plannedChecks),
    reportField('health.summary.total', health?.summary.total)],
    { numerator: measured(report.summary.executed), denominator: legacyCompletionTotal },
    legacyCompletionTotal === null ? ['missing-denominator'] : []);
  const coverage = completion.gaps.invalidCoverageReports === 0 ? report.coverage : undefined;
  const unexpected = new Set(coverage?.unexpectedStoredCheckIds ?? []);
  const collected = new Set(report.checks.filter(check => !unexpected.has(check.id)).map(check => check.id)).size;
  ratio('collectionPercent', coverage ? collected : null, measured(coverage?.plannedChecks),
    [reportField('coverage.plannedChecks', coverage?.plannedChecks), ...report.checks.map(check => perf(check, 'expectedStored', !unexpected.has(check.id)))],
    { observedCount: collected, missingCount: coverage ? Math.max(0, coverage.plannedChecks - collected) : 0,
      excludedCount: report.checks.length - collected });
  ratio('journeyCoveragePercent', measured(coverage?.executedJourneyChecks), measured(coverage?.plannedJourneyChecks),
    [reportField('coverage.executedJourneyChecks', coverage?.executedJourneyChecks), reportField('coverage.plannedJourneyChecks', coverage?.plannedJourneyChecks)]);
  for (const metric of ['readinessCoveragePercent', 'responsivenessCoveragePercent'] as const) {
    const measuredChecks = journeys.filter(check => metric === 'readinessCoveragePercent'
      ? check.diagnostic?.readiness?.capturing === true && typeof check.diagnostic.readiness.ready === 'boolean'
      : check.metrics.eventLoopMeasurementAvailable === true && check.metrics.frameMeasurementAvailable === true);
    const refs = journeys.flatMap(check => metric === 'readinessCoveragePercent'
      ? [perf(check, 'readinessCapturing', check.diagnostic?.readiness?.capturing), perf(check, 'readinessReady', check.diagnostic?.readiness?.ready)]
      : [perf(check, 'eventLoopMeasurementAvailable'), perf(check, 'frameMeasurementAvailable')]);
    ratio(metric, measuredChecks.length, journeys.length, refs,
      { observedCount: measuredChecks.length, missingCount: journeys.length - measuredChecks.length,
        excludedCount: allJourneys.length - journeys.length });
  }
  const links = report.checks.filter(check => /^external-link-[0-9]+$/.test(check.id));
  const unverifiedLinkIds = new Set(completion.gapPositions.filter(gap => gap.source === 'performance'
    && gap.reason === 'unverified-link').map(gap => gap.checkId));
  const linkRefs = links.map(check => perf(check, 'destinationClassified', !unverifiedLinkIds.has(check.id)));
  ratio('linkVerificationPercent', links.length - completion.gaps.unverifiedLinks, links.length, linkRefs,
    { observedCount: links.length - completion.gaps.unverifiedLinks, missingCount: completion.gaps.unverifiedLinks });
  put('unverifiedLinks', linkRefs, { sampleSize: links.length, sampleUnit: 'destination', observedCount: links.length - completion.gaps.unverifiedLinks,
    missingCount: completion.gaps.unverifiedLinks });
  put('missingChecks', [reportField('completion.gaps.missingChecks', completion.gaps.missingChecks),
    ...completion.missingPlannedChecks.map(missing => add({ source: missing.source, checkId: missing.checkId ?? undefined, field: 'missingPlanned', value: true }))]);
  put('targetProbeDefects', completion.gapPositions.filter(gap => ['probe-error', 'probe-revision-mismatch'].includes(gap.reason)).map(gap => add({
    source: gap.source, checkId: gap.checkId ?? undefined, position: gap.position, field: gap.reason, value: true,
    surfaceId: gap.surfaceId, probeId: gap.probeId })), { eligibleCount: null, sampleSize: completion.gaps.targetProbeDefects, sampleUnit: 'probe-issue',
      observedCount: completion.gaps.targetProbeDefects, missingCount: 0 });
  ratio('checkPassPercent', report.checks.filter(check => check.status === 'pass').length, report.checks.length,
    report.checks.map(check => perf(check, 'statusPass', check.status === 'pass')));
  const healthReasons: AuditMetricMissingEvidence[] = !health ? ['missing-evidence'] : !healthIdsValid ? ['invalid-identities'] : [];
  for (const metric of ['healthCoveragePercent', 'healthPassPercent', 'dataIntegrityPassPercent', 'dataCompletenessPassPercent'] as const) {
    const domain = metric === 'dataIntegrityPassPercent' ? 'data-integrity' : metric === 'dataCompletenessPassPercent' ? 'data-completeness' : null;
    const checks = health?.checks.filter(check => !domain || check.domain === domain) ?? [];
    const accepted = checks.filter(check => metric === 'healthCoveragePercent' ? !['not-run', 'unavailable'].includes(check.status) : check.status === 'pass');
    const admitted = healthIdsValid && (!domain || health?.coverage.complete === true);
    ratio(metric, admitted ? accepted.length : null, admitted ? domain ? checks.length : measured(health?.coverage.plannedChecks) : null,
      checks.map(check => add({ source: 'health', checkId: check.id, position: health!.checks.indexOf(check) + 1,
        field: metric === 'healthCoveragePercent' ? 'executed' : 'statusPass', value: accepted.includes(check) })),
      { eligibleCount: admitted ? domain ? checks.length : measured(health?.coverage.plannedChecks) : null,
        observedCount: checks.length, missingCount: !admitted ? null : domain ? 0
          : health ? Math.max(0, health.coverage.plannedChecks - checks.length) : null },
      [...healthReasons, ...(domain && health?.coverage.complete !== true ? ['incomplete-health-collection' as const] : [])]);
  }
  for (const [metric, code, numerator, denominator, guard] of [
    ['providerSuccessPercent', 'coverage-reconciliation', 'providersSucceeded', 'providersAttempted', 'invalidCounts'],
    ['detailsCoveragePercent', 'details-completeness', 'matchedProducts', 'coreProducts', 'runMatches'],
  ] as const) {
    const refs = healthObservations(code, [numerator, denominator, guard]);
    const admitted = observations[refs[2]].value === (guard === 'invalidCounts' ? false : true);
    ratio(metric, admitted ? numeric(refs[0]) : null, admitted ? numeric(refs[1]) : null, refs,
      {}, admitted ? [] : ['unverified-evidence']);
  }
  const historyRefs = healthObservations('catalogue-identity-coverage', ['historyDaysChecked', 'historyAvailable']);
  const historyCheck = health?.checks.filter(check => check.code === 'catalogue-identity-coverage');
  const historyAdmitted = observations[historyRefs[1]].value === true;
  let sourceGapDays: number | null = null;
  if (historyAdmitted && historyCheck?.length === 1 && typeof historyCheck[0].metrics.historySourceGapDays === 'string') {
    try {
      const parsed: unknown = JSON.parse(historyCheck[0].metrics.historySourceGapDays);
      if (Array.isArray(parsed) && parsed.every(day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day))) sourceGapDays = new Set(parsed).size;
    } catch { /* malformed source evidence remains unknown */ }
  }
  historyRefs.push(add({ source: 'health', checkId: historyCheck?.length === 1 ? historyCheck[0].id : undefined,
    position: historyCheck?.length === 1 ? health!.checks.indexOf(historyCheck[0]) + 1 : undefined,
    field: 'distinctHistorySourceGapDays', value: sourceGapDays }));
  const historyDays = historyAdmitted ? numeric(historyRefs[0]) : null;
  ratio('historySourceCoveragePercent', historyDays !== null && sourceGapDays !== null ? historyDays - sourceGapDays : null,
    historyDays, historyRefs, {}, historyAdmitted ? [] : ['unverified-evidence']);
  for (const [metric, field] of [['historyProcessingMismatches', 'historyProcessingMismatches'],
    ['historyProjectionMismatches', 'historyChartProjectionMismatches']] as const) {
    put(metric, healthObservations('catalogue-identity-coverage', [field]));
  }
  const surfaces = healthObservations('display-contract', ['plannedSurfaces', 'missingSurfaces', 'duplicateContracts', 'duplicateObservations', 'unexpectedSurfaces']);
  const planned = numeric(surfaces[0]), missing = numeric(surfaces[1]);
  const surfaceAdmission = displayAdmission('display-contract');
  const duplicateContracts = numeric(surfaces[2]);
  const surfacesAdmitted = duplicateContracts === 0 && surfaceAdmission.reasons.length === 0;
  ratio('surfaceCoveragePercent', surfacesAdmitted && planned !== null && missing !== null ? planned - missing : null,
    surfacesAdmitted ? planned : null, [...surfaces, ...surfaceAdmission.refs],
    { observedCount: surfacesAdmitted && planned !== null && missing !== null ? Math.max(0, planned - missing) : null,
      missingCount: surfacesAdmitted ? missing : null },
    [...surfaceAdmission.reasons, ...(duplicateContracts === 0 ? []
      : [duplicateContracts === null ? 'unverified-evidence' as const : 'invalid-identities' as const])]);
  for (const [metric, code] of [
    ['displayModelPassPercent', 'display-model'], ['displayListPassPercent', 'display-list'],
    ['displayVisiblePassPercent', 'display-visible'], ['displayLayoutPassPercent', 'display-layout'],
    ['displayChartPassPercent', 'display-chart'], ['displayEmptyPassPercent', 'display-empty-state'], ['displayLogoPassPercent', 'display-logo'],
  ] as const) {
    const refs = healthObservations(code, ['checked', 'missing', 'failed', 'warned', 'unavailable']);
    const [checked, absent, failed, warned, unavailable] = refs.map(numeric);
    const admission = displayAdmission(code);
    const admitted = admission.reasons.length === 0;
    ratio(metric, admitted && checked !== null && failed !== null && warned !== null && unavailable !== null ? checked - failed - warned - unavailable : null,
      admitted && checked !== null && absent !== null ? checked + absent : null, [...refs, ...admission.refs],
      { observedCount: checked ?? 0, missingCount: absent ?? 0 }, admission.reasons);
  }
  return { schemaVersion: 1, context: { plannedChecks: measured(report.coverage?.plannedChecks),
    plannedJourneys: measured(report.coverage?.plannedJourneyChecks), payloadProducts: measured(report.environment.payloadProducts),
    payloadProviders: measured(report.environment.payloadProviders), viewportWidth: measured(report.environment.viewportWidth),
    fontScale: measured(report.environment.fontScale), developmentBuild: typeof report.environment.developmentBuild === 'boolean'
      ? report.environment.developmentBuild : null }, observations, metrics };
}
