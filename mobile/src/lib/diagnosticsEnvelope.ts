import type { AuditCheck, PerformanceAuditReport } from './performanceAudit';
import { toPublicAppHealthReport } from './appHealth';
import { PERFORMANCE_AUDIT_SETUP_CHECK_IDS } from './performanceAuditSetup';
import { encodeCompressedDiagnosticJson, MAX_COMPRESSED_DIAGNOSTIC_BYTES } from './compactDiagnosticJson';
import { publicAuditDiagnostic, publicAuditError, publicAuditFailureReason, publicHealthFailureReason, stallTimeoutFields } from './performanceAuditDiagnostic';
import { fullAuditDiagnosticLog } from './fullAuditDiagnosticLog';
import { auditApplicationJournal } from './auditApplicationJournal';
import { buildPerformanceAuditCompletion } from './performanceAuditCompletion';
import { measureAuditEvidence } from './auditEvidenceCapacity';

import { PUBLIC_AUDIT_METRIC_FIELDS as METRIC_ALLOWLIST } from './auditDiagnosticFields';

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
  'validated audit start and finish timestamps plus a hashed audit reference',
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

const PUBLIC_METRIC_ENUMS: Record<string, ReadonlySet<string>> = {
  handlerResolution: new Set(['pass', 'fail', 'not-attempted', 'unresolved']),
};

