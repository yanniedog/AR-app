import type { PerformanceAuditReport } from './performanceAudit';
import { buildPerformanceAuditCompletion } from './performanceAuditCompletion';

export const AUDIT_HISTORY_LIMIT = 120;
export const AUDIT_METRICS = ['failures', 'coveragePercent', 'durationMs', 'slowestCheckMs', 'maxEventLoopLagMs', 'maxFrameGapMs'] as const;
export type AuditMetric = typeof AUDIT_METRICS[number];
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

const measured = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

/** Store only measured aggregate facts; never reconstruct historical runs. */
export function auditMetricRun(report: PerformanceAuditReport): AuditMetricRun {
  const completion = buildPerformanceAuditCompletion(report);
  return {
    sessionId: report.sessionId, finishedAt: report.finishedAt,
    appVersion: report.app.appVersion, buildVersion: report.app.buildVersion,
    mode: report.appHealth?.mode === 'local' || report.appHealth?.mode === 'live-source' ? report.appHealth.mode : 'unknown',
    outcome: completion.outcome, collectionComplete: completion.collectionComplete,
    coverageComplete: completion.coverageComplete, executed: report.summary.executed,
    metrics: {
      failures: completion.failurePositions.length,
      coveragePercent: measured(report.summary.coveragePercent), durationMs: measured(report.durationMs),
      slowestCheckMs: measured(report.summary.slowestCheckMs),
      maxEventLoopLagMs: measured(report.summary.maxEventLoopLagMs), maxFrameGapMs: measured(report.summary.maxFrameGapMs),
    },
  };
}

export function mergeAuditMetricRuns(runs: AuditMetricRun[], additions: AuditMetricRun[]): AuditMetricRun[] {
  const byId = new Map(runs.map(run => [run.sessionId, run]));
  additions.forEach(run => byId.set(run.sessionId, run));
  return [...byId.values()].sort((a, b) => Date.parse(a.finishedAt) - Date.parse(b.finishedAt)
    || a.sessionId.localeCompare(b.sessionId)).slice(-AUDIT_HISTORY_LIMIT);
}

export function parseAuditMetricHistory(text: string): AuditMetricRun[] {
  const value = JSON.parse(text);
  const valid = value?.schemaVersion === 1 && Array.isArray(value.runs) && value.runs.length <= AUDIT_HISTORY_LIMIT
    && value.runs.every((run: AuditMetricRun) => run && typeof run === 'object'
      && ['sessionId', 'appVersion', 'buildVersion'].every(key => typeof run[key as keyof AuditMetricRun] === 'string')
      && run.sessionId && typeof run.finishedAt === 'string' && Number.isFinite(Date.parse(run.finishedAt))
      && ['local', 'live-source', 'unknown'].includes(run.mode)
      && ['successful', 'failed', 'incomplete', 'warning'].includes(run.outcome)
      && typeof run.collectionComplete === 'boolean' && typeof run.coverageComplete === 'boolean'
      && Number.isSafeInteger(run.executed) && run.executed >= 0 && run.metrics
      && AUDIT_METRICS.every(metric => run.metrics[metric] === null || measured(run.metrics[metric]) !== null)
      && (run.metrics.coveragePercent === null || run.metrics.coveragePercent <= 100));
  if (!valid) throw new Error('Invalid audit metric history');
  return mergeAuditMetricRuns([], value.runs);
}

/** Time-scaled coordinates. Missing measurements break lines; zero stays zero. */
export function auditMetricPlot(runs: AuditMetricRun[], metric: AuditMetric) {
  const start = runs.length ? Date.parse(runs[0].finishedAt) : 0;
  const end = runs.length ? Date.parse(runs[runs.length - 1].finishedAt) : start;
  const ceiling = metric === 'coveragePercent' ? 100 : Math.max(1, ...runs.map(run => run.metrics[metric] ?? 0));
  const points = runs.map(run => {
    const value = run.metrics[metric];
    return value === null ? null : {
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
