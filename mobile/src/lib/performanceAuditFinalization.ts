import {
  completePerformanceAudit,
  getPerformanceAuditState,
  updatePerformanceAuditProgress,
  type PerformanceAuditReport,
} from './performanceAudit';
import { saveCompletedPerformanceAudit } from './performanceAuditReportStorage';
import { debugLog } from './debugLog';

/** A durable report is not terminal until the remaining local audit work
 * succeeds. Keep ETA, pause and cancellation active until that boundary. */
export async function publishPerformanceAuditAfterFinalization(
  report: PerformanceAuditReport,
  finishLocalWork: () => Promise<void>,
  releaseTransport: () => void,
): Promise<void> {
  const { completed, total } = getPerformanceAuditState().progress;
  updatePerformanceAuditProgress(completed, total, 'Flushing the final audit log');
  // Rejection deliberately reaches the runner's fatal/partial-report path.
  await finishLocalWork();
  // The canonical sidecar is already durable. Preserve a separate completed
  // copy so a later partial run cannot replace it; memory remains reviewable
  // even if this additional recovery copy cannot be written.
  // Terminal publication wakes update surfaces which must see normal transport.
  releaseTransport();
  completePerformanceAudit(report);
  void saveCompletedPerformanceAudit(report).catch(() => {
    debugLog.warn('perf-audit', 'Completed report recovery copy could not be saved.');
  });
}
