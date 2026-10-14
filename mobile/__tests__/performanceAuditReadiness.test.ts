import {
  createPerformanceAuditGraphicToken,
  createPerformanceAuditListToken,
  createPerformanceAuditLogoToken,
  compactPerformanceAuditReadinessEvidence,
  OpaquePerformanceAuditRenderRevision,
  PerformanceAuditReadinessProbeError,
  PerformanceAuditReadinessRegistry,
  PerformanceAuditReadinessTimeoutError,
  type PerformanceAuditReadinessClock,
} from '../src/lib/performanceAuditReadiness';

describe('opaque performance audit render revisions', () => {
  it('changes for advanced and base-scenario edits without exposing financial inputs', () => {
    const revisions = new OpaquePerformanceAuditRenderRevision();
    const initial = revisions.update([
      false,
      { balance: '50000', currentRate: '2.50' },
      { horizonYears: '10' },
    ]);

    expect(revisions.update([
      false,
      { balance: '50000', currentRate: '2.50' },
      { horizonYears: '10' },
    ])).toBe(initial);
    const advanced = revisions.update([
      true,
      { balance: '50000', currentRate: '2.50' },
      { horizonYears: '10' },
    ]);
    const changedBase = revisions.update([
      true,
      { balance: '51000', currentRate: '2.60' },
      { horizonYears: '10' },
    ]);

    expect(new Set([initial, advanced, changedBase]).size).toBe(3);
    expect(`${initial}:${advanced}:${changedBase}`).not.toMatch(/50000|51000|2\.50|2\.60/);
  });
});

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

  pendingTimers(): number {
    return this.timers.size;
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
  it('pauses timeout and requires fresh foreground stability after resuming', async () => {
    const clock = new FakeClock();
    const registry = new PerformanceAuditReadinessRegistry(clock);
    registry.beginCapture('pause');
    registry.registerSurface({ id: 'screen', probes: [{ id: 'data', kind: 'data', status: 'ready' }] });
    let paused = false;
    const listeners = new Set<() => void>();
    const pauseState = { getPaused: () => paused, subscribe: (listener: () => void) => {
      listeners.add(listener); return () => { listeners.delete(listener); };
    } };
    let done = false;
    const wait = registry.waitForReady({ quietWindowMs: 100, timeoutMs: 200, pauseState })
      .then(() => { done = true; });
    clock.advanceBy(50);
    paused = true;
    listeners.forEach(listener => listener());
    clock.advanceBy(1000);
    await Promise.resolve();
    expect(done).toBe(false);
    expect(clock.pendingTimers()).toBe(0);
    paused = false;
    listeners.forEach(listener => listener());
    clock.advanceBy(99);
    await Promise.resolve();
    expect(done).toBe(false);
    clock.advanceBy(1);
    await wait;
    expect(done).toBe(true);
    expect(listeners.size).toBe(0);
  });

  it('retains the foreground timeout budget across a background pause', async () => {
    const clock = new FakeClock();
    const registry = new PerformanceAuditReadinessRegistry(clock);
    registry.beginCapture('pause-timeout');
    registry.registerSurface({ id: 'screen', probes: [{ id: 'data', kind: 'data', status: 'pending' }] });
    let paused = false;
    let notify = () => {};
    const wait = registry.waitForReady({ timeoutMs: 200, pauseState: {
      getPaused: () => paused, subscribe: listener => { notify = listener; return () => {}; },
    } });
    const rejected = expect(wait).rejects.toBeInstanceOf(PerformanceAuditReadinessTimeoutError);
    clock.advanceBy(75);
    paused = true; notify();
    clock.advanceBy(1000);
    paused = false; notify();
    clock.advanceBy(124);
    expect(clock.pendingTimers()).toBe(1);
    clock.advanceBy(1);
    await rejected;
  });

  function settledFixture() {
    const clock = new FakeClock();
    const registry = new PerformanceAuditReadinessRegistry(clock);
    registry.beginCapture('reuse-stability');
    const definition = {
      id: 'screen', renderRevision: 'before',
      actions: { next: () => undefined },
      probes: [
        { id: 'data', kind: 'data' as const, status: 'ready' as const },
        { id: 'layout', kind: 'layout' as const, status: 'ready' as const },
        { id: 'logo', kind: 'logo' as const, status: 'ready' as const, required: false },
      ],
    };
    const surface = registry.registerSurface(definition)!;
    const options = { surfaceIds: ['screen'], quietWindowMs: 650, timeoutMs: 1000 };
    const settled = registry.waitForReady(options);
    clock.advanceBy(650);
    return { clock, registry, surface, definition, options, settled };
  }

  it('reuses proven stability for a narrower pre-action check, with no extra timer wait', async () => {
    const { clock, registry, surface, options, settled } = settledFixture();
    await settled;
    const other = registry.registerSurface({ id: 'other' })!;
    registry.updateSurface(other, { renderRevision: 'unrelated-update' });
    registry.updateProbe(surface, 'data', { status: 'ready' }); // no-op preserves proof
    const before = clock.now();
    for (let index = 0; index < 200; index += 1) {
      await expect(registry.waitForReady({ ...options, onlyKinds: ['data', 'layout'],
        reuseSettledEvidence: true })).resolves.toMatchObject({ quietWindowReused: true });
    }
    expect(clock.now()).toBe(before);
    expect(clock.pendingTimers()).toBe(0);
    // Post-action waits keep their fresh stability window unless explicitly opted in.
    let done = false;
    const fresh = registry.waitForReady(options).then(() => { done = true; });
    clock.advanceBy(649);
    await Promise.resolve();
    expect(done).toBe(false);
    clock.advanceBy(1);
    await fresh;
  });

  it.each(['probe ABA', 'render', 'dataset', 'actions', 'probe removal', 'remount', 'capture', 'lifecycle'])(
    'requires fresh stability after %s changes', async (change) => {
      const { clock, registry, surface, definition, options, settled } = settledFixture();
      await settled;
      if (change === 'probe ABA') {
        registry.updateProbe(surface, 'data', { status: 'pending' });
        registry.updateProbe(surface, 'data', { status: 'ready' });
      } else if (change === 'render') registry.updateSurface(surface, { renderRevision: 'after' });
      else if (change === 'dataset') registry.updateSurface(surface, { datasetRevision: 'new-data' });
      else if (change === 'actions') registry.updateSurface(surface, { actions: { next: () => 'new' } });
      else if (change === 'probe removal') registry.removeProbe(surface, 'logo');
      else if (change === 'remount') {
        registry.unregisterSurface(surface);
        registry.registerSurface(definition);
      } else if (change === 'capture') {
        registry.endCapture();
        registry.beginCapture('new-capture');
        registry.registerSurface(definition);
      } else registry.invalidateSettledReadiness();
      let done = false;
      const wait = registry.waitForReady({ ...options, reuseSettledEvidence: true })
        .then((snapshot) => { done = true; return snapshot; });
      clock.advanceBy(649);
      await Promise.resolve();
      expect(done).toBe(false);
      clock.advanceBy(1);
      await expect(wait).resolves.not.toHaveProperty('quietWindowReused');
    },
  );

  it('does not reuse weaker probe requirements or a shorter stability window', async () => {
    const { clock, registry, options, settled } = settledFixture();
    await settled;
    const stronger = registry.waitForReady({ ...options, requiredKinds: ['logo'], reuseSettledEvidence: true });
    expect(clock.pendingTimers()).toBe(2);
    clock.advanceBy(650);
    await expect(stronger).resolves.not.toHaveProperty('quietWindowReused');
    const longer = registry.waitForReady({ ...options, quietWindowMs: 700, reuseSettledEvidence: true });
    expect(clock.pendingTimers()).toBe(2);
    clock.advanceBy(700);
    await expect(longer).resolves.not.toHaveProperty('quietWindowReused');
  });

  it('restarts an in-flight quiet window on pause and resume', async () => {
    const { clock, registry, options, settled } = settledFixture();
    await settled;
    let done = false;
    const pending = registry.waitForReady({ ...options, timeoutMs: 3000 })
      .then((snapshot) => { done = true; return snapshot; });
    clock.advanceBy(300);
    registry.invalidateSettledReadiness(); // pause
    clock.advanceBy(200);
    registry.invalidateSettledReadiness(); // resume
    clock.advanceBy(649);
    await Promise.resolve();
    expect(done).toBe(false);
    expect(clock.pendingTimers()).toBe(2);
    clock.advanceBy(1);
    await expect(pending).resolves.not.toHaveProperty('quietWindowReused');
    await expect(registry.waitForReady({ ...options, reuseSettledEvidence: true }))
      .resolves.toMatchObject({ quietWindowReused: true });
  });

  it('discards evidence from a wait that finished while backgrounded', async () => {
    const { clock, registry, options, settled } = settledFixture();
    await settled;
    const pending = registry.waitForReady({ ...options, timeoutMs: 3000 });
    clock.advanceBy(300);
    registry.invalidateSettledReadiness(); // pause
    clock.advanceBy(700);
    await pending;
    registry.invalidateSettledReadiness(); // resume
    const foreground = registry.waitForReady({ ...options, reuseSettledEvidence: true });
    expect(clock.pendingTimers()).toBe(2);
    clock.advanceBy(650);
    await expect(foreground).resolves.not.toHaveProperty('quietWindowReused');
  });

  it('still enforces changed render, pending probes, and probe errors when reuse is requested', async () => {
    const { clock, registry, surface, options, settled } = settledFixture();
    await settled;
    const unchanged = registry.waitForReady({ ...options, reuseSettledEvidence: true,
      changedRender: { surfaceId: 'screen', previousRevision: 'before' } });
    clock.advanceBy(1000);
    await expect(unchanged).rejects.toBeInstanceOf(PerformanceAuditReadinessTimeoutError);
    registry.updateProbe(surface, 'data', { status: 'pending' });
    const pending = registry.waitForReady({ ...options, reuseSettledEvidence: true });
    expect(clock.pendingTimers()).toBe(1);
    clock.advanceBy(1000);
    await expect(pending).rejects.toBeInstanceOf(PerformanceAuditReadinessTimeoutError);
    registry.updateProbe(surface, 'data', { status: 'error', error: 'Failed to load' });
    await expect(registry.waitForReady({ ...options, reuseSettledEvidence: true }))
      .rejects.toBeInstanceOf(PerformanceAuditReadinessProbeError);
  });

  it.each(['success', 'unavailable', 'failure'])('invalidates evidence during and after an action: %s', async (outcome) => {
    const { clock, registry, surface, options, settled } = settledFixture();
    await settled;
    let complete!: (value: unknown) => void;
    let fail!: (error: Error) => void;
    registry.updateSurface(surface, { actions: { next: () => new Promise((resolve, reject) => {
      complete = resolve;
      fail = reject;
    }) } });
    const before = registry.waitForReady(options);
    clock.advanceBy(650);
    await before;
    const action = registry.invokeAction('screen', 'next');
    const whilePending = registry.waitForReady({ ...options, reuseSettledEvidence: true });
    expect(clock.pendingTimers()).toBe(2);
    clock.advanceBy(650);
    await expect(whilePending).resolves.not.toHaveProperty('quietWindowReused');
    if (outcome === 'failure') {
      fail(new Error('Action failed'));
      await expect(action).rejects.toThrow('Action failed');
    } else {
      complete(outcome === 'unavailable' ? { unavailableReason: 'No item' } : undefined);
      await action;
    }
    const after = registry.waitForReady({ ...options, reuseSettledEvidence: true });
    expect(clock.pendingTimers()).toBe(2);
    clock.advanceBy(650);
    await expect(after).resolves.not.toHaveProperty('quietWindowReused');
  });

  it('keeps one quiet timer under notification bursts and clears all timers on settlement or abort', async () => {
    const { clock, registry, options, settled } = settledFixture();
    await settled;
    const other = registry.registerSurface({ id: 'other' })!;
    const wait = registry.waitForReady(options);
    for (let index = 0; index < 1000; index += 1) {
      registry.updateSurface(other, { renderRevision: String(index) });
      expect(clock.pendingTimers()).toBe(2);
    }
    clock.advanceBy(650);
    await wait;
    expect(clock.pendingTimers()).toBe(0);
    const controller = new AbortController();
    const aborted = registry.waitForReady({ ...options, signal: controller.signal });
    registry.updateSurface(other, { renderRevision: 'again' });
    controller.abort();
    await expect(aborted).rejects.toThrow('aborted');
    expect(clock.pendingTimers()).toBe(0);
  });

  it('requires graph measurement and counted data, or an explicit measured no-data state', () => {
    const registry = new PerformanceAuditReadinessRegistry(new FakeClock());
    registry.beginCapture('graph-proof');
    const surface = registry.registerSurface({ id: 'graphs', probes: [
      { id: 'chart', kind: 'graphic', status: 'ready' },
    ] })!;
    expect(registry.snapshot().blockers.map(({ code }) => code)).toContain('graphic-evidence-missing');
    registry.updateProbe(surface, 'chart', { expectedCount: 2, actualCount: 2,
      accessibleSummary: true, layoutMeasured: true });
    expect(registry.snapshot().ready).toBe(true);
    registry.updateProbe(surface, 'chart', { expectedCount: 0, actualCount: 0,
      emptyStateRendered: false });
    expect(registry.snapshot().ready).toBe(false);
    registry.updateProbe(surface, 'chart', { emptyStateRendered: true });
    expect(registry.snapshot().ready).toBe(true);
  });
  it('waits for a delayed rendered action beyond the quiet window', async () => {
    const clock = new FakeClock();
    const registry = new PerformanceAuditReadinessRegistry(clock);
    registry.beginCapture('pa-deferred');
    const surface = registry.registerSurface({
      id: 'chart', renderRevision: 'before',
      probes: [{ id: 'layout', kind: 'layout', status: 'ready' }],
    })!;
    let finished = false;
    const wait = registry.waitForReady({
      surfaceIds: ['chart'], quietWindowMs: 50, timeoutMs: 1000,
      changedRender: { surfaceId: 'chart', previousRevision: 'before' },
    }).then((snapshot) => { finished = true; return snapshot; });
    clock.advanceBy(200);
    await Promise.resolve();
    expect(finished).toBe(false);
    registry.updateSurface(surface, { renderRevision: 'after' });
    clock.advanceBy(50);
    await expect(wait).resolves.toMatchObject({ ready: true });
  });

  it('does not turn an acknowledged no-op into rendered action proof', async () => {
    const clock = new FakeClock();
    const registry = new PerformanceAuditReadinessRegistry(clock);
    registry.beginCapture('pa-no-op');
    registry.registerSurface({
      id: 'chart', renderRevision: 'before', actions: { next: () => undefined },
      probes: [{ id: 'layout', kind: 'layout', status: 'ready' }],
    });
    await registry.invokeAction('chart', 'next');
    const wait = registry.waitForReady({
      surfaceIds: ['chart'], quietWindowMs: 50, timeoutMs: 100,
      changedRender: { surfaceId: 'chart', previousRevision: 'before' },
    });
    clock.advanceBy(100);
    await expect(wait).rejects.toBeInstanceOf(PerformanceAuditReadinessTimeoutError);
  });

  it('keeps every display probe parseable without embedding long revisions', () => {
    const registry = new PerformanceAuditReadinessRegistry(new FakeClock());
    registry.beginCapture('pa-compact');
    registry.registerSurface({
      id: 'product.details',
      datasetRevision: 'a'.repeat(64),
      renderRevision: 'private-state:'.repeat(80),
      probes: Array.from({ length: 8 }, (_, index) => ({
        id: `probe-${index}`,
        kind: index === 7 ? 'layout' as const : 'list' as const,
        status: 'ready' as const,
        expectedCount: index + 1,
        actualCount: index + 1,
        layoutMeasured: index === 7 ? true : null,
      })),
    });

    const evidence = compactPerformanceAuditReadinessEvidence(registry.snapshot());
    expect(evidence.length).toBeLessThanOrEqual(512);
    expect(evidence.split(' | ')).toHaveLength(8);
    expect(evidence).toContain('product.details:probe-7:layout:ready:8/8:measured=1');
    expect(evidence).not.toContain('private-state');
    expect(evidence).not.toContain('a'.repeat(32));
  });

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
        layoutMeasured: true,
        accessibleSummary: true,
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
    expect(registry.actionCompletion('browse.hierarchy')).toEqual({
      actionRevision: 1,
      actionName: 'browse.category.first',
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
    expect(compactPerformanceAuditReadinessEvidence(registry.snapshot(['product.details'], ['graphic'])))
      .toContain('product.details:history-chart:graphic:pending::required=1');
    expect(compactPerformanceAuditReadinessEvidence(registry.snapshot(['product.details'])))
      .toContain('product.details:history-chart:graphic:pending::required=0');
    expect(registry.snapshot(['product.details'], ['logo'])).toMatchObject({
      ready: false,
      blockers: [expect.objectContaining({ code: 'required-kind-missing' })],
    });
  });

  it.each(['pending', 'error'] as const)('a promoted zero-count graph still blocks when %s', status => {
    const registry = new PerformanceAuditReadinessRegistry(new FakeClock());
    registry.beginCapture('pa-zero-count-graphic');
    registry.registerSurface({ id: 'product.details', probes: [
      { id: 'data', kind: 'data', status: 'ready' },
      { id: 'history-chart', kind: 'graphic', required: false, status,
        expectedCount: 0, actualCount: 0, error: status === 'error' ? 'failed to render' : undefined },
    ] });
    expect(registry.snapshot(['product.details']).ready).toBe(true);
    expect(registry.snapshot(['product.details'], ['graphic'])).toMatchObject({ ready: false,
      blockers: [expect.objectContaining({ code: status === 'error' ? 'probe-error' : 'probe-pending', probeId: 'history-chart' })] });
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
    graphic.ready({ renderRevision: 'draw:complete', expectedCount: 1, actualCount: 1,
      layoutMeasured: true, accessibleSummary: true });
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
