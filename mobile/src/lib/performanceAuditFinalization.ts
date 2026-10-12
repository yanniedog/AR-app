import {
  completePerformanceAudit,
  getPerformanceAuditState,
  updatePerformanceAuditProgress,
  type PerformanceAuditReport,
} from './performanceAudit';

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
  // Terminal publication wakes update surfaces which must see normal transport.
  releaseTransport();
  completePerformanceAudit(report);
}
