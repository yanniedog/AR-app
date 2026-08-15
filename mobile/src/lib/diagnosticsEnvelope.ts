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
  'executionAttempted',
  'actionInvoked',
  'actionCompleted',
  'measurementAvailable',
  'eventLoopMeasurementAvailable',
  'frameMeasurementAvailable',
  'availabilityFailure',
  'routeStateInvalidated',
]);

const FIXED_CHECK_IDS = new Set([
  'runtime-responsiveness',
  'maximum-coverage-profile',
  'async-storage',
  'file-system',
  'active-data',
  'manifest-network',
  'debug-log-io',
  'update-readiness',
  'audit-state-restoration',
]);
const JOURNEY_IDS = [
  'home', 'response', 'outlook', 'rba-redirect', 'watchlist', 'settings', 'search',
  'calculator', 'projections', 'lenders', 'profile', 'product', 'rate-receipt',
  'lender', 'compare', 'terms', 'debug-log',
].join('|');

export const DEIDENTIFIED_DIAGNOSTICS_MAX_BYTES = 256 * 1024;
export const DEIDENTIFIED_DIAGNOSTICS_DESTINATION =
  'No host selected; the operating-system share sheet chooses the destination';
export const DEIDENTIFIED_DIAGNOSTICS_FIELD_PREVIEW = [
  'app version, build, platform, OS major version and JavaScript engine',
  'payload source, run date, product/provider counts and optional-asset availability',
  'aggregate outcome/counts and measured responsiveness values',
  'fixed check IDs, status, measured duration and allowlisted numeric/boolean metrics',
] as const;

export interface DeidentifiedDiagnosticsShare {
  body: string;
  byteLength: number;
  destination: typeof DEIDENTIFIED_DIAGNOSTICS_DESTINATION;
  fields: typeof DEIDENTIFIED_DIAGNOSTICS_FIELD_PREVIEW;
}

function coarseOsVersion(value: string | number | null): string {
  if (value == null) return 'unknown';
  return String(value).split('.')[0] || 'unknown';
}

const EVENT_LOOP_MEASUREMENT_KEYS = new Set([
  'eventLoopP95Ms', 'maxEventLoopLagMs', 'stallsOver100Ms',
]);
const FRAME_MEASUREMENT_KEYS = new Set([
  'frameP95Ms', 'maxFrameGapMs', 'framesOver50Ms',
]);

function allowlistedMetrics(check: AuditCheck): Record<string, string | number | boolean | null> {
  const metrics = check.metrics;
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(metrics)) {
    if (!METRIC_ALLOWLIST.has(key)) continue;
    if (typeof value === 'number' && value === 0) {
      if (key === 'eventLoopSamples' || key === 'frameSamples') {
        result[key] = null;
        continue;
      }
      const zeroProven = metrics.executionAttempted === true || metrics.measurementAvailable === true;
      const sampleProven = EVENT_LOOP_MEASUREMENT_KEYS.has(key)
        ? typeof metrics.eventLoopSamples === 'number' && metrics.eventLoopSamples > 0
        : FRAME_MEASUREMENT_KEYS.has(key)
          ? typeof metrics.frameSamples === 'number' && metrics.frameSamples > 0
          : zeroProven;
      if (!sampleProven) {
        result[key] = null;
        continue;
      }
    }
    if (
      value == null ||
      (typeof value === 'number' && Number.isFinite(value)) ||
      typeof value === 'boolean'
    ) {
      result[key] = value;
    }
  }
  return result;
}

function safeCheckId(value: string | null): string | null {
  if (value == null) return null;
  if (FIXED_CHECK_IDS.has(value)) return value;
  if (/^section-model-(?:mortgage|savings|td)$/.test(value)) return value;
  if (new RegExp(`^journey-(?:${JOURNEY_IDS})-(?:cold|warm)$`).test(value)) return value;
  if (/^deep-(?:first-pass|repeat)\.[a-z0-9.-]{1,80}$/.test(value)) return value;
  if (/^fatal-[1-9][0-9]{0,3}$/.test(value)) return value;
  return null;
}

function safePayloadSource(value: string): string {
  return ['network', 'cache', 'sample', 'v3'].includes(value) ? value : 'unknown';
}

function safeDuration(check: AuditCheck): number | null {
  const value = check.durationMs;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  if (value !== 0) return value;
  return check.metrics.executionAttempted === true || check.metrics.measurementAvailable === true
    ? 0
    : null;
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
      source: safePayloadSource(report.environment.payloadSource),
      runDate: report.environment.payloadRunDate,
      products: report.environment.payloadProducts,
      providers: report.environment.payloadProviders,
      detailsLoaded: report.environment.detailsLoaded,
      historyLoaded: report.environment.historyLoaded,
      productHistoryLoaded: report.environment.productHistoryLoaded,
    },
    summary: {
      overall: report.summary.overall,
      pass: report.summary.pass,
      warn: report.summary.warn,
      fail: report.summary.fail,
      skipped: report.summary.skipped,
      unavailable: report.summary.unavailable,
      executed: report.summary.executed,
      justifiedSkipped: report.summary.justifiedSkipped,
      unexpectedSkipped: report.summary.unexpectedSkipped,
      coveragePercent: report.summary.coveragePercent,
      slowestCheckId: safeCheckId(report.summary.slowestCheckId),
      slowestCheckMs: report.summary.slowestCheckMs,
      maxEventLoopLagMs: report.summary.maxEventLoopLagMs,
      maxFrameGapMs: report.summary.maxFrameGapMs,
    },
    checks: report.checks.map((check) => ({
      id: safeCheckId(check.id),
      kind: check.kind,
      status: check.status,
      durationMs: safeDuration(check),
      metrics: allowlistedMetrics(check),
    })),
  };
}

/** Build the complete, bounded text offered to the OS share sheet. */
export function createDeidentifiedDiagnosticsShare(
  report: PerformanceAuditReport,
): DeidentifiedDiagnosticsShare {
  const body = JSON.stringify(buildDeidentifiedPerformanceAudit(report), null, 2);
  const byteLength = new TextEncoder().encode(body).length;
  if (byteLength > DEIDENTIFIED_DIAGNOSTICS_MAX_BYTES) {
    throw new Error(
      `The deidentified report is ${byteLength} bytes, above the ` +
      `${DEIDENTIFIED_DIAGNOSTICS_MAX_BYTES}-byte sharing limit.`,
    );
  }
  return {
    body,
    byteLength,
    destination: DEIDENTIFIED_DIAGNOSTICS_DESTINATION,
    fields: DEIDENTIFIED_DIAGNOSTICS_FIELD_PREVIEW,
  };
}
