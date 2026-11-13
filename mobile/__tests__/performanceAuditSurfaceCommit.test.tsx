import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { PerformanceAuditReadinessProvider, usePerformanceAuditProbe, usePerformanceAuditSurface,
  type PerformanceAuditSurfaceController } from '../src/hooks/usePerformanceAuditReadiness';
import { PerformanceAuditReadinessRegistry } from '../src/lib/performanceAuditReadiness';

test('audit registration does not render an expensive mounted screen twice', () => {
  const registry = new PerformanceAuditReadinessRegistry();
  registry.beginCapture('mounted-screen');
  let renders = 0;
  function Screen() {
    renders++;
    const surface = usePerformanceAuditSurface({ id: 'screen', probes: [
      { id: 'data', kind: 'data', status: 'ready' },
    ] });
    usePerformanceAuditProbe(surface, { id: 'layout', kind: 'layout', status: 'ready', layoutMeasured: true });
    return null;
  }
  let tree!: ReturnType<typeof TestRenderer.create>;
  act(() => { tree = TestRenderer.create(<PerformanceAuditReadinessProvider registry={registry}><Screen /></PerformanceAuditReadinessProvider>); });
  try {
    expect(registry.snapshot(['screen'])).toMatchObject({ ready: true, totalProbes: 2 });
    expect(renders).toBe(1);
  } finally { act(() => tree.unmount()); }
});

test('capture and enable transitions retire old controllers without publishing stale evidence', () => {
  const registry = new PerformanceAuditReadinessRegistry();
  let controller!: PerformanceAuditSurfaceController;
  const action = jest.fn();
  function Screen({ enabled = true, revision = 'one' }) {
    controller = usePerformanceAuditSurface({ id: 'screen', renderRevision: revision,
      actions: { run: action }, probes: [{ id: 'data', kind: 'data', status: 'ready' }] }, enabled);
    usePerformanceAuditProbe(controller, { id: 'layout', kind: 'layout', status: 'ready', layoutMeasured: true, renderRevision: revision });
    return null;
  }
  const render = (enabled = true, revision = 'one') => <PerformanceAuditReadinessProvider registry={registry}><Screen enabled={enabled} revision={revision} /></PerformanceAuditReadinessProvider>;
  let tree!: ReturnType<typeof TestRenderer.create>;
  act(() => { tree = TestRenderer.create(render()); });
  try {
    expect(controller.active).toBe(false);
    act(() => { registry.beginCapture('first'); });
    const first = controller;
    expect(registry.snapshot(['screen']).ready).toBe(true);
    expect(first.active).toBe(true);
    act(() => { registry.endCapture(); registry.beginCapture('second'); });
    expect(first.updateProbe('data', { status: 'error', error: 'stale' })).toBe(false);
    expect(first.getHandle()).toBeNull();
    expect(registry.snapshot(['screen']).ready).toBe(true);
    const second = controller;
    act(() => { tree.update(render(false)); });
    expect(second.active).toBe(false);
    expect(registry.snapshot(['screen']).surfaces).toEqual([]);
    act(() => { tree.update(render(true, 'two')); });
    expect(registry.snapshot(['screen'])).toMatchObject({ ready: true, surfaces: [{ renderRevision: 'two' }] });
    expect(second.setActions({ stale: jest.fn() })).toBe(false);
    expect(registry.snapshot(['screen']).surfaces[0].actions).toEqual(['run']);
  } finally { act(() => tree.unmount()); }
  expect(controller.getHandle()).toBeNull();
  expect(registry.snapshot(['screen']).surfaces).toEqual([]);
});

test('StrictMode replays registration without dropping child probes or leaking the retired owner', () => {
  const registry = new PerformanceAuditReadinessRegistry();
  registry.beginCapture('strict-screen');
  let controller!: PerformanceAuditSurfaceController;
  function Child({ surface }: { surface: PerformanceAuditSurfaceController }) {
    usePerformanceAuditProbe(surface, { id: 'layout', kind: 'layout', status: 'ready', layoutMeasured: true });
    return null;
  }
  function Screen() {
    controller = usePerformanceAuditSurface({ id: 'screen', probes: [{ id: 'data', kind: 'data', status: 'ready' }] });
    return <Child surface={controller} />;
  }
  let tree!: ReturnType<typeof TestRenderer.create>;
  act(() => { tree = TestRenderer.create(<React.StrictMode><PerformanceAuditReadinessProvider registry={registry}><Screen /></PerformanceAuditReadinessProvider></React.StrictMode>); });
  expect(registry.snapshot(['screen'])).toMatchObject({ ready: true, totalProbes: 2 });
  act(() => tree.unmount());
  expect(controller.active).toBe(false);
  expect(controller.updateProbe('data', { status: 'error' })).toBe(false);
  expect(registry.snapshot(['screen']).surfaces).toEqual([]);
});

