import {
  PerformanceAuditStepWatchdog,
  failPerformanceAudit,
  getPerformanceAuditState,
  enforcePerformanceAuditStepLimit,
  pausePerformanceAudit,
  requestPerformanceAudit,
  resetPerformanceAuditForTests,
  resumePerformanceAudit,
  summarizePerformanceAudit,
  type AuditCheck,
} from '../src/lib/performanceAudit';
import {
  estimatePerformanceAuditTime,
  formatPerformanceAuditEstimate,
  PerformanceAuditStepTimeoutError,
  PerformanceAuditMutationBarrier,
  scoreUserVisibleJourney,
  userVisibleForwardMs,
} from '../src/lib/performanceAuditTiming';

const result = (durationMs: number): AuditCheck => ({
  id: 'journey', label: 'Product readiness', kind: 'journey', status: 'pass',
  durationMs, metrics: { executionAttempted: true, actionInvoked: true, actionCompleted: true },
});

beforeEach(resetPerformanceAuditForTests);

it('scores the tap, navigation commit and first ready frame, not background settle', () => {
  expect(userVisibleForwardMs({ navigationCommitMs: 180, firstReadyFrameMs: 420 })).toBe(600);
  expect(scoreUserVisibleJourney({
    actionMs: 444, navigationCommitMs: 180, firstReadyFrameMs: 420, maxEventLoopLagMs: 40, maxFrameGapMs: 20,
  })).toBe('pass');
  expect(scoreUserVisibleJourney({ actionMs: 2_600, navigationCommitMs: 100, firstReadyFrameMs: 100 })).toBe('fail');
  expect(scoreUserVisibleJourney({ navigationCommitMs: 2_000, firstReadyFrameMs: 600, backMs: 100 })).toBe('fail');
  expect(scoreUserVisibleJourney({ navigationCommitMs: 200, firstReadyFrameMs: 200, maxFrameGapMs: 400 })).toBe('fail');
});

it('shares ten seconds across sub-waits, irrespective of progress events', () => {
  let now = 0;
  const budget = new PerformanceAuditStepWatchdog('Product readiness', () => now);
  try {
    now = 6_000;
    budget.touchProgress();
    expect(budget.remainingMs()).toBe(4_000);
    now = 9_500;
    budget.touchProgress();
    expect(budget.remainingMs()).toBe(500);
    now = 10_001;
    expect(() => budget.assertWithinBudget()).toThrow(PerformanceAuditStepTimeoutError);
  } finally { budget.close(); }
});

it('detects synchronous completion after the timer could not run', () => {
  expect(enforcePerformanceAuditStepLimit(result(15_000))).toMatchObject({
    status: 'fail', durationMs: 15_000,
    metrics: { stepLimitExceeded: true, stepLimitMs: 10_000 },
  });
  expect(enforcePerformanceAuditStepLimit(result(10_000)).status).toBe('pass');
});

it('retains the elapsed foreground budget over a screen-off pause', () => {
  requestPerformanceAudit();
  let now = 0;
  const budget = new PerformanceAuditStepWatchdog('Product readiness', () => now);
  try {
    now = 6_000;
    pausePerformanceAudit();
    now = 306_000;
    expect(budget.isExpired()).toBe(false);
    resumePerformanceAudit();
    expect(budget.remainingMs()).toBe(4_000);
    now = 310_001;
    expect(budget.isExpired()).toBe(true);
  } finally { budget.close(); }
});

it('latches an ended scope closed so late work cannot pass a checkpoint', () => {
  const budget = new PerformanceAuditStepWatchdog('Old step', () => 0);
  budget.close();
  budget.touchProgress();
  expect(() => budget.assertWithinBudget()).toThrow(PerformanceAuditStepTimeoutError);
  const next = new PerformanceAuditStepWatchdog('Next step', () => 0);
  expect(next.remainingMs()).toBe(10_000);
  next.close();
});

it('keeps background settle off the step budget and out of the slowest user-visible sample', () => {
  let now = 0;
  const budget = new PerformanceAuditStepWatchdog('Rates', () => now);
  try {
    now = 400;
    budget.suspendBudget();
    now = 8_400;
    expect(budget.remainingMs()).toBe(9_600);
    expect(budget.isExpired()).toBe(false);
    budget.resumeBudget();
    now = 9_000;
    expect(budget.remainingMs()).toBe(9_000);
  } finally { budget.close(); }
  const settled = summarizePerformanceAudit([
    { ...result(10_903), id: 'scope-apply', status: 'fail', metrics: {
      executionAttempted: true, actionCompleted: true, forwardMs: 480, backgroundSettleMs: 10_000 } },
    { ...result(1_200), id: 'navigation', metrics: { forwardMs: 1_000, executionAttempted: true } },
  ]);
  expect(settled.slowestCheckId).toBe('navigation');
  expect(settled.slowestCheckMs).toBe(1_000);
});

