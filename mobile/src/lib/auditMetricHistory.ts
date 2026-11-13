import type { PerformanceAuditReport } from './performanceAudit';
import { buildPerformanceAuditCompletion } from './performanceAuditCompletion';
import { AUDIT_METRICS, AUDIT_METRIC_DEFINITIONS, LEGACY_AUDIT_METRICS, type AuditMetric } from './auditMetricHistoryMetrics';
import { auditMetricValues, measuredAuditValue as measured, measuredAuditCount } from './auditMetricHistoryValues';
export { AUDIT_METRICS, AUDIT_METRIC_DEFINITIONS, AUDIT_METRIC_GROUPS, type AuditMetric, type AuditMetricGroup } from './auditMetricHistoryMetrics';

export const AUDIT_HISTORY_LIMIT = 120;
export const AUDIT_METRIC_HISTORY_VERSION = 2;
export interface AuditMetricRun {
  sessionId: string;
  finishedAt: string;
  appVersion: string;
  buildVersion: string;
  mode: 'local' | 'live-source' | 'unknown';
  outcome: 'successful' | 'failed' | 'incomplete' | 'warning';
  collectionComplete: boolean;
  coverageComplete: boolean;
  executed: number;
  metrics: Record<AuditMetric, number | null>;
}


/** Store only measured aggregate facts; never reconstruct historical runs. */
export function auditMetricRun(report: PerformanceAuditReport): AuditMetricRun {
  const completion = buildPerformanceAuditCompletion(report);
  return {
    sessionId: report.sessionId, finishedAt: report.finishedAt,
    appVersion: report.app.appVersion, buildVersion: report.app.buildVersion,
    mode: report.appHealth?.mode === 'local' || report.appHealth?.mode === 'live-source' ? report.appHealth.mode : 'unknown',
    outcome: completion.outcome, collectionComplete: completion.collectionComplete,
    coverageComplete: completion.coverageComplete, executed: report.summary.executed,
    metrics: auditMetricValues(report, completion),
  };
}

export function mergeAuditMetricRuns(runs: AuditMetricRun[], additions: AuditMetricRun[]): AuditMetricRun[] {
  const byId = new Map(runs.map(run => [run.sessionId, run]));
  additions.forEach(run => byId.set(run.sessionId, run));
  return [...byId.values()].sort((a, b) => Date.parse(a.finishedAt) - Date.parse(b.finishedAt)
    || a.sessionId.localeCompare(b.sessionId)).slice(-AUDIT_HISTORY_LIMIT);
}

function validMetricValue(metric: AuditMetric, value: unknown): boolean {
  const unit = AUDIT_METRIC_DEFINITIONS[metric].unit;
  return unit === 'count' ? measuredAuditCount(value) !== null
    : measured(value) !== null && (unit !== 'percent' || (value as number) <= 100);
}

export function parseAuditMetricHistory(text: string): AuditMetricRun[] {
  const value = JSON.parse(text);
  const valid = [1, AUDIT_METRIC_HISTORY_VERSION].includes(value?.schemaVersion) && Array.isArray(value.runs) && value.runs.length <= AUDIT_HISTORY_LIMIT
    && value.runs.every((run: AuditMetricRun) => run && typeof run === 'object'
      && ['sessionId', 'appVersion', 'buildVersion'].every(key => typeof run[key as keyof AuditMetricRun] === 'string')
      && run.sessionId && typeof run.finishedAt === 'string' && Number.isFinite(Date.parse(run.finishedAt))
      && ['local', 'live-source', 'unknown'].includes(run.mode)
      && ['successful', 'failed', 'incomplete', 'warning'].includes(run.outcome)
      && typeof run.collectionComplete === 'boolean' && typeof run.coverageComplete === 'boolean'
      && Number.isSafeInteger(run.executed) && run.executed >= 0 && run.metrics
      && (value.schemaVersion === 1 ? LEGACY_AUDIT_METRICS : AUDIT_METRICS).every(metric =>
        run.metrics[metric] === null || validMetricValue(metric, run.metrics[metric])));
  if (!valid) throw new Error('Invalid audit metric history');
  return mergeAuditMetricRuns([], value.runs.map((run: AuditMetricRun) => ({ ...run,
    metrics: Object.fromEntries(AUDIT_METRICS.map(metric => [metric,
      value.schemaVersion === 1 && !LEGACY_AUDIT_METRICS.includes(metric) ? null : run.metrics[metric],
    ])) as Record<AuditMetric, number | null>,
  })));
}

/** Time-scaled coordinates. Missing measurements break lines; zero stays zero. */
export function auditMetricPlot(runs: AuditMetricRun[], metric: AuditMetric) {
  const start = runs.length ? Date.parse(runs[0].finishedAt) : 0;
  const end = runs.length ? Date.parse(runs[runs.length - 1].finishedAt) : start;
  const ceiling = AUDIT_METRIC_DEFINITIONS[metric].unit === 'percent' ? 100 : Math.max(1, ...runs.map(run => run.metrics[metric] ?? 0));
  const points = runs.map(run => {
    const value = run.metrics[metric];
    return value == null ? null : {
      x: end === start ? 160 : 12 + (Date.parse(run.finishedAt) - start) / (end - start) * 296,
      y: 128 - value / ceiling * 112, value, sessionId: run.sessionId,
    };
  });
  let path = '';
  let connected = false;
  points.forEach(point => {
    if (!point) { connected = false; return; }
    path += `${connected ? 'L' : 'M'}${point.x},${point.y} `;
    connected = true;
  });
  return { points, path, ceiling };
}
