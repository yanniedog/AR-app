import { ForegroundElapsed, subscribePerformanceAudit } from './performanceAudit';
import { PerformanceAuditStepTimeoutError } from './performanceAuditTiming';

/** Resolve on actual work completion, without imposing a control-poll delay. */
export async function awaitPerformanceAuditWork<T>(
  work: Promise<T> | (() => Promise<T>),
  options: { assertActive: () => void; label: string; timeoutMs: number; clock?: () => number },
): Promise<T> {
  options.assertActive();
  let timer: ReturnType<typeof setInterval> | null = null;
  // Close foreground spans on state changes as well as control polls. A JS
  // thread suspended offscreen must not charge that pause after it resumes.
  const elapsed = new ForegroundElapsed(options.clock);
  const unsubscribe = subscribePerformanceAudit(() => elapsed.accrue());
  const control = new Promise<never>((_resolve, reject) => {
    timer = setInterval(() => {
      elapsed.accrue();
      try {
        options.assertActive();
        if (elapsed.foregroundMs >= options.timeoutMs) {
          throw new Error(`${options.label} timed out after ${options.timeoutMs}ms`);
        }
      } catch (error) {
        if (timer) clearInterval(timer);
        timer = null;
        reject(error);
      }
    }, 50);
  });
  try {
    // Include synchronous work before the first await in the same deadline.
    const promise = typeof work === 'function' ? work() : work;
    const result = await Promise.race([promise, control]);
    elapsed.accrue();
    options.assertActive();
    // A blocked JS thread can settle before its timeout callback gets to run.
    if (elapsed.foregroundMs > options.timeoutMs) {
      throw new PerformanceAuditStepTimeoutError(options.label, elapsed.foregroundMs);
    }
    return result;
  } finally {
    if (timer) clearInterval(timer);
    unsubscribe();
  }
}