it('includes a failed readiness wait without forward/back samples in slowest results', () => {
  expect(summarizePerformanceAudit([
    { ...result(25_000), status: 'fail', metrics: { executionAttempted: true, actionCompleted: false } },
    { ...result(1_200), id: 'quick', metrics: { forwardMs: 1_000 } },
  ])).toMatchObject({ slowestCheckId: 'journey', slowestCheckMs: 25_000 });
});

it('keeps interrupted timings out of the limit and report maxima', () => {
  const interrupted = { ...result(300_000), durationMs: null,
    status: 'skipped' as const, metrics: { interruptedByBackground: true } };
  expect(enforcePerformanceAuditStepLimit(interrupted, 300_000)).toEqual(interrupted);
  expect(summarizePerformanceAudit([interrupted]).slowestCheckMs).toBeNull();
});

it('provides an initial estimate, adapts to slow checks and covers finalization', () => {
  const initial = estimatePerformanceAuditTime({ total: 200, completed: 0, elapsedMs: 0, finalizing: false });
  expect(initial.basis).toBe('initial');
  expect(initial.remainingMinMs).toBeGreaterThan(0);
  const fast = estimatePerformanceAuditTime({ total: 200, completed: 20, elapsedMs: 20_000, finalizing: false });
  const slow = estimatePerformanceAuditTime({ total: 200, completed: 20, elapsedMs: 150_000, finalizing: false });
  expect(slow.remainingMaxMs).toBeGreaterThan(fast.remainingMaxMs);
  expect(formatPerformanceAuditEstimate(slow, true)).toContain('ETA paused');
  const finalizing = estimatePerformanceAuditTime({ total: 200, completed: 200, elapsedMs: 300_000, finalizing: true });
  expect(finalizing.remainingMaxMs).toBeGreaterThan(0);
  expect(formatPerformanceAuditEstimate(finalizing, false)).toContain('remaining');
});

it('does not permit rollback before a pending native action has drained', async () => {
  jest.useFakeTimers();
  try {
    const barrier = new PerformanceAuditMutationBarrier();
    let finish!: () => void;
    barrier.track(new Promise<void>(resolve => { finish = resolve; }));
    const timedDrain = barrier.drain();
    await jest.advanceTimersByTimeAsync(10_000);
    expect(await timedDrain).toBe(false);
    expect(barrier.hasPending).toBe(true);
    finish();
    expect(await barrier.drain()).toBe(true);
    expect(barrier.hasPending).toBe(false);
  } finally { jest.useRealTimers(); }
});

it('retains recovery state and refuses another run until app restart', () => {
  requestPerformanceAudit();
  failPerformanceAudit('Pending native mutation; restart to recover', true);
  expect(requestPerformanceAudit()).toBe('recovery-required');
  expect(getPerformanceAuditState()).toMatchObject({ status: 'failed', recoveryRequired: true });
});

it('does not estimate thousands of preloaded links at the route-check pace', () => {
  const startOfLinks = estimatePerformanceAuditTime({
    total: 2_310, completed: 300, elapsedMs: 600_000, finalizing: false,
    links: { total: 2_000, completed: 0, elapsedMs: 0 },
  });
  expect(startOfLinks.remainingMaxMs).toBeLessThan(450_000);
  const halfway = estimatePerformanceAuditTime({
    total: 2_310, completed: 1_300, elapsedMs: 650_000, finalizing: false,
    links: { total: 2_000, completed: 1_000, elapsedMs: 50_000 },
  });
  expect(halfway.remainingMaxMs).toBeLessThan(startOfLinks.remainingMaxMs);
  // Keep route timing independent: fast cached links cannot make the final
  // foreground work appear instantaneous.
  const finalChecks = estimatePerformanceAuditTime({
    total: 2_310, completed: 2_300, elapsedMs: 700_000, finalizing: false,
    links: { total: 2_000, completed: 2_000, elapsedMs: 100_000 },
  });
  expect(finalChecks.remainingMinMs).toBeGreaterThan(15_000);
});
