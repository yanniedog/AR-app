// The first Rates paint should not compete with heavy persistence on the JS thread.
// A cold launch arms the wait; Rates reports when it has settled; background writes
// that can follow first value ask to wait for it (bounded, so they always happen).
let armed = false;
let reached = false;
const waiters = new Set<() => void>();

/** Called once at launch. Without it, nothing waits (tests, tooling). */
export function expectFirstValue(): void {
  armed = true;
}

export function markFirstValue(): void {
  if (reached) return;
  reached = true;
  for (const wake of [...waiters]) wake();
}

/** True from launch until Rates first settles (or the wait is not armed: false). */
export function isFirstValuePending(): boolean {
  return armed && !reached;
}

export function afterFirstValue(maxWaitMs = 20_000): Promise<void> {
  if (!armed || reached) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      waiters.delete(done);
      resolve();
    };
    const timer = setTimeout(done, maxWaitMs);
    waiters.add(done);
  });
}

export function resetFirstValueForTests(): void {
  armed = false;
  reached = false;
  waiters.clear();
}
