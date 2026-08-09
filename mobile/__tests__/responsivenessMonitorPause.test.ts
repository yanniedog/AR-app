import { ResponsivenessMonitor } from '../src/lib/performanceAudit';

/**
 * When Android suspends the JS thread, the monitor's overdue timer and
 * animation-frame callbacks run only once the app is back on screen, and each
 * reports a gap spanning the whole background interval. These tests pin down
 * where such a sample can land.
 */
describe('responsiveness monitor across a background pause', () => {
  let clockMs = 0;
  const realPerformance = globalThis.performance;

  beforeEach(() => {
    jest.useFakeTimers();
    clockMs = 0;
    Object.defineProperty(globalThis, 'performance', {
      configurable: true,
      writable: true,
      value: { now: () => clockMs },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.defineProperty(globalThis, 'performance', {
      configurable: true,
      writable: true,
      value: realPerformance,
    });
  });

  it('clips a suspended sample to the part that followed the next check snapshot', () => {
    const monitor = new ResponsivenessMonitor();
    monitor.start();

    // Five minutes off screen: the 25ms timer never runs, so nothing advances.
    clockMs = 300_000;
    // The next check starts after the app returns and takes its snapshot before
    // the overdue callback gets a turn.
    const snapshot = monitor.snapshot();

    clockMs = 300_040;
    jest.advanceTimersByTime(25);

    // The sample spans the whole pause, but only the 40ms after the snapshot is
    // attributed to this check — not five minutes of off-screen lag.
    expect(monitor.metricsSince(snapshot).maxEventLoopLagMs).toBe(40);
    monitor.stop();
  });

  it('excludes a suspended sample recorded before the next check snapshot', () => {
    const monitor = new ResponsivenessMonitor();
    monitor.start();

    clockMs = 300_000;
    // Here the overdue callback wins the race and runs first.
    jest.advanceTimersByTime(25);
    const snapshot = monitor.snapshot();

    clockMs = 300_050;
    jest.advanceTimersByTime(25);

    // Sample indices are captured at snapshot time, so the backgrounded sample
    // belongs to the interrupted check's window and never reaches this one.
    expect(monitor.metricsSince(snapshot).maxEventLoopLagMs).toBeLessThan(100);
    monitor.stop();
  });
});
