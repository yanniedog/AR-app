import { ResponsivenessMonitor } from '../src/lib/performanceAudit';

describe('completed action responsiveness windows', () => {
  let clockMs = 100;
  let nextFrameId = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const realPerformance = globalThis.performance;
  const realRaf = globalThis.requestAnimationFrame;
  const realCancelRaf = globalThis.cancelAnimationFrame;

  const paint = (at: number) => {
    clockMs = at;
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(callback => callback(at));
  };

  beforeEach(() => {
    jest.useFakeTimers();
    clockMs = 100;
    frames.clear();
    Object.defineProperty(globalThis, 'performance', {
      configurable: true, writable: true, value: { now: () => clockMs },
    });
    globalThis.requestAnimationFrame = callback => {
      const id = ++nextFrameId;
      frames.set(id, callback);
      return id;
    };
    globalThis.cancelAnimationFrame = id => { frames.delete(id); };
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.defineProperty(globalThis, 'performance', {
      configurable: true, writable: true, value: realPerformance,
    });
    globalThis.requestAnimationFrame = realRaf;
    globalThis.cancelAnimationFrame = realCancelRaf;
  });

  it('retains a synchronous block whose timer and frame callbacks arrive during settle', () => {
    const monitor = new ResponsivenessMonitor();
    monitor.start();
    paint(116);
    clockMs = 120;
    const start = monitor.snapshot();
    clockMs = 476;
    const end = monitor.snapshot();
    expect(monitor.metricsSince(start).maxEventLoopLagMs).toBeNull();

    // Settling runs the callbacks, but neither its time nor later work belongs
    // to the completed action's 356ms window.
    paint(500);
    jest.advanceTimersByTime(25);
    const measured = monitor.metricsSince(start, end);
    expect(measured).toMatchObject({
      eventLoopSamples: 1, maxEventLoopLagMs: 351, stallsOver100Ms: 1,
      frameSamples: 1, maxFrameGapMs: 356, framesOver50Ms: 1,
    });
    paint(1500);
    jest.advanceTimersByTime(25);
    expect(monitor.metricsSince(start, end)).toEqual(measured);
    expect(monitor.metricsSince(start).maxFrameGapMs).toBe(1000);
    monitor.stop();
  });

  it('pools action windows without charging intervening settle stalls or taking a maximum of percentiles', () => {
    const monitor = new ResponsivenessMonitor(); monitor.start(); paint(116);
    const windows: { start: ReturnType<typeof monitor.snapshot>; end: ReturnType<typeof monitor.snapshot> }[] = [];
    for (let n = 0; n < 20; n++) {
      const start = monitor.snapshot(); clockMs += 10; const end = monitor.snapshot();
      paint(clockMs); jest.advanceTimersByTime(25); windows.push({ start, end });
    }
    // This 1-second stall happens only in the explicitly unmeasured settle.
    paint(clockMs + 1000); jest.advanceTimersByTime(25);
    const start = monitor.snapshot(); clockMs += 100; const end = monitor.snapshot();
    // The final blocked observation arrives after the action endpoint.
    paint(clockMs + 30); jest.advanceTimersByTime(25); windows.push({ start, end });
    expect(monitor.metricsForWindows(windows)).toMatchObject({ frameSamples: 21, frameP95Ms: 10, maxFrameGapMs: 100 });
    expect(monitor.metrics().maxFrameGapMs).toBe(1000);
    monitor.stop();
  });

  it('records an observed short action with no overdue timer as zero lag', () => {
    const monitor = new ResponsivenessMonitor();
    monitor.start();
    paint(116);
    clockMs = 120;
    const start = monitor.snapshot();
    clockMs = 123;
    const end = monitor.snapshot();
    paint(132);
    jest.advanceTimersByTime(25);
    expect(monitor.metricsSince(start, end)).toMatchObject({
      eventLoopSamples: 1, maxEventLoopLagMs: 0,
      frameSamples: 1, maxFrameGapMs: 3,
    });
    monitor.stop();
  });

  it('keeps missing callbacks and zero-length windows unknown', () => {
    const monitor = new ResponsivenessMonitor();
    monitor.start();
    const start = monitor.snapshot();
    clockMs = 150;
    const end = monitor.snapshot();
    monitor.stop();
    expect(monitor.metricsSince(start, end)).toMatchObject({
      eventLoopSamples: 0, maxEventLoopLagMs: null, frameSamples: 0, maxFrameGapMs: null,
    });
    expect(monitor.metricsSince(start, start).eventLoopSamples).toBe(0);
  });

  it('includes the terminal callback but excludes intervals beginning at the exact end', () => {
    const monitor = new ResponsivenessMonitor();
    monitor.start();
    paint(116);
    clockMs = 120;
    const start = monitor.snapshot();
    paint(150);
    jest.advanceTimersByTime(25);
    const end = monitor.snapshot();
    const measured = monitor.metricsSince(start, end);
    expect(measured).toMatchObject({ eventLoopSamples: 1, maxEventLoopLagMs: 25,
      frameSamples: 1, maxFrameGapMs: 30 });
    paint(500);
    jest.advanceTimersByTime(25);
    expect(monitor.metricsSince(start, end)).toEqual(measured);
    monitor.stop();
  });
});
