import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import type { PerformanceAuditReport } from './performanceAudit';
import { auditOutcome } from './auditPresentation';
import { APP_HEALTH_CHECK_CODES } from './appHealth';
import { publicAuditDiagnostic } from './performanceAuditDiagnostic';

/** Only machine-authored ISO instants are public; arbitrary saved text is not. */
export function publicAuditTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  const canonical = new Date(time).toISOString();
  return canonical.slice(0, 10) === value.slice(0, 10) ? canonical : null;
}

/** A reference to the audit, never a device/user identifier or the raw session. */
export function performanceAuditReference(sessionId: string): string {
  return `audit-${bytesToHex(sha256(utf8ToBytes(sessionId))).slice(0, 16)}`;
}

/** Completion and evidence retention are separate from whether checks passed. */
export function buildPerformanceAuditCompletion(report: PerformanceAuditReport,
  safeCheckId: (id: string) => string | null = id => id) {
  const health = report.appHealth;
  const coverage = report.coverage;
  const healthChecks = health?.checks ?? [];
  let truncatedEvidenceFields = 0;
  let omittedEvidenceChars = 0;
  // Older builds bounded evidence before storage. Preserve that loss explicitly
  // even though the actual private text will become an opaque public alias.
  const countTruncation = (value: unknown): void => {
    if (typeof value === 'string') {
      const markers = [...value.matchAll(/…\[truncated (\d+) chars\]/g)];
      if (markers.length) truncatedEvidenceFields++;
      for (const marker of markers) omittedEvidenceChars += Number(marker[1]);
    } else if (Array.isArray(value)) value.forEach(countTruncation);
    else if (value && typeof value === 'object') Object.values(value).forEach(countTruncation);
  };
  report.checks.forEach(countTruncation);
  const actualIds = new Set(report.checks.map(check => check.id));
  const healthActualIds = new Set(healthChecks.map(check => check.id));
  const missingPerformanceIds = [...new Set([...(coverage?.missingPlannedCheckIds ?? []),
    ...(report.plan?.passes.flatMap(pass => pass.steps.map(step => `deep-${step.id}`)) ?? []).filter(id => !actualIds.has(id))])];
  const unverifiedLink = (check: PerformanceAuditReport['checks'][number]) => /^external-link-[0-9]+$/.test(check.id)
    && (check.metrics.httpAttempted !== true || check.metrics.httpReachability === 'unknown' || check.metrics.browserHandler === 'unknown');
  const structuredReadiness = (check: PerformanceAuditReport['checks'][number]) => {
    const readiness = check.diagnostic?.readiness;
    return readiness != null && typeof readiness.ready === 'boolean' && typeof readiness.capturing === 'boolean'
      && Array.isArray(readiness.blockers) && Array.isArray(readiness.surfaces)
      && readiness.surfaces.every(surface => surface != null && Array.isArray(surface.probes));
  };
  const gaps = {
    missingChecks: Math.max(missingPerformanceIds.length, (coverage?.plannedChecks ?? 0) - actualIds.size)
      + Math.max(health?.coverage.missingPlannedCheckIds.length ?? 0, (health?.coverage.plannedChecks ?? 0) - healthActualIds.size),
    duplicateChecks: Math.max(coverage?.duplicateStoredCheckIds.length ?? 0, report.checks.length - actualIds.size)
      + Math.max(health?.coverage.duplicateStoredCheckIds.length ?? 0, healthChecks.length - healthActualIds.size),
    unexpectedChecks: (coverage?.unexpectedStoredCheckIds.length ?? 0) + (health?.coverage.unexpectedStoredCheckIds.length ?? 0),
    skippedChecks: report.checks.filter(check => check.status === 'skipped').length,
    unavailableChecks: report.checks.filter(check => check.metrics.availabilityFailure === true || check.metrics.executionAttempted === false).length
      + healthChecks.filter(check => check.status === 'unavailable').length,
    notRunChecks: healthChecks.filter(check => check.status === 'not-run').length,
    pendingProbes: report.checks.reduce((count, check) => {
      const surfaces = check.diagnostic?.readiness?.surfaces;
      return count + (Array.isArray(surfaces) ? surfaces.reduce((sum, surface) => sum
        + (Array.isArray(surface?.probes) ? surface.probes.filter(probe => probe?.required && probe.status === 'pending').length : 0), 0) : 0);
    }, 0),
    missingReadinessChecks: report.checks.filter(check => check.kind === 'journey' && check.metrics.executionAttempted !== false
      && check.metrics.availabilityFailure !== true && check.status !== 'skipped' && !structuredReadiness(check)).length,
    unverifiedLinks: report.checks.filter(unverifiedLink).length,
    missingHealthReports: report.schemaVersion >= 7 && !health ? 1 : 0,
    truncatedEvidenceFields, omittedEvidenceChars,
  };
  const collectionComplete = coverage != null && coverage.storedChecks === report.checks.length
    && coverage.plannedChecks === report.checks.length
    && gaps.missingChecks === 0 && gaps.duplicateChecks === 0 && gaps.unexpectedChecks === 0
    && (!health || health.coverage.storedChecks === healthChecks.length && health.coverage.plannedChecks === healthChecks.length);
  const coverageComplete = collectionComplete && coverage.complete && health?.coverage.complete !== false
    && gaps.skippedChecks === 0 && gaps.unavailableChecks === 0 && gaps.notRunChecks === 0 && gaps.pendingProbes === 0
    && gaps.unverifiedLinks === 0 && gaps.missingHealthReports === 0;
  const startedAt = publicAuditTimestamp(report.startedAt);
  const finishedAt = publicAuditTimestamp(report.finishedAt);
  const timestampsValid = startedAt != null && finishedAt != null && startedAt <= finishedAt;
  const detailsComplete = collectionComplete && timestampsValid && truncatedEvidenceFields === 0
    && gaps.missingReadinessChecks === 0 && gaps.missingHealthReports === 0;
  const failurePositions: { source: 'performance' | 'health'; position: number; checkId: string | null;
    stage: string | null; category: 'failure' | 'timing' }[] = [];
  report.checks.forEach((check, index) => {
    if (check.status !== 'fail') return;
    const diagnostic = publicAuditDiagnostic(check.diagnostic) as { stage?: string } | null;
    failurePositions.push({ source: 'performance', position: index + 1, checkId: safeCheckId(check.id),
      stage: diagnostic?.stage ?? null, category: auditOutcome(check) === 'timing' ? 'timing' : 'failure' });
  });
  const healthCodes = new Set<string>(Object.values(APP_HEALTH_CHECK_CODES));
  healthChecks.forEach((check, index) => {
    if (check.status === 'fail') failurePositions.push({ source: 'health', position: index + 1,
      checkId: healthCodes.has(check.code) ? check.code : null, stage: null, category: 'failure' });
  });
  const outcome = failurePositions.length ? 'failed' as const
    : !coverageComplete || !detailsComplete ? 'incomplete' as const
      : report.checks.some(check => check.status === 'warn') || healthChecks.some(check => check.status === 'warn')
        ? 'warning' as const : 'successful' as const;
  const healthId = (id: string) => healthCodes.has(id) ? id : null;
  const missingPlannedChecks = [
    ...missingPerformanceIds.map(id => ({ source: 'performance' as const, checkId: safeCheckId(id) })),
    ...(health?.coverage.missingPlannedCheckIds ?? []).map(id => ({ source: 'health' as const, checkId: healthId(id) })),
  ];
  const gapPositions = [
    ...report.checks.flatMap((check, index) => check.status === 'skipped' || check.metrics.availabilityFailure === true || check.metrics.executionAttempted === false || unverifiedLink(check)
      ? [{ source: 'performance' as const, position: index + 1, checkId: safeCheckId(check.id),
        reason: check.metrics.availabilityFailure === true || check.metrics.executionAttempted === false ? 'unavailable' as const
          : check.status === 'skipped' ? 'skipped' as const : 'unverified-link' as const }] : []),
    ...healthChecks.flatMap((check, index) => check.status === 'unavailable' || check.status === 'not-run'
      ? [{ source: 'health' as const, position: index + 1, checkId: healthId(check.code), reason: check.status }] : []),
  ];
  return { auditId: performanceAuditReference(report.sessionId), startedAt, finishedAt,
    outcome, collectionComplete, coverageComplete, detailsComplete, timestampsValid,
    performanceCheckCount: report.checks.length, healthCheckCount: healthChecks.length,
    gaps, failurePositions, gapPositions, missingPlannedChecks,
    privacyBoundary: { privateValues: 'opaque-aliases', generalApplicationJournal: 'excluded', nativeProfiler: 'not-captured' } as const };
}
