import {
  cancelPerformanceAudit,
  getPerformanceAuditState,
  markPerformanceAuditRunning,
  pausePerformanceAudit,
  PerformanceAuditInactivityWatchdog,
  requestPerformanceAudit,
  resetPerformanceAuditForTests,
  resumePerformanceAudit,
} from '../src/lib/performanceAudit';
import { awaitPerformanceAuditWork } from '../src/lib/performanceAuditWork';

beforeEach(() => {
  jest.useFakeTimers();
  resetPerformanceAuditForTests();
  requestPerformanceAudit();
  markPerformanceAuditRunning(10);
});
afterEach(() => { jest.useRealTimers(); });

function controls() {
  const watchdog = new PerformanceAuditInactivityWatchdog();
  // Restoration checkpoints still have their own ten-second budget after the
  // global stored-check inactivity guard has entered finalization.
  watchdog.beginFinalization();
  return {
    watchdog,
    label: 'Completed check log persistence',
    timeoutMs: 10_000,
    assertActive: () => {
      if (getPerformanceAuditState().cancelRequested) throw new Error('cancelled');
      if (watchdog.isExpired()) throw new Error('inactivity');
    },
  };
}

it('returns on actual fast completion without advancing a poll timer', async () => {
  const options = controls();
  let finish!: () => void;
  const physicalWrite = new Promise<void>(resolve => { finish = resolve; });
  const stored = awaitPerformanceAuditWork(() => physicalWrite, options)
    .then(() => options.watchdog.recordStoredCheck());
  expect(options.watchdog.storedCheckCount).toBe(0);
  finish();
  await stored;
  expect(options.watchdog.storedCheckCount).toBe(1);
  expect(jest.getTimerCount()).toBe(0);
  expect(performance.now()).toBe(0);
});

it('fails a blocked finalization write at ten seconds and never counts its late completion', async () => {
  const options = controls();
  let finish!: () => void;
  const physicalWrite = new Promise<void>(resolve => { finish = resolve; });
  const stored = awaitPerformanceAuditWork(() => physicalWrite, options)
    .then(() => options.watchdog.recordStoredCheck());
  const failed = expect(stored).rejects.toThrow('timed out after 10000ms');
  await jest.advanceTimersByTimeAsync(10_000);
  await failed;
  expect(options.watchdog.isExpired()).toBe(false);
  finish();
  await Promise.resolve();
  expect(options.watchdog.storedCheckCount).toBe(0);
  expect(jest.getTimerCount()).toBe(0);
});

it('fails synchronous work beyond ten seconds before a timer gets to run', async () => {
  let now = 0;
  await expect(awaitPerformanceAuditWork(() => {
    now = 10_001;
    return Promise.resolve();
  }, { ...controls(), clock: () => now })).rejects.toThrow('10-second step limit');
  expect(jest.getTimerCount()).toBe(0);
});

it('excludes an offscreen pause while retaining the foreground deadline', async () => {
  let finish!: () => void;
  const pending = awaitPerformanceAuditWork(new Promise<void>(resolve => { finish = resolve; }), controls());
  await jest.advanceTimersByTimeAsync(4_000);
  pausePerformanceAudit();
  await jest.advanceTimersByTimeAsync(60_000);
  resumePerformanceAudit();
  await jest.advanceTimersByTimeAsync(5_999);
  finish();
  await pending;
  expect(jest.getTimerCount()).toBe(0);
});

it('keeps cancellation responsive while a physical write remains pending', async () => {
  const pending = awaitPerformanceAuditWork(new Promise<void>(() => {}), controls());
  const cancelled = expect(pending).rejects.toThrow('cancelled');
  cancelPerformanceAudit();
  await jest.advanceTimersByTimeAsync(50);
  await cancelled;
  expect(jest.getTimerCount()).toBe(0);
});
