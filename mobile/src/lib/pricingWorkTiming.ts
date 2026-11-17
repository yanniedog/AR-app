import { yieldToUi } from './yieldToUi';
import type { AuditWorkDiagnostic } from './performanceAuditWorkDiagnostic';

type Stage = 'candidatePreparationMs' | 'pricingResolutionMs' | 'mortgageScopeMs';

/** Stage elapsed time includes host waits; slices measure the uninterrupted
 * elapsed interval between cooperative yields, excluding each host wait. These
 * are runtime observations, not native CPU-thread profiling. */
export function createPricingWorkTiming(now: () => number = () => performance.now(),
  yieldControl: () => Promise<void> = () => yieldToUi(0)) {
  const metrics: Pick<AuditWorkDiagnostic, Stage | 'pricingMaxSliceMs'> = {};
  let sliceStarted = now();
  const finishSlice = () => {
    const elapsed = now() - sliceStarted;
    if (Number.isFinite(elapsed) && elapsed >= 0) metrics.pricingMaxSliceMs = Math.max(metrics.pricingMaxSliceMs ?? 0, elapsed);
  };
  return {
    snapshot: () => ({ ...metrics }),
    async yieldControl() {
      finishSlice();
      await yieldControl();
      sliceStarted = now();
    },
    async measure<T>(stage: Stage, work: () => Promise<T>): Promise<T> {
      const started = now();
      sliceStarted = started;
      try { return await work(); }
      finally { finishSlice(); metrics[stage] = Math.max(0, now() - started); }
    },
  };
}
