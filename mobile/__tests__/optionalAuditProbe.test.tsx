import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import {
  PerformanceAuditReadinessProvider,
  usePerformanceAuditProbe,
  usePerformanceAuditSurface,
} from '../src/hooks/usePerformanceAuditReadiness';
import { PerformanceAuditReadinessRegistry, type PerformanceAuditProbeStatus } from '../src/lib/performanceAuditReadiness';

function Economics({ open, status }: { open: boolean; status: PerformanceAuditProbeStatus }) {
  const surface = usePerformanceAuditSurface({ id: 'outlook.dashboard', probes: [
    { id: 'dashboard-data', kind: 'data', status: 'ready' },
    { id: 'dashboard-layout', kind: 'layout', status: 'ready', layoutMeasured: true },
  ] });
  usePerformanceAuditProbe(surface, {
    id: 'economic-data', kind: 'data', required: open, status,
    ...(status === 'error' ? { error: 'Economic signals are not saved on this device.' } : {}),
  }, open);
  return null;
}

test('closed optional economics has no probe and cannot block the action that opens it', () => {
  const registry = new PerformanceAuditReadinessRegistry();
  registry.beginCapture('optional-economics');
  const render = (open: boolean, status: PerformanceAuditProbeStatus = 'pending') => (
    <PerformanceAuditReadinessProvider registry={registry}><Economics open={open} status={status} /></PerformanceAuditReadinessProvider>
  );
  let tree!: ReturnType<typeof TestRenderer.create>;
  const snapshot = () => registry.snapshot(['outlook.dashboard'], ['data', 'layout']);
  act(() => { tree = TestRenderer.create(render(false)); });
  try {
    expect(snapshot().ready).toBe(true);
    expect(snapshot().surfaces[0].probes.some(probe => probe.id === 'economic-data')).toBe(false);
    act(() => tree.update(render(true)));
    expect(snapshot().ready).toBe(false);
    expect(snapshot().blockers).toEqual([expect.objectContaining({ probeId: 'economic-data' })]);
    act(() => tree.update(render(true, 'error')));
    expect(snapshot().blockers).toEqual([expect.objectContaining({ probeId: 'economic-data', code: 'probe-error' })]);
    act(() => tree.update(render(false, 'error')));
    expect(snapshot().ready).toBe(true);
    expect(snapshot().surfaces[0].probes.some(probe => probe.id === 'economic-data')).toBe(false);
  } finally { act(() => tree.unmount()); }
});