test('an uncommitted transition cannot publish new actions or probe revisions', async () => {
  const registry = new PerformanceAuditReadinessRegistry();
  registry.beginCapture('concurrent-screen');
  const pending = new Promise<void>(() => {});
  const first = jest.fn(), abandoned = jest.fn();
  function Screen({ suspend = false }) {
    usePerformanceAuditSurface({ id: 'screen', renderRevision: suspend ? 'abandoned' : 'committed',
      actions: { run: suspend ? abandoned : first },
      probes: [{ id: 'data', kind: 'data', status: 'ready' }] });
    if (suspend) throw pending;
    return null;
  }
  const render = (suspend = false) => <React.Suspense fallback={null}><PerformanceAuditReadinessProvider registry={registry}><Screen suspend={suspend} /></PerformanceAuditReadinessProvider></React.Suspense>;
  let tree!: ReturnType<typeof TestRenderer.create>;
  await act(async () => { tree = TestRenderer.create(render()); });
  try {
    await act(async () => { React.startTransition(() => tree.update(render(true))); });
    expect(registry.snapshot(['screen']).surfaces[0].renderRevision).toBe('committed');
    await registry.invokeAction('screen', 'run');
    expect(first).toHaveBeenCalledTimes(1);
    expect(abandoned).not.toHaveBeenCalled();
  } finally { act(() => tree.unmount()); }
});

test('replacing a child probe ID removes only the previously registered probe', () => {
  const registry = new PerformanceAuditReadinessRegistry();
  registry.beginCapture('replace-probe');
  function Screen({ probeId }: { probeId: string }) {
    const surface = usePerformanceAuditSurface({ id: 'screen' });
    usePerformanceAuditProbe(surface, { id: probeId, kind: 'data', status: 'ready' });
    return null;
  }
  const render = (probeId: string) => <PerformanceAuditReadinessProvider registry={registry}><Screen probeId={probeId} /></PerformanceAuditReadinessProvider>;
  let tree!: ReturnType<typeof TestRenderer.create>;
  act(() => { tree = TestRenderer.create(render('old')); });
  try {
    act(() => tree.update(render('current')));
    expect(registry.snapshot(['screen']).surfaces[0].probes.map(probe => probe.id)).toEqual(['current']);
  } finally { act(() => tree.unmount()); }
});

test('replaced declarative probes retire without removing independently mounted child probes', () => {
  const registry = new PerformanceAuditReadinessRegistry();
  registry.beginCapture('replace-inline-probe');
  function Screen({ replaced = false, removed = false }) {
    const surface = usePerformanceAuditSurface({ id: 'screen', probes: removed ? [] : [
      { id: replaced ? 'current' : 'old', kind: 'data', status: replaced ? 'ready' : 'pending' },
    ] });
    usePerformanceAuditProbe(surface, { id: 'child', kind: 'layout', status: 'ready', layoutMeasured: true });
    return null;
  }
  const render = (replaced = false, removed = false) => <PerformanceAuditReadinessProvider registry={registry}><Screen replaced={replaced} removed={removed} /></PerformanceAuditReadinessProvider>;
  let tree!: ReturnType<typeof TestRenderer.create>;
  act(() => { tree = TestRenderer.create(render()); });
  try {
    expect(registry.snapshot(['screen']).ready).toBe(false);
    act(() => tree.update(render(true)));
    expect(registry.snapshot(['screen'])).toMatchObject({ ready: true, totalProbes: 2 });
    expect(registry.snapshot(['screen']).surfaces[0].probes.map(probe => probe.id).sort()).toEqual(['child', 'current']);
    act(() => tree.update(render(true, true)));
    expect(registry.snapshot(['screen']).surfaces[0].probes.map(probe => probe.id)).toEqual(['child']);
    act(() => { registry.endCapture(); registry.beginCapture('replacement-capture'); });
    expect(registry.snapshot(['screen'])).toMatchObject({ ready: true, totalProbes: 1 });
  } finally { act(() => tree.unmount()); }
});
