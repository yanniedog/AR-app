import {
  createPerformanceAuditGraphicToken,
  createPerformanceAuditListToken,
  createPerformanceAuditLogoToken,
  PerformanceAuditReadinessProbeError,
  PerformanceAuditReadinessRegistry,
  PerformanceAuditReadinessTimeoutError,
  type PerformanceAuditReadinessClock,
} from '../src/lib/performanceAuditReadiness';

class FakeClock implements PerformanceAuditReadinessClock {
  private nowMs = 0;
  private nextId = 1;
  private timers = new Map<number, { at: number; callback: () => void }>();

  now(): number {
    return this.nowMs;
  }

  setTimeout(callback: () => void, delayMs: number): number {
    const id = this.nextId++;
    this.timers.set(id, { at: this.nowMs + Math.max(0, delayMs), callback });
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.timers.delete(handle as number);
  }

  advanceBy(ms: number): void {
    const destination = this.nowMs + ms;
    while (true) {
      const next = [...this.timers.entries()]
        .filter(([, timer]) => timer.at <= destination)
        .sort((left, right) => left[1].at - right[1].at || left[0] - right[0])[0];
      if (!next) break;
      const [id, timer] = next;
      this.timers.delete(id);
      this.nowMs = timer.at;
      timer.callback();
    }
    this.nowMs = destination;
  }
}

