import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { PerformanceAuditReadinessProvider, usePerformanceAuditProbe,
  usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { PerformanceAuditReadinessRegistry } from '../src/lib/performanceAuditReadiness';

test('closed sibling graphics cannot block a measured chart; reopen discards the prior probe evidence', () => {
  const registry = new PerformanceAuditReadinessRegistry();
  registry.beginCapture('panels');
  function Panels({ open, measured }: { open: boolean; measured: boolean }) {
    const surface = usePerformanceAuditSurface({ id: 'outlook' });
    usePerformanceAuditProbe(surface, { id: 'history', kind: 'graphic', status: 'ready',
      expectedCount: 85, actualCount: 85, layoutMeasured: true, accessibleSummary: true });
    usePerformanceAuditProbe(surface, { id: 'economics', kind: 'graphic', status: measured ? 'ready' : 'pending',
      expectedCount: 2, ...(measured ? { actualCount: 2, layoutMeasured: true, accessibleSummary: true } : {}) }, open);
    return null;
  }
  const render = (open: boolean, measured = false) => <PerformanceAuditReadinessProvider registry={registry}>
    <Panels open={open} measured={measured} />
  </PerformanceAuditReadinessProvider>;
  let tree!: ReturnType<typeof TestRenderer.create>;
  act(() => { tree = TestRenderer.create(render(false)); });
  try {
    const snapshot = () => registry.snapshot(['outlook'], ['graphic']);
    expect(snapshot()).toMatchObject({ ready: true, requiredProbes: 1 });
    act(() => { tree.update(render(true)); });
    expect(snapshot()).toMatchObject({ ready: false, requiredProbes: 2 });
    act(() => { tree.update(render(true, true)); });
    expect(snapshot().ready).toBe(true);
    act(() => { tree.update(render(false)); });
    expect(snapshot().surfaces[0].probes.map(probe => probe.id)).toEqual(['history']);
    act(() => { tree.update(render(true)); });
    expect(snapshot()).toMatchObject({ ready: false, requiredProbes: 2 });
    expect(snapshot().surfaces[0].probes.find(probe => probe.id === 'economics'))
      .toMatchObject({ status: 'pending', actualCount: null, layoutMeasured: null, accessibleSummary: null });
  } finally { act(() => tree.unmount()); }
});

test.each(['rates.results', 'market.overview'] as const)(
  'retained %s owners follow actual focus and restore only the focused tree current evidence', async surfaceId => {
  const registry = new PerformanceAuditReadinessRegistry();
  registry.beginCapture('retained-rates');
  const actionId = surfaceId === 'rates.results' ? 'search.input.set' : 'changes.section.next';
  const olderAction = jest.fn(), newerAction = jest.fn();
  function RatesOwner({ focused, revision, measured, action }: {
    focused: boolean; revision: string; measured: boolean; action: () => void;
  }) {
    usePerformanceAuditSurface({ id: surfaceId, routeKey: surfaceId === 'rates.results' ? '/browse' : '/market',
      datasetRevision: revision, renderRevision: revision,
      actions: { [actionId]: action },
      probes: [
        { id: 'search.data', kind: 'data', status: 'ready', datasetRevision: revision },
        { id: 'search.list', kind: 'list', status: measured ? 'ready' : 'pending',
          expectedCount: 4, actualCount: measured ? 4 : 0, renderRevision: revision },
        { id: 'search.layout', kind: 'layout', status: measured ? 'ready' : 'pending',
          layoutMeasured: measured, renderRevision: revision },
      ] }, focused);
    return null;
  }
  const render = (focus: 'older' | 'newer' | 'none', olderRevision = 'old', measured = true) => (
    <PerformanceAuditReadinessProvider registry={registry}>
      <RatesOwner focused={focus === 'older'} revision={olderRevision} measured={measured} action={olderAction} />
      <RatesOwner focused={focus === 'newer'} revision="newer" measured action={newerAction} />
    </PerformanceAuditReadinessProvider>
  );
  let tree!: ReturnType<typeof TestRenderer.create>;
  act(() => { tree = TestRenderer.create(render('older')); });
  try {
    expect(registry.snapshot([surfaceId])).toMatchObject({ ready: true,
      surfaces: [{ datasetRevision: 'old', renderRevision: 'old' }] });
    await registry.invokeAction(surfaceId, actionId);
    expect(olderAction).toHaveBeenCalledTimes(1);
    act(() => { tree.update(render('newer')); });
    expect(registry.snapshot([surfaceId])).toMatchObject({ ready: true,
      surfaces: [{ datasetRevision: 'newer', renderRevision: 'newer' }] });
    await registry.invokeAction(surfaceId, actionId);
    expect(newerAction).toHaveBeenCalledTimes(1);

    // The retained older tree receives a new source/result while unfocused.
    act(() => { tree.update(render('newer', 'replacement', false)); });
    expect(registry.snapshot([surfaceId]).surfaces[0].datasetRevision).toBe('newer');
    act(() => { tree.update(render('older', 'replacement', false)); });
    const pending = registry.snapshot([surfaceId]);
    expect(pending.ready).toBe(false);
    expect(pending.surfaces[0]).toMatchObject({ datasetRevision: 'replacement', renderRevision: 'replacement' });
    expect(pending.surfaces[0].probes.find(probe => probe.id === 'search.list'))
      .toMatchObject({ status: 'pending', actualCount: 0 });
    expect(pending.surfaces[0].probes.find(probe => probe.id === 'search.layout'))
      .toMatchObject({ status: 'pending', layoutMeasured: false });
    act(() => { tree.update(render('older', 'replacement', true)); });
    expect(registry.snapshot([surfaceId]).ready).toBe(true);
    await registry.invokeAction(surfaceId, actionId);
    expect(olderAction).toHaveBeenCalledTimes(2);
    expect(newerAction).toHaveBeenCalledTimes(1);

    act(() => { tree.update(render('none', 'replacement')); });
    expect(registry.snapshot([surfaceId])).toMatchObject({ ready: false, surfaces: [] });
    act(() => { tree.update(render('older', 'replacement')); });
    expect(registry.snapshot([surfaceId]).ready).toBe(true);
  } finally { act(() => tree.unmount()); }
  expect(registry.snapshot([surfaceId]).surfaces).toEqual([]);
});
