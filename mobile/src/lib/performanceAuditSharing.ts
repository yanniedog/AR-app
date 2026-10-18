import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import { failPublicReportPreparation, restorePublicReportUpload, startDebugLogUpload } from './debugLogSharing';
import { createPublicPerformanceAuditReport } from './diagnosticsEnvelope';
import type { PerformanceAuditReport } from './performanceAudit';

export function performanceAuditUploadRequest(report: PerformanceAuditReport) {
  const body = createPublicPerformanceAuditReport(report);
  return { sessionId: report.sessionId, appVersion: report.app.appVersion, buildVersion: report.app.buildVersion,
    publicReport: { body, contentSha256: bytesToHex(sha256(utf8ToBytes(body))) } };
}

export async function uploadCompletedPerformanceAudit(report: PerformanceAuditReport) {
  try { return await startDebugLogUpload(performanceAuditUploadRequest(report)); }
  catch { failPublicReportPreparation(report.sessionId); }
}

export async function restorePerformanceAuditUpload(report: PerformanceAuditReport): Promise<void> {
  await restorePublicReportUpload(performanceAuditUploadRequest(report));
}

/** The request's publication policy applies equally to full and partial reports.
 * A local run must never enter sharing's queued, blocked or retry state. */
export function startPerformanceAuditLogUpload(
  uploadLog: boolean,
  request: { sessionId: string; appVersion: string; buildVersion: string;
    audit: { summaryMarker: string; report: PerformanceAuditReport } },
): ReturnType<typeof uploadCompletedPerformanceAudit> | undefined {
  if (!uploadLog) return;
  return uploadCompletedPerformanceAudit(request.audit.report);
}
