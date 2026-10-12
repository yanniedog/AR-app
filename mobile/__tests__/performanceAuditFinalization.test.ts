import {
  failPerformanceAudit,
  getPerformanceAuditState,
  isPerformanceAuditActive,
  markPerformanceAuditRunning,
  pausePerformanceAudit,
  requestPerformanceAudit,
  resetPerformanceAuditForTests,
  resumePerformanceAudit,
  updatePerformanceAuditEstimate,
  type PerformanceAuditReport,
} from '../src/lib/performanceAudit';
import { publishPerformanceAuditAfterFinalization } from '../src/lib/performanceAuditFinalization';
import { estimatePerformanceAuditTime, PerformanceAuditStepTimeoutError } from '../src/lib/performanceAuditTiming';

// Publication only stores this already-built report; its checks were evaluated
// before finalization begins in the runner.
const report = { summary: { overall: 'healthy' } } as PerformanceAuditReport;

beforeEach(() => {
  resetPerformanceAuditForTests();
  requestPerformanceAudit();
  markPerformanceAuditRunning(20);
});

it('keeps ETA and pause tracking active until local finalization succeeds, then releases transport before publishing', async () => {
  let flush!: () => void;
  let foreground!: () => void;
  const flushed = new Promise<void>(resolve => { flush = resolve; });
  const foregroundReady = new Promise<void>(resolve => { foreground = resolve; });
  const releaseTransport = jest.fn(() => {
    expect(getPerformanceAuditState().status).toBe('running');
  });
  const finished = publishPerformanceAuditAfterFinalization(report, async () => {
    await flushed;
    await foregroundReady;
  }, releaseTransport);

  expect(getPerformanceAuditState()).toMatchObject({
    status: 'running', report: null, progress: { label: 'Flushing the final audit log' },
  });
  const estimate = estimatePerformanceAuditTime({ total: 20, completed: 20, elapsedMs: 100_000, finalizing: true });
  updatePerformanceAuditEstimate(estimate);
  expect(getPerformanceAuditState().estimate).toBe(estimate);
  pausePerformanceAudit();
  expect(getPerformanceAuditState().paused).toBe(true);
  flush();
  await Promise.resolve();
  expect(releaseTransport).not.toHaveBeenCalled();
  expect(isPerformanceAuditActive()).toBe(true);
  resumePerformanceAudit();
  foreground();
  await finished;
  expect(releaseTransport).toHaveBeenCalledTimes(1);
  expect(getPerformanceAuditState()).toMatchObject({ status: 'complete', report, paused: false });
});

it('propagates a final flush timeout to fatal handling without ever publishing the healthy report', async () => {
  jest.useFakeTimers();
  try {
    const releaseTransport = jest.fn();
    const timeout = new PerformanceAuditStepTimeoutError('Final audit log flush', 10_001);
    const localWork = () => new Promise<void>((_resolve, reject) => {
      setTimeout(() => reject(timeout), 10_001);
    });
    let failure: unknown;
    const finished = publishPerformanceAuditAfterFinalization(report, localWork, releaseTransport).catch(error => {
      failure = error;
      // The runner's existing fatal path writes its partial report, then fails.
      failPerformanceAudit(error.message);
    });
    await jest.advanceTimersByTimeAsync(10_000);
    expect(getPerformanceAuditState()).toMatchObject({ status: 'running', report: null });
    await jest.advanceTimersByTimeAsync(1);
    await finished;
    expect(failure).toBe(timeout);
    expect(releaseTransport).not.toHaveBeenCalled();
    expect(getPerformanceAuditState()).toMatchObject({ status: 'failed', report: null, error: timeout.message });
  } finally {
    jest.useRealTimers();
  }
});

it('does not publish when the final local write fails immediately', async () => {
  const releaseTransport = jest.fn();
  const failure = new Error('Final audit log write failed');
  await expect(publishPerformanceAuditAfterFinalization(report,
    async () => { throw failure; }, releaseTransport)).rejects.toBe(failure);
  expect(getPerformanceAuditState()).toMatchObject({ status: 'running', report: null });
  expect(releaseTransport).not.toHaveBeenCalled();
});
