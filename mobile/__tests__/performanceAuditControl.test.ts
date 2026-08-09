import {
  PerformanceAuditInactivityWatchdog,
} from '../src/lib/performanceAudit';
import {
  assertPerformanceAuditSessionActive,
  awaitPerformanceAuditWork,
  awaitPerformanceAuditWorkWithTimeout,
  PerformanceAuditCancelledError,
  PerformanceAuditInactivityError,
} from '../src/lib/performanceAuditControl';

describe('performance audit async control', () => {
  it('suspends inactivity expiry during finalization but still honours cancellation', () => {
    let elapsedMs = 0;
    const watchdog = new PerformanceAuditInactivityWatchdog(30_000, () => elapsedMs);
    elapsedMs = 30_001;
    expect(() => assertPerformanceAuditSessionActive(watchdog, false))
      .toThrow(PerformanceAuditInactivityError);

    watchdog.beginFinalization();
    elapsedMs = 600_000;
    expect(() => assertPerformanceAuditSessionActive(watchdog, false)).not.toThrow();
    expect(() => assertPerformanceAuditSessionActive(watchdog, true))
      .toThrow(PerformanceAuditCancelledError);
  });

  it('cancels a pending operation promptly and clears its polling timer', async () => {
    jest.useFakeTimers();
    const watchdog = new PerformanceAuditInactivityWatchdog(300_000, () => 0);
    let cancelled = false;
    const pending = awaitPerformanceAuditWork(
      new Promise<never>(() => {}),
      watchdog,
      () => cancelled,
      'Pending work',
    );
    cancelled = true;
    const rejected = expect(pending).rejects.toThrow(PerformanceAuditCancelledError);
    await jest.advanceTimersByTimeAsync(51);
    await rejected;
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });

  it('bounds finalization work independently of the suspended inactivity watchdog', async () => {
    jest.useFakeTimers();
    const watchdog = new PerformanceAuditInactivityWatchdog(30_000, () => 60_000);
    watchdog.beginFinalization();
    const pending = awaitPerformanceAuditWorkWithTimeout(
      new Promise<never>(() => {}),
      watchdog,
      () => false,
      'Final upload',
      1_000,
    );
    const rejected = expect(pending).rejects.toThrow('Final upload timed out after 1000ms');
    await jest.advanceTimersByTimeAsync(1_001);
    await rejected;
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });
});
