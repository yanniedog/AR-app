import type { UiLabel } from './uiCopy';
import type { PerformanceAuditReport } from './performanceAudit';

export const AUDIT_METRIC_GROUPS = ['Performance', 'Coverage', 'Task outcomes', 'Check results', 'Rendering checks'] as const satisfies readonly UiLabel[];
export type AuditMetricGroup = typeof AUDIT_METRIC_GROUPS[number];

/** Named measured ratios, not a synthetic industry certification or usability grade. */
export const AUDIT_METRIC_DEFINITIONS = {
  failures: { label: 'Failures', group: 'Performance', unit: 'count' },
  coveragePercent: { label: 'Check completion', group: 'Performance', unit: 'percent' },
  durationMs: { label: 'Duration', group: 'Performance', unit: 'ms' },
  slowestCheckMs: { label: 'Slowest check', group: 'Performance', unit: 'ms' },
  maxEventLoopLagMs: { label: 'Max JS lag', group: 'Performance', unit: 'ms' },
  maxFrameGapMs: { label: 'JS animation gap', group: 'Performance', unit: 'ms' },
  wallClockMs: { label: 'Wall clock', group: 'Performance', unit: 'ms' },
  journeyP50Ms: { label: 'Journey time p50', group: 'Performance', unit: 'ms' },
  journeyP95Ms: { label: 'Journey time p95', group: 'Performance', unit: 'ms' },
  jsStallPercent: { label: 'JS stalls over 100 ms', group: 'Performance', unit: 'percent' },
  slowFramePercent: { label: 'JS frames over 50 ms', group: 'Performance', unit: 'percent' },
  collectionPercent: { label: 'Collected checks', group: 'Coverage', unit: 'percent' },
  journeyCoveragePercent: { label: 'Journey execution', group: 'Coverage', unit: 'percent' },
  healthCoveragePercent: { label: 'Health check execution', group: 'Coverage', unit: 'percent' },
  readinessCoveragePercent: { label: 'Readiness evidence', group: 'Coverage', unit: 'percent' },
  responsivenessCoveragePercent: { label: 'Responsiveness evidence', group: 'Coverage', unit: 'percent' },
  linkVerificationPercent: { label: 'Verified destinations', group: 'Coverage', unit: 'percent' },
  providerSuccessPercent: { label: 'Provider fetch success', group: 'Coverage', unit: 'percent' },
  detailsCoveragePercent: { label: 'Product detail coverage', group: 'Coverage', unit: 'percent' },
  historySourceCoveragePercent: { label: 'History source coverage', group: 'Coverage', unit: 'percent' },
  missingChecks: { label: 'Missing checks', group: 'Coverage', unit: 'count' },
  targetProbeDefects: { label: 'Target probe defects', group: 'Coverage', unit: 'count' },
  unverifiedLinks: { label: 'Unverified destinations', group: 'Coverage', unit: 'count' },
  automatedTaskSuccessPercent: { label: 'Automated task success', group: 'Task outcomes', unit: 'percent' },
  automatedTaskFailurePercent: { label: 'Automated task failures', group: 'Task outcomes', unit: 'percent' },
  actionP50Ms: { label: 'Action time p50', group: 'Task outcomes', unit: 'ms' },
  actionP95Ms: { label: 'Action time p95', group: 'Task outcomes', unit: 'ms' },
  backP95Ms: { label: 'Back time p95', group: 'Task outcomes', unit: 'ms' },
  recoveryPercent: { label: 'Navigation recoveries', group: 'Task outcomes', unit: 'percent' },
  runtimeErrors: { label: 'Runtime errors', group: 'Task outcomes', unit: 'count' },
  checkPassPercent: { label: 'Performance checks passed', group: 'Check results', unit: 'percent' },
  healthPassPercent: { label: 'Health checks passed', group: 'Check results', unit: 'percent' },
  dataIntegrityPassPercent: { label: 'Integrity checks passed', group: 'Check results', unit: 'percent' },
  dataCompletenessPassPercent: { label: 'Completeness checks passed', group: 'Check results', unit: 'percent' },
  timingFailures: { label: 'Timing failures', group: 'Check results', unit: 'count' },
  historyProcessingMismatches: { label: 'History processing mismatches', group: 'Check results', unit: 'count' },
  historyProjectionMismatches: { label: 'History projection mismatches', group: 'Check results', unit: 'count' },
  surfaceCoveragePercent: { label: 'Observed surface contracts', group: 'Rendering checks', unit: 'percent' },
  displayModelPassPercent: { label: 'Model-count checks passed', group: 'Rendering checks', unit: 'percent' },
  displayListPassPercent: { label: 'List-presence checks passed', group: 'Rendering checks', unit: 'percent' },
  displayVisiblePassPercent: { label: 'Viewport-count checks passed', group: 'Rendering checks', unit: 'percent' },
  displayLayoutPassPercent: { label: 'Layout-callback checks passed', group: 'Rendering checks', unit: 'percent' },
  displayChartPassPercent: { label: 'Chart-contract checks passed', group: 'Rendering checks', unit: 'percent' },
  displayEmptyPassPercent: { label: 'Empty-state checks passed', group: 'Rendering checks', unit: 'percent' },
  displayLogoPassPercent: { label: 'Logo-load checks passed', group: 'Rendering checks', unit: 'percent' },
} as const satisfies Record<string, { label: UiLabel; group: AuditMetricGroup; unit: 'count' | 'percent' | 'ms' }>;

