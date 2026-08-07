import type { AuditCheck, PerformanceAuditReport } from './performanceAudit';

const METRIC_ALLOWLIST = new Set([
  'durationMs',
  'forwardMs',
  'backgroundSettleMs',
  'backMs',
  'returnFallbackMs',
  'runtimeErrors',
  'incidentalRuntimeErrors',
  'eventLoopSamples',
  'eventLoopP95Ms',
  'maxEventLoopLagMs',
  'stallsOver100Ms',
  'frameSamples',
  'frameP95Ms',
  'maxFrameGapMs',
  'framesOver50Ms',
  'payloadBytes',
  'iterations',
  'maxWriteMs',
  'maxReadMs',
  'averageWriteMs',
  'averageReadMs',
  'temporaryKeyDeleted',
  'writeMs',
  'readMs',
  'temporaryFileDeleted',
  'payloadChars',
  'rateRows',
  'stringifyMs',
  'parseMs',
  'traversalMs',
  'statusCode',
  'responseChars',
  'headersMs',
  'bodyMs',
  'timeoutMs',
]);

function coarseOsVersion(value: string | number | null): string {
  if (value == null) return 'unknown';
  return String(value).split('.')[0] || 'unknown';
}

function allowlistedMetrics(metrics: AuditCheck['metrics']): Record<string, string | number | boolean | null> {
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(metrics)) {
    if (!METRIC_ALLOWLIST.has(key)) continue;
    if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Build the only performance-audit shape allowed to leave the device.
 * It deliberately excludes timestamps, session IDs, model/manufacturer,
 * viewport, memory, routes, product keys, messages, traces and raw log text.
 */
export function buildDeidentifiedPerformanceAudit(report: PerformanceAuditReport) {
  return {
    schemaVersion: 1,
    kind: 'performance-audit',
    app: {
      version: report.app.appVersion,
      build: report.app.buildVersion,
      platform: report.environment.platform,
      osMajor: coarseOsVersion(report.environment.osVersion),
      jsEngine: report.environment.jsEngine,
    },
    data: {
      source: report.environment.payloadSource,
      runDate: report.environment.payloadRunDate,
      products: report.environment.payloadProducts,
      providers: report.environment.payloadProviders,
      detailsLoaded: report.environment.detailsLoaded,
      historyLoaded: report.environment.historyLoaded,
      productHistoryLoaded: report.environment.productHistoryLoaded,
      networkType: report.environment.networkType,
    },
    summary: { ...report.summary },
    checks: report.checks.map((check) => ({
      id: check.id,
      kind: check.kind,
      status: check.status,
      durationMs: check.durationMs,
      metrics: allowlistedMetrics(check.metrics),
    })),
  };
}

export function performanceAuditFingerprint(report: PerformanceAuditReport): string {
  return [
    report.summary.overall,
    report.summary.slowestCheckId ?? 'none',
    `f${report.summary.fail}`,
    `w${report.summary.warn}`,
  ].join('-');
}
