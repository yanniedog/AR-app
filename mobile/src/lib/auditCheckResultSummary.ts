import type { PerformanceAuditReport } from './performanceAudit';
import { buildPerformanceAuditCompletion, hasValidPerformanceAuditHealth } from './performanceAuditCompletion';
import { AUDIT_METRICS, AUDIT_METRIC_DEFINITIONS, AUDIT_METRIC_METHODS, type AuditMetric } from './auditMetricHistoryMetrics';
import { auditMetricValues, auditTaskOutcomePopulation, measuredAuditCount } from './auditMetricHistoryValues';

/** Screen-sized facts only: never build distributions or per-observation contributor tables. */
export function auditCheckResultSummary(report: PerformanceAuditReport) {
  const completion = buildPerformanceAuditCompletion(report);
  const values = auditMetricValues(report, completion);
  const population = auditTaskOutcomePopulation(report, completion);
  const health = hasValidPerformanceAuditHealth(report) ? report.appHealth : undefined;
  const metrics = {} as Partial<Record<AuditMetric, { numerator: number | null; denominator: number | null;
    missingCount: number | null; unit: 'count' | 'percent' | 'ms'; unitOfAnalysis: string;
    inventory?: { observed: number | null; expected: number | null; unavailable: number | null } }>>;
  const displayCodes: Partial<Record<AuditMetric, string>> = {
    displayModelPassPercent: 'display-model', displayListPassPercent: 'display-list', displayVisiblePassPercent: 'display-visible',
    displayLayoutPassPercent: 'display-layout', displayChartPassPercent: 'display-chart',
    displayEmptyPassPercent: 'display-empty-state', displayLogoPassPercent: 'display-logo', surfaceCoveragePercent: 'display-contract',
  };
  for (const metric of AUDIT_METRICS) {
    const group = AUDIT_METRIC_DEFINITIONS[metric].group;
    if (group !== 'Check results' && group !== 'Rendering checks') continue;
    let numerator: number | null = null, denominator: number | null = null, missingCount: number | null = null;
    let inventory: { observed: number | null; expected: number | null; unavailable: number | null } | undefined;
    if (metric === 'checkPassPercent') {
      numerator = report.checks.filter(check => check.status === 'pass').length;
      denominator = report.checks.length; missingCount = 0;
    } else if (metric === 'timingFailures') {
      missingCount = 0;
    } else if (metric === 'healthPassPercent' || metric === 'dataIntegrityPassPercent' || metric === 'dataCompletenessPassPercent') {
      const domain = metric === 'dataIntegrityPassPercent' ? 'data-integrity' : metric === 'dataCompletenessPassPercent' ? 'data-completeness' : null;
      const valid = health && health.coverage.duplicateStoredCheckIds.length === 0
        && health.coverage.unexpectedStoredCheckIds.length === 0 && new Set(health.checks.map(check => check.id)).size === health.checks.length;
      if (valid && (!domain || health.coverage.complete)) {
        const checks = health.checks.filter(check => !domain || check.domain === domain);
        numerator = checks.filter(check => check.status === 'pass').length;
        denominator = domain ? checks.length : health.coverage.plannedChecks;
        missingCount = denominator - checks.length;
      }
    } else if (displayCodes[metric]) {
      const checks = health?.checks.filter(check => check.code === displayCodes[metric]);
      const check = checks?.length === 1 ? checks[0] : undefined;
      if (check && metric !== 'surfaceCoveragePercent') {
        const observed = measuredAuditCount(check.metrics.checked), missing = measuredAuditCount(check.metrics.missing);
        inventory = { observed, expected: observed !== null && missing !== null ? measuredAuditCount(observed + missing) : null,
          unavailable: measuredAuditCount(check.metrics.unavailable) };
      }
      if (check && check.metrics.partial !== true && !['not-run', 'unavailable'].includes(check.status)) {
        if (metric === 'surfaceCoveragePercent') {
          if (measuredAuditCount(check.metrics.duplicateContracts) === 0) {
            denominator = measuredAuditCount(check.metrics.plannedSurfaces);
            missingCount = measuredAuditCount(check.metrics.missingSurfaces);
            numerator = denominator !== null && missingCount !== null ? denominator - missingCount : null;
          }
        } else {
          const checked = measuredAuditCount(check.metrics.checked);
          const failed = measuredAuditCount(check.metrics.failed), warned = measuredAuditCount(check.metrics.warned);
          const unavailable = measuredAuditCount(check.metrics.unavailable);
          missingCount = measuredAuditCount(check.metrics.missing);
          numerator = checked !== null && failed !== null && warned !== null && unavailable !== null
            ? checked - failed - warned - unavailable : null;
          denominator = checked !== null && missingCount !== null ? checked + missingCount : null;
        }
      } else if (check && metric !== 'surfaceCoveragePercent') {
        // Full analysis retains the missing-role count even when admission fails.
        missingCount = measuredAuditCount(check.metrics.missing);
      }
    } else {
      const history = health?.checks.find(check => check.code === 'catalogue-identity-coverage');
      numerator = values[metric];
      const comparisons = measuredAuditCount(history?.metrics[metric === 'historyProcessingMismatches'
        ? 'historyProcessingComparisons' : 'historyChartProjectionComparisons']);
      missingCount = comparisons === null ? null : 0;
    }
    if (numerator !== null && measuredAuditCount(numerator) === null
      || denominator !== null && measuredAuditCount(denominator) === null
      || numerator !== null && denominator !== null && numerator > denominator) {
      numerator = null; denominator = null; missingCount = null;
    }
    metrics[metric] = { numerator, denominator, missingCount, unit: AUDIT_METRIC_DEFINITIONS[metric].unit,
      unitOfAnalysis: AUDIT_METRIC_METHODS[metric][1], ...(inventory ? { inventory } : {}) };
  }
  return { metrics, taskEvidence: { denominator: population.actions.length, outcomes: population.outcomes } };
}
