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
