/** Owns one run's wake lock, including native activations that finish after cancellation. */
export function createPerformanceAuditWakeLock(
  activate: () => Promise<void>,
  deactivate: () => Promise<void>,
) {
  let released = false;
  let pending: Promise<void> | null = null;

  return {
    acquire(): Promise<void> {
      if (released) return Promise.resolve();
      if (pending) return pending;
      pending = Promise.resolve().then(activate).then(async () => {
        // Cancellation/timeout can finish teardown before the native call returns.
        if (released) await deactivate();
      }).finally(() => { pending = null; });
      return pending;
    },
    release(): Promise<void> {
      released = true;
      return deactivate();
    },
  };
}