function allowlistedMetrics(check: AuditCheck): Record<string, string | number | boolean | null> {
  const metrics = check.metrics;
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(metrics)) {
    if (!METRIC_ALLOWLIST.has(key)) continue;
    if (typeof value === 'string' && PUBLIC_METRIC_ENUMS[key]?.has(value)) {
      result[key] = value;
      continue;
    }
    const prefix = ['forward', 'background', 'back'].find(candidate => key.startsWith(candidate) && /[A-Z]/.test(key[candidate.length] ?? ''));
    const baseKey = prefix ? key[prefix.length].toLowerCase() + key.slice(prefix.length + 1) : key;
    if (typeof value === 'number' && value === 0) {
      if (baseKey === 'eventLoopSamples' || baseKey === 'frameSamples') {
        result[key] = null;
        continue;
      }
      const zeroProven = OBSERVED_COUNT_KEYS.has(key) || metrics.executionAttempted === true || metrics.measurementAvailable === true;
      const loopSamples = metrics[prefix ? `${prefix}EventLoopSamples` : 'eventLoopSamples'];
      const frameSamples = metrics[prefix ? `${prefix}FrameSamples` : 'frameSamples'];
      const sampleProven = EVENT_LOOP_MEASUREMENT_KEYS.has(baseKey)
        ? typeof loopSamples === 'number' && loopSamples > 0
        : FRAME_MEASUREMENT_KEYS.has(baseKey)
          ? typeof frameSamples === 'number' && frameSamples > 0
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
 * It includes validated audit timestamps, the configured stall timeout, and a deidentified failure reason for each failed check.
 * Secrets, account numbers, tokens and routes stay opaque. The deidentified application journal is included.
 */
export function buildDeidentifiedPerformanceAudit(report: PerformanceAuditReport) {
  measureAuditEvidence(report);
  const completion = buildPerformanceAuditCompletion(report, safeCheckId);
  const stallTimeout = stallTimeoutFields(report.watchdog.hangTimeoutMs);
  const appHealth = report.appHealth && completion.gaps.invalidHealthReports === 0 ? toPublicAppHealthReport(report.appHealth) : null;
  return {
    schemaVersion: 1,
    kind: 'performance-audit',
    completion,
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
    stallTimeout,
    diagnostics: {
      schemaVersion: 1,
      durationMs: report.durationMs,
      wallClockMs: report.wallClockMs ?? null,
      watchdog: { hangTimeoutMs: stallTimeout.stallTimeoutMs, ...stallTimeout, storedCheckCount: report.watchdog.storedCheckCount },
      plannedChecks: report.coverage?.plannedChecks ?? report.checks.length,
      storedChecks: report.checks.length,
      readinessCapturedChecks: report.checks.filter(check => check.diagnostic?.readiness != null).length,
    },
    checks: report.checks.map((check) => ({
      id: safeCheckId(check.id),
      kind: check.kind,
      status: check.status,
      failureCode: failureCode(check),
      durationMs: safeDuration(check),
      metrics: allowlistedMetrics(check),
      diagnostic: publicAuditDiagnostic(check.diagnostic),
      error: publicAuditError(check.error, check.trace),
      ...(check.status === 'fail' ? { failureReason: publicAuditFailureReason(check, report.watchdog.hangTimeoutMs) } : {}),
    })),
    appHealth: appHealth && {
      ...appHealth,
      checks: appHealth.checks.map(check => {
        const failureReason = publicHealthFailureReason(check);
        return failureReason ? { ...check, failureReason } : check;
      }),
    },
    applicationJournal: auditApplicationJournal(report.startedAt, report.finishedAt),
  };
}

function isFrameTuple(value: unknown): value is [string, number, number] {
  return Array.isArray(value) && value.length === 3 && value[0] === 'frame'
    && typeof value[1] === 'number' && typeof value[2] === 'number';
}

/** Drop duplicate line:column frames. Failure reasons and both log sections stay intact. */
export function collapseRepeatedFrames(value: unknown): { value: unknown; removed: number } {
  let removed = 0;
  const visit = (item: unknown, key = ''): unknown => {
    if (Array.isArray(item)) {
      if (key === 'frames' && item.length > 1 && item.every(isFrameTuple)) {
        const seen = new Set<string>();
        const next: [string, number, number][] = [];
        for (const frame of item) {
          const id = `${frame[1]}:${frame[2]}`;
          if (seen.has(id)) { removed += 1; continue; }
          seen.add(id);
          next.push(frame);
        }
        return next;
      }
      return item.map(child => visit(child));
    }
    if (!item || typeof item !== 'object') return item;
    return Object.fromEntries(Object.entries(item).map(([name, child]) => [name, visit(child, name)]));
  };
  return { value: visit(value), removed };
}

function auditUploadBytes(body: string): number {
  return new TextEncoder().encode(body).length;
}

function encodedWithinBudget(value: Record<string, unknown>, header: Record<string, unknown>, maxBytes: number): string | null {
  try {
    const body = encodeCompressedDiagnosticJson(value, header);
    return auditUploadBytes(body) > maxBytes ? null : body;
  } catch (error) {
    if (error instanceof Error && /exceeds the (?:decoded audit budget|public upload limit)/.test(error.message)) return null;
    throw error;
  }
}

/** Gzip the hosted report. If the compressed body exceeds the budget, drop only repeated frames. */
export function encodeHostedPerformanceAudit(
  value: Record<string, unknown>,
  header: Record<string, unknown>,
  maxCompressedBytes = MAX_COMPRESSED_DIAGNOSTIC_BYTES,
): string {
  const encoded = encodedWithinBudget(value, header, maxCompressedBytes);
  if (encoded) return encoded;
  const collapsed = collapseRepeatedFrames(value);
  if (collapsed.removed === 0 || !collapsed.value || typeof collapsed.value !== 'object' || Array.isArray(collapsed.value)) {
    throw new Error('The deidentified report exceeds the public upload limit.');
  }
  const trimmed = {
    ...(collapsed.value as Record<string, unknown>),
    truncation: {
      repeatedFramesRemoved: collapsed.removed,
      preserved: ['failureReason', 'applicationJournal.beforeAudit', 'applicationJournal.duringAndAfterAudit'],
    },
  };
  const retry = encodedWithinBudget(trimmed, header, maxCompressedBytes);
  if (!retry) throw new Error('The deidentified report exceeds the public upload limit.');
  return retry;
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
  const publicReport = buildDeidentifiedPerformanceAudit(report);
  const completion = publicReport.completion;
  const stallTimeout = stallTimeoutFields(report.watchdog.hangTimeoutMs);
  // Keep the run identity and result readable at the top of the hosted file.
  // Gzip retains every field. Compression runs before the paste host sees the body.
  return encodeHostedPerformanceAudit({
    ...publicReport,
    completion: {
      ...completion,
      privacyBoundary: { ...completion.privacyBoundary, generalApplicationJournal: 'included-deidentified' as const },
    },
    applicationJournal: auditApplicationJournal(report.startedAt, report.finishedAt),
    diagnosticLog: fullAuditDiagnosticLog(report, safeCheckId),
  }, { audit: { auditId: completion.auditId, appVersion: report.app.appVersion, buildVersion: report.app.buildVersion,
    finishedAt: completion.finishedAt,
    outcome: completion.outcome, collectionComplete: completion.collectionComplete,
    coverageComplete: completion.coverageComplete, detailsComplete: completion.detailsComplete,
    performanceCheckCount: completion.performanceCheckCount, healthCheckCount: completion.healthCheckCount,
    failureCount: completion.failurePositions.length,
    timingFailureCount: completion.failurePositions.filter(failure => failure.category === 'timing').length,
    stallTimeoutMs: stallTimeout.stallTimeoutMs, stallTimeoutSeconds: stallTimeout.stallTimeoutSeconds } });
}