export type AuditMetric = keyof typeof AUDIT_METRIC_DEFINITIONS;
export const auditMetricMethodVersion = (metric: AuditMetric): 1 | 2 =>
  ['actionP50Ms', 'actionP95Ms', 'displayModelPassPercent', 'displayListPassPercent', 'displayVisiblePassPercent',
    'displayLayoutPassPercent', 'displayEmptyPassPercent', 'displayLogoPassPercent'].includes(metric) ? 2 : 1;
/** Stored rendering aggregates cannot be upgraded by recalculating their ratio. */
export const auditReportMetricMethodVersion = (report: PerformanceAuditReport, metric: AuditMetric): 1 | 2 =>
  AUDIT_METRIC_DEFINITIONS[metric].group === 'Rendering checks' && report.renderingEvidenceVersion !== 2
    ? 1 : auditMetricMethodVersion(metric);
export const AUDIT_METRICS: readonly AuditMetric[] = Object.freeze(Object.keys(AUDIT_METRIC_DEFINITIONS) as AuditMetric[]);
export const LEGACY_AUDIT_METRICS: readonly AuditMetric[] = ['failures', 'coveragePercent', 'durationMs', 'slowestCheckMs', 'maxEventLoopLagMs', 'maxFrameGapMs'];


/** Versioned source-authored calculations. No claim of industry certification. */
export const AUDIT_METRIC_METHODS = {
  failures: ['Count of failed performance and health checks', 'check'],
  coveragePercent: ['Executed performance and health checks / declared total checks × 100; legacy summary definition', 'check'],
  durationMs: ['Measured active audit duration; pauses excluded', 'run'],
  slowestCheckMs: ['Maximum scored check work duration', 'check'],
  maxEventLoopLagMs: ['Maximum of observed per-check JavaScript timer delays', 'check-maximum'],
  maxFrameGapMs: ['Maximum of observed per-check JavaScript animation gaps', 'check-maximum'],
  wallClockMs: ['Elapsed audit wall-clock duration including pauses', 'run'],
  journeyP50Ms: ['Nearest-rank percentile 50 of measured journey forward work', 'journey'],
  journeyP95Ms: ['Nearest-rank percentile 95 of measured journey forward work', 'journey'],
  jsStallPercent: ['Sum of timer delays over 100 ms / sum of measured timer samples × 100', 'callback'],
  slowFramePercent: ['Sum of JavaScript frame gaps over 50 ms / sum of measured frame samples × 100', 'callback'],
  collectionPercent: ['Unique expected stored performance checks / planned performance checks × 100', 'check'],
  journeyCoveragePercent: ['Executed journeys / planned journeys × 100', 'journey'],
  healthCoveragePercent: ['Executed health checks / planned health checks × 100', 'health-check'],
  readinessCoveragePercent: ['Executed journeys with captured readiness / executed journeys × 100', 'journey'],
  responsivenessCoveragePercent: ['Executed journeys with both timing observers / executed journeys × 100', 'journey'],
  linkVerificationPercent: ['Classified destinations / inventoried destinations × 100', 'destination'],
  providerSuccessPercent: ['Successful provider fetches / attempted providers × 100', 'provider'],
  detailsCoveragePercent: ['Matched product details / core products in the same run with validated count consistency × 100', 'product'],
  historySourceCoveragePercent: ['(Checked days − distinct source-gap days) / checked days × 100', 'day'],
  missingChecks: ['Count of missing planned performance and health checks', 'check'],
  targetProbeDefects: ['Count of target probe error and revision-mismatch issues', 'probe-issue'],
  unverifiedLinks: ['Count of inventoried destinations without classified evidence', 'destination'],
  automatedTaskSuccessPercent: ['Actions with completed, ready, gap-free functional success / invoked actions × 100', 'action'],
  automatedTaskFailurePercent: ['Explicit functional or incomplete action failures / invoked actions × 100', 'action'],
  actionP50Ms: ['Nearest-rank percentile 50 of completed semantic-action durations; route navigation excluded', 'action'],
  actionP95Ms: ['Nearest-rank percentile 95 of completed semantic-action durations; route navigation excluded', 'action'],
  backP95Ms: ['Nearest-rank percentile 95 of measured Back durations', 'journey'],
  recoveryPercent: ['Returns requiring replacement or anchor reset / measured returns × 100', 'journey'],
  runtimeErrors: ['Sum of measured runtime errors across executed journeys', 'error'],
  checkPassPercent: ['Passing performance checks / stored performance checks × 100', 'check'],
  healthPassPercent: ['Passing health checks / planned health checks × 100', 'health-check'],
  dataIntegrityPassPercent: ['Passing data-integrity checks / recorded data-integrity checks × 100; complete health collection required', 'health-check'],
  dataCompletenessPassPercent: ['Passing data-completeness checks / recorded data-completeness checks × 100; complete health collection required', 'health-check'],
  timingFailures: ['Count of failures classified as timing-only', 'check'],
  historyProcessingMismatches: ['Recorded processing mismatches; zero requires observed processing comparisons', 'mismatch'],
  historyProjectionMismatches: ['Recorded projection mismatches; zero requires observed chart comparisons', 'mismatch'],
  surfaceCoveragePercent: ['(Planned surfaces − missing surfaces) / planned surfaces × 100; unique contracts required', 'surface'],
  displayModelPassPercent: ['(Checked − failed − warned − unavailable) / (checked + missing) × 100', 'surface'],
  displayListPassPercent: ['(Checked − failed − warned − unavailable) / (checked + missing) × 100', 'surface'],
  displayVisiblePassPercent: ['(Checked − failed − warned − unavailable) / (checked + missing) × 100', 'surface'],
  displayLayoutPassPercent: ['(Checked − failed − warned − unavailable) / (checked + missing) × 100', 'surface'],
  displayChartPassPercent: ['(Checked − failed − warned − unavailable) / (checked + missing) × 100', 'surface'],
  displayEmptyPassPercent: ['(Checked − failed − warned − unavailable) / (checked + missing) × 100', 'surface'],
  displayLogoPassPercent: ['(Checked − failed − warned − unavailable) / (checked + missing) × 100', 'surface'],
} as const satisfies Record<AuditMetric, readonly [string, string]>;
