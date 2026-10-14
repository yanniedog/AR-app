import { startDebugLogUpload } from './debugLogSharing';

/** The request's publication policy applies equally to full and partial reports.
 * A local run must never enter sharing's queued, blocked or retry state. */
export function startPerformanceAuditLogUpload(
  uploadLog: boolean,
  request: Parameters<typeof startDebugLogUpload>[0],
): void {
  if (!uploadLog) return;
  void startDebugLogUpload(request);
}
