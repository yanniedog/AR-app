import type { AuditCheck, PerformanceAuditReport } from './performanceAudit';
import { toPublicAppHealthReport } from './appHealth';
import { PERFORMANCE_AUDIT_SETUP_CHECK_IDS } from './performanceAuditSetup';

const METRIC_ALLOWLIST = new Set([
  'setupStage', 'stepLimitMs', 'stepLimitExceeded', 'nonTimingFailure',
  'publicCatalogueCacheMiss', 'catalogueAdmissionRejected',
  'datasetChanged', 'publicCatalogueChanged', 'datasetRefreshStarted', 'datasetManifestChanged', 'datasetRevisionChanged',
  'expectedCataloguePresent', 'actualCataloguePresent', 'expectedCatalogueReady', 'actualCatalogueReady',
  'expectedCatalogueUnavailable', 'actualCatalogueUnavailable', 'expectedCatalogueAllLoaded', 'actualCatalogueAllLoaded',
  'expectedCatalogueProducts', 'actualCatalogueProducts', 'catalogueGenerationChanged',
  'completedBeforeFailure', 'plannedChecks', 'recoveryRequired', 'rollbackRestored',
  'durationMs',
  'forwardMs',
  'preActionWaitMs',
  'preActionQuietWindowReused',
  'preActionQuietWindowAvoidedMs',
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
  'handlerAttempted',
  'httpAttempted',
  'uniqueDestinations',
  'lenderDetailsLoaded',
  'observedDestinations',
]);

const FIXED_CHECK_IDS = new Set([
  ...PERFORMANCE_AUDIT_SETUP_CHECK_IDS,
  'runtime-responsiveness',
  'maximum-coverage-profile',
  'async-storage',
  'file-system',
  'active-data',
  'manifest-network',
  'debug-log-io',
  'update-readiness',
  'audit-state-restoration',
  'external-link-inventory',
]);
const JOURNEY_IDS = [
  'rates', 'rates-mortgage', 'rates-savings', 'rates-td', 'market', 'bank-rates',
  'home', 'response', 'outlook', 'rba', 'rba-redirect', 'watchlist', 'settings', 'search',
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
  'aggregate data-quality, asset, display and network-policy findings',
  'fixed check IDs, status, enumerated failure codes, measured duration and allowlisted numeric/boolean metrics',
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
// These are directly observed snapshot/progress counts, not timing samples.
const OBSERVED_COUNT_KEYS = new Set([
  'expectedCatalogueProducts', 'actualCatalogueProducts', 'completedBeforeFailure', 'plannedChecks',
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
      const zeroProven = OBSERVED_COUNT_KEYS.has(key) || metrics.executionAttempted === true || metrics.measurementAvailable === true;
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
  if (/^external-link-[1-9][0-9]{0,5}$/.test(value)) return value;
  if (/^section-model-(?:mortgage|savings|td)$/.test(value)) return value;
  if (new RegExp(`^journey-(?:${JOURNEY_IDS})-(?:cold|warm)$`).test(value)) return value;
  if (/^deep-(?:first-pass|repeat)\.[a-z0-9.-]{1,80}$/.test(value)) return value;
  if (/^fatal-[1-9][0-9]{0,3}$/.test(value)) return value;
  return null;
}

function safePayloadSource(value: string): string {
  return ['remote', 'cache', 'sample'].includes(value) ? value : 'unknown';
}

/** Enumerated outcomes only: raw errors can contain routes and private data. */
function failureCode(check: AuditCheck): string | null {
  if (check.metrics.publicCatalogueCacheMiss === true) return 'public-catalogue-cache-miss';
  if (check.metrics.catalogueAdmissionRejected === true) return 'catalogue-work-in-progress';
  if (check.metrics.publicCatalogueChanged === true) return 'public-catalogue-changed';
  if (check.metrics.datasetRefreshStarted === true) return 'dataset-refresh-started';
  if (check.metrics.datasetManifestChanged === true) return 'dataset-manifest-changed';
  if (check.metrics.datasetChanged === true) return 'dataset-revision-changed';
  // Saved reports from older builds predate structured causes. Recognize only
  // this exact fixed first line; never export any part of the raw error/stack.
  if (check.status === 'fail' && check.error?.split(/\r?\n|\\n/, 1)[0] ===
    'AuditDatasetChangedError: Public pricing catalogue changed during the performance audit') return 'public-catalogue-changed';
  if (check.metrics.stepLimitExceeded === true) return 'step-limit-exceeded';
  if (check.metrics.availabilityFailure === true) return 'unavailable';
  return check.status === 'fail' ? 'check-failed' : null;
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
      failureCode: failureCode(check),
      durationMs: safeDuration(check),
      metrics: allowlistedMetrics(check),
    })),
    appHealth: report.appHealth ? toPublicAppHealthReport(report.appHealth) : null,
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

/** Public pastes carry the allowlisted report only. Keep all checks; reject
 * oversize reports instead of silently uploading a partial diagnostic. */
export function createPublicPerformanceAuditReport(report: PerformanceAuditReport): string {
  const body = JSON.stringify(buildDeidentifiedPerformanceAudit(report));
  if (new TextEncoder().encode(body).length > 2 * 1024 * 1024) {
    throw new Error('The deidentified report exceeds the public upload limit.');
  }
  return body;
}