describe('PerformanceAuditReadinessRegistry', () => {
  it('is inert outside capture and never treats zero surfaces as ready', () => {
    const clock = new FakeClock();
    const registry = new PerformanceAuditReadinessRegistry(clock);

    expect(registry.registerSurface({ id: 'home' })).toBeNull();
    expect(registry.snapshot()).toMatchObject({
      capturing: false,
      ready: false,
      totalProbes: 0,
      blockers: [{ code: 'capture-inactive' }],
    });

    registry.beginCapture('pa-test');
    expect(registry.snapshot()).toMatchObject({
      capturing: true,
      ready: false,
      blockers: [{ code: 'no-surfaces' }],
    });
  });

  it('never treats a registered surface with zero probes as ready', async () => {
    const clock = new FakeClock();
    const registry = new PerformanceAuditReadinessRegistry(clock);
    registry.beginCapture('pa-no-probes');
    registry.registerSurface({ id: 'browse' });

    expect(registry.snapshot()).toMatchObject({
      ready: false,
      totalProbes: 0,
      blockers: [{ code: 'no-probes', surfaceId: 'browse' }],
    });

    const wait = registry.waitForReady({ quietWindowMs: 10, timeoutMs: 50 });
    clock.advanceBy(50);
    await expect(wait).rejects.toBeInstanceOf(PerformanceAuditReadinessTimeoutError);
  });

  it('reports pending proof for status, revision, and incomplete counts', () => {
    const clock = new FakeClock();
    const registry = new PerformanceAuditReadinessRegistry(clock);
    registry.beginCapture('pa-proof');
    registry.registerSurface({
      id: 'search',
      datasetRevision: '2026-08-07',
      renderRevision: 'query:bank',
      probes: [{
        id: 'results',
        kind: 'list',
        status: 'ready',
        datasetRevision: '2026-08-06',
        renderRevision: 'query:',
        expectedCount: 10,
        actualCount: 3,
      }],
    });

    const snapshot = registry.snapshot();
    expect(snapshot.ready).toBe(false);
    expect(snapshot.pendingRequiredProbes).toBe(1);
    expect(snapshot.blockers.map(({ code }) => code)).toEqual([
      'dataset-revision-mismatch',
      'render-revision-mismatch',
      'count-incomplete',
    ]);
  });

  it('resets the quiet window when a revision or readiness count changes', async () => {
    const clock = new FakeClock();
    const registry = new PerformanceAuditReadinessRegistry(clock);
    registry.beginCapture('pa-quiet');
    const surface = registry.registerSurface({
      id: 'trends',
      renderRevision: 'stage:1',
      probes: [{
        id: 'chart',
        kind: 'graphic',
        status: 'ready',
        renderRevision: 'stage:1',
        expectedCount: 20,
        actualCount: 20,
      }],
    });
    expect(surface).not.toBeNull();

    let resolved = false;
    const wait = registry.waitForReady({ quietWindowMs: 100, timeoutMs: 1_000 });
    void wait.then(() => { resolved = true; });
    clock.advanceBy(60);
    await Promise.resolve();
    expect(resolved).toBe(false);

    registry.updateSurface(surface!, { renderRevision: 'stage:2' });
    registry.updateProbe(surface!, 'chart', {
      renderRevision: 'stage:2',
      actualCount: 21,
      expectedCount: 21,
    });
    clock.advanceBy(99);
    await Promise.resolve();
    expect(resolved).toBe(false);

    clock.advanceBy(1);
    await expect(wait).resolves.toMatchObject({ ready: true });
  });

  it('rejects immediately when a required probe enters an error state', async () => {
    const clock = new FakeClock();
    const registry = new PerformanceAuditReadinessRegistry(clock);
    registry.beginCapture('pa-error');
    const surface = registry.registerSurface({
      id: 'logos',
      probes: [{ id: 'bank-logo', kind: 'logo', status: 'pending' }],
    });
    const wait = registry.waitForReady({ quietWindowMs: 10, timeoutMs: 1_000 });

    registry.updateProbe(surface!, 'bank-logo', { status: 'error', error: 'all sources failed' });

    await expect(wait).rejects.toMatchObject({
      name: PerformanceAuditReadinessProbeError.name,
      snapshot: {
        blockers: [expect.objectContaining({
          code: 'probe-error',
          surfaceId: 'logos',
          probeId: 'bank-logo',
        })],
      },
    });
  });

  it('invokes named semantic actions on the registered surface', async () => {
    const registry = new PerformanceAuditReadinessRegistry(new FakeClock());
    registry.beginCapture('pa-action');
    const action = jest.fn(async (mode: unknown) => `selected:${String(mode)}`);
    registry.registerSurface({
      id: 'history-explorer',
      probes: [{ id: 'layout', kind: 'layout', status: 'ready' }],
      actions: { selectMode: action },
    });

    await expect(registry.invokeAction('history-explorer', 'selectMode', 'pulse'))
      .resolves.toBe('selected:pulse');
    expect(action).toHaveBeenCalledWith('pulse');
    expect(registry.snapshot().surfaces[0]).toMatchObject({
      actionRevision: 1,
      lastCompletedAction: 'selectMode',
    });
    await expect(registry.invokeAction('history-explorer', 'missing')).rejects.toThrow(
      'history-explorer.missing',
    );
  });

  it('preserves completed action evidence across same-id remounts', async () => {
    const registry = new PerformanceAuditReadinessRegistry(new FakeClock());
    registry.beginCapture('pa-remount-action');
    let midActionRemount: ReturnType<typeof registry.registerSurface> = null;
    const first = registry.registerSurface({
      id: 'browse.hierarchy',
      probes: [{ id: 'layout', kind: 'layout', status: 'ready' }],
      actions: {
        'browse.category.first': () => {
          // Simulate navigation that unmounts then remounts the same surface id
          // before invokeAction can stamp the original MutableSurface.
          registry.unregisterSurface(first!);
          midActionRemount = registry.registerSurface({
            id: 'browse.hierarchy',
            probes: [{ id: 'layout', kind: 'layout', status: 'ready' }],
            actions: { 'browse.category.first': () => undefined },
          });
        },
      },
    });
    expect(first).not.toBeNull();

    await expect(registry.invokeAction('browse.hierarchy', 'browse.category.first'))
      .resolves.toBeUndefined();
    expect(midActionRemount).not.toBeNull();
    expect(registry.snapshot().surfaces[0]).toMatchObject({
      id: 'browse.hierarchy',
      actionRevision: 1,
      lastCompletedAction: 'browse.category.first',
    });

    // Remount after completion must also keep the durable action proof.
    expect(registry.unregisterSurface(midActionRemount!)).toBe(true);
    const afterCompletion = registry.registerSurface({
      id: 'browse.hierarchy',
      probes: [{ id: 'layout', kind: 'layout', status: 'ready' }],
      actions: { 'browse.category.first': () => undefined },
    });
    expect(afterCompletion).not.toBeNull();
    expect(registry.snapshot().surfaces[0]).toMatchObject({
      actionRevision: 1,
      lastCompletedAction: 'browse.category.first',
    });
  });

  it('does not stamp completion for unavailable action results', async () => {
    const registry = new PerformanceAuditReadinessRegistry(new FakeClock());
    registry.beginCapture('pa-unavailable');
    registry.registerSurface({
      id: 'browse.hierarchy',
      probes: [{ id: 'layout', kind: 'layout', status: 'ready' }],
      actions: {
        'browse.category.first': () => ({
          unavailableReason: 'No category children are available on the current browse node',
        }),
      },
    });

    await expect(registry.invokeAction('browse.hierarchy', 'browse.category.first'))
      .resolves.toEqual({
        unavailableReason: 'No category children are available on the current browse node',
      });
    expect(registry.snapshot().surfaces[0]).toMatchObject({
      actionRevision: 0,
      lastCompletedAction: null,
    });
  });

  it('ignores late action completion after capture restarts', async () => {
    const registry = new PerformanceAuditReadinessRegistry(new FakeClock());
    const firstCapture = registry.beginCapture('pa-stale-1');
    let releaseAction: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      releaseAction = resolve;
    });
    registry.registerSurface({
      id: 'browse.hierarchy',
      probes: [{ id: 'layout', kind: 'layout', status: 'ready' }],
      actions: {
        'browse.category.first': async () => {
          await pending;
        },
      },
    });

    const invoke = registry.invokeAction('browse.hierarchy', 'browse.category.first');
    registry.endCapture(firstCapture);
    registry.beginCapture('pa-stale-2');
    registry.registerSurface({
      id: 'browse.hierarchy',
      probes: [{ id: 'layout', kind: 'layout', status: 'ready' }],
      actions: { 'browse.category.first': () => undefined },
    });
    releaseAction?.();
    await expect(invoke).resolves.toBeUndefined();
    expect(registry.snapshot().surfaces[0]).toMatchObject({
      actionRevision: 0,
      lastCompletedAction: null,
    });
  });

  it('waits for the exact requested destination surface', async () => {
    const clock = new FakeClock();
    const registry = new PerformanceAuditReadinessRegistry(clock);
    registry.beginCapture('pa-target');
    registry.registerSurface({
      id: 'persistent-root',
      probes: [{ id: 'layout', kind: 'layout', status: 'ready' }],
    });

    const wait = registry.waitForReady({
      surfaceIds: ['search.results'],
      quietWindowMs: 10,
      timeoutMs: 1_000,
    });
    clock.advanceBy(50);
    await Promise.resolve();
    let resolved = false;
    void wait.then(() => { resolved = true; });
    expect(resolved).toBe(false);

    registry.registerSurface({
      id: 'search.results',
      probes: [{ id: 'results', kind: 'list', status: 'ready', expectedCount: 4, actualCount: 4 }],
    });
    clock.advanceBy(10);
    await expect(wait).resolves.toMatchObject({
      ready: true,
      surfaces: [expect.objectContaining({ id: 'search.results' })],
    });
  });

  it('promotes an optional asset family when the active step exercises it', () => {
    const registry = new PerformanceAuditReadinessRegistry(new FakeClock());
    registry.beginCapture('pa-required-kind');
    registry.registerSurface({
      id: 'product.details',
      probes: [
        { id: 'data', kind: 'data', status: 'ready' },
        { id: 'history-chart', kind: 'graphic', required: false, status: 'pending' },
      ],
    });

    expect(registry.snapshot(['product.details']).ready).toBe(true);
    expect(registry.snapshot(['product.details'], ['graphic'])).toMatchObject({
      ready: false,
      blockers: [expect.objectContaining({ code: 'probe-pending', probeId: 'history-chart' })],
    });
    expect(registry.snapshot(['product.details'], ['logo'])).toMatchObject({
      ready: false,
      blockers: [expect.objectContaining({ code: 'required-kind-missing' })],
    });
  });

  it('fails immediately when a required readiness kind is never registered', async () => {
    const clock = new FakeClock();
    const registry = new PerformanceAuditReadinessRegistry(clock);
    registry.beginCapture('pa-missing-kind');
    registry.registerSurface({
      id: 'search.results',
      probes: [{ id: 'results', kind: 'list', status: 'ready', expectedCount: 1, actualCount: 1 }],
    });

    const wait = registry.waitForReady({
      surfaceIds: ['search.results'],
      requiredKinds: ['graphic'],
      quietWindowMs: 10,
      timeoutMs: 30_000,
    });
    clock.advanceBy(1);
    await expect(wait).rejects.toMatchObject({
      name: 'PerformanceAuditReadinessError',
      message: expect.stringContaining('Required readiness kind is unavailable'),
    });
  });

  it('provides lifecycle tokens for logos, graphics, and counted lists', () => {
    const registry = new PerformanceAuditReadinessRegistry(new FakeClock());
    registry.beginCapture('pa-assets');
    const surface = registry.registerSurface({ id: 'product-card' });
    const logo = createPerformanceAuditLogoToken(registry, surface, 'logo');
    const graphic = createPerformanceAuditGraphicToken(registry, surface, 'rate-chart');
    const list = createPerformanceAuditListToken(registry, surface, 'products', 4);

    expect(logo.active).toBe(true);
    logo.ready();
    graphic.ready({ renderRevision: 'draw:complete' });
    list.ready({ actualCount: 3 });
    expect(registry.snapshot()).toMatchObject({
      ready: false,
      blockers: [expect.objectContaining({ code: 'count-incomplete', probeId: 'products' })],
    });

    list.ready({ actualCount: 4 });
    expect(registry.snapshot().ready).toBe(true);
  });

  it('honors onlyKinds so logo decoration cannot block mounted-action readiness', async () => {
    const clock = new FakeClock();
    const registry = new PerformanceAuditReadinessRegistry(clock);
    registry.beginCapture('pa-only-kinds');
    registry.registerSurface({
      id: 'calculator.results',
      probes: [
        { id: 'calculator.data', kind: 'data', status: 'ready' },
        { id: 'calculator.layout', kind: 'layout', status: 'ready' },
        {
          id: 'calculator.logos',
          kind: 'logo',
          status: 'pending',
          expectedCount: 10,
          actualCount: 0,
        },
      ],
    });

    const wait = registry.waitForReady({
      onlyKinds: ['data', 'layout'],
      quietWindowMs: 10,
      timeoutMs: 1_000,
    });
    clock.advanceBy(10);
    await expect(wait).resolves.toMatchObject({ ready: true });
  });

  it('ignores stale surface and asset tokens from an earlier capture generation', () => {
    const registry = new PerformanceAuditReadinessRegistry(new FakeClock());
    const firstCapture = registry.beginCapture('pa-first');
    const oldSurface = registry.registerSurface({ id: 'bank' });
    const oldLogo = createPerformanceAuditLogoToken(registry, oldSurface, 'logo');
    registry.endCapture(firstCapture);
    registry.beginCapture('pa-second');
    const currentSurface = registry.registerSurface({
      id: 'bank',
      probes: [{ id: 'layout', kind: 'layout', status: 'ready' }],
    });

    expect(oldLogo.ready()).toBe(false);
    expect(registry.unregisterSurface(oldSurface!)).toBe(false);
    expect(registry.snapshot().surfaces[0]).toMatchObject({
      id: currentSurface?.surfaceId,
      probes: [expect.objectContaining({ id: 'layout' })],
    });
  });
});
