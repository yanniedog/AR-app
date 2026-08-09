import {
  PerformanceAuditInactivityWatchdog,
} from './performanceAudit';

export class PerformanceAuditCancelledError extends Error {
  constructor() {
    super('Performance audit cancelled');
    this.name = 'PerformanceAuditCancelledError';
  }
}

export class PerformanceAuditInactivityError extends Error {
  constructor(watchdog: PerformanceAuditInactivityWatchdog) {
    super(
      `Performance audit stored no completed check for ${watchdog.hangTimeoutMs}ms ` +
        `(stored checks: ${watchdog.storedCheckCount})`,
    );
    this.name = 'PerformanceAuditInactivityError';
  }
}

/** Cancel wins; hang watchdog is fully suspended during finalization teardown. */
export function assertPerformanceAuditSessionActive(
  watchdog: PerformanceAuditInactivityWatchdog,
  cancelRequested: boolean,
): void {
  if (cancelRequested) throw new PerformanceAuditCancelledError();
  if (watchdog.isFinalizing) return;
  if (watchdog.isExpired()) throw new PerformanceAuditInactivityError(watchdog);
}

export function formatPerformanceAuditControlError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }
  return String(error);
}

function rethrowPerformanceAuditControl(error: unknown, cancelRequested: boolean): void {
  if (error instanceof PerformanceAuditCancelledError || cancelRequested) {
    throw error instanceof PerformanceAuditCancelledError
      ? error
      : new PerformanceAuditCancelledError();
  }
  if (error instanceof PerformanceAuditInactivityError) throw error;
}

export async function awaitPerformanceAuditWork<T>(
  promise: Promise<T>,
  watchdog: PerformanceAuditInactivityWatchdog,
  cancelRequested: () => boolean,
  label: string,
): Promise<T> {
  assertPerformanceAuditSessionActive(watchdog, cancelRequested());
  let timer: ReturnType<typeof setInterval> | null = null;
  const control = new Promise<never>((_resolve, reject) => {
    timer = setInterval(() => {
      try {
        assertPerformanceAuditSessionActive(watchdog, cancelRequested());
      } catch (error) {
        if (timer) clearInterval(timer);
        timer = null;
        reject(error);
      }
    }, 50);
  });
  try {
    return await Promise.race([promise, control]);
  } catch (error) {
    rethrowPerformanceAuditControl(error, cancelRequested());
    throw new Error(`${label} failed: ${formatPerformanceAuditControlError(error)}`);
  } finally {
    if (timer) clearInterval(timer);
  }
}

export async function awaitPerformanceAuditWorkWithTimeout<T>(
  promise: Promise<T>,
  watchdog: PerformanceAuditInactivityWatchdog,
  cancelRequested: () => boolean,
  label: string,
  timeoutMs: number,
): Promise<T> {
  assertPerformanceAuditSessionActive(watchdog, cancelRequested());
  let timer: ReturnType<typeof setInterval> | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const control = new Promise<never>((_resolve, reject) => {
    timer = setInterval(() => {
      try {
        assertPerformanceAuditSessionActive(watchdog, cancelRequested());
      } catch (error) {
        if (timer) clearInterval(timer);
        timer = null;
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = null;
        reject(error);
      }
    }, 50);
    timeoutId = setTimeout(() => {
      if (timer) clearInterval(timer);
      timer = null;
      timeoutId = null;
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, control]);
  } catch (error) {
    rethrowPerformanceAuditControl(error, cancelRequested());
    if (error instanceof Error && error.message.includes('timed out after')) throw error;
    throw new Error(`${label} failed: ${formatPerformanceAuditControlError(error)}`);
  } finally {
    if (timer) clearInterval(timer);
    if (timeoutId) clearTimeout(timeoutId);
  }
}
