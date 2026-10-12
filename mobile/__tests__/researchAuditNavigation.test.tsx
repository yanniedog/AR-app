import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import Research from '../app/research';
import { DEFAULT_PREFS as mockDefaultPrefs } from '../src/data/storeTypes';
import { buildDeepPerformanceAuditPlan } from '../src/lib/performanceAuditPlan';
import { PerformanceAuditReadinessRegistry, type PerformanceAuditSurfaceDefinition } from '../src/lib/performanceAuditReadiness';
import { usePerformanceAuditProbe } from '../src/hooks/usePerformanceAuditReadiness';
import { makeHealthyCore } from '../__fixtures__/appHealth';
import type { CorePayload } from '../src/types';

type TestNode = { type: unknown; props: Record<string, any>; findAll: (predicate: (node: TestNode) => boolean) => TestNode[] };
type InspectableRenderer = ReturnType<typeof TestRenderer.create> & { root: TestNode };

const mockNavigate = jest.fn();
const mockSurfaces = new Map<string, PerformanceAuditSurfaceDefinition>();
let mockCore: CorePayload | null = null;
jest.mock('expo-router', () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
  useLocalSearchParams: () => ({}),
}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => false, useScrollToTop: () => undefined }));
jest.mock('../src/data/store', () => ({
  useStore: (selector: (state: unknown) => unknown) => selector({ core: mockCore, prefs: mockDefaultPrefs }),
}));
jest.mock('../src/hooks/useSuitabilityRevision', () => ({ useSuitabilityRevision: () => 0 }));
jest.mock('../src/hooks/usePerformanceAuditReadiness', () => ({
  usePerformanceAuditSurface: (surface: PerformanceAuditSurfaceDefinition) => {
    mockSurfaces.set(surface.id, surface);
    return {};
  },
  usePerformanceAuditProbe: jest.fn(),
}));
jest.mock('../src/lib/degradationLog', () => ({
  markDrillAttempt: () => undefined, logNavDrillAttempt: () => undefined, runStoreRetry: jest.fn(),
}));
jest.mock('../src/components/charts', () => ({ RbaChart: 'RbaChart' }));
jest.mock('../src/components/controls', () => ({ SegmentedControl: 'SegmentedControl' }));
jest.mock('../src/components/feedback', () => ({ ScreenSkeleton: 'ScreenSkeleton' }));
jest.mock('../src/components/RbaCountdownCard', () => ({ RbaCountdownCard: 'RbaCountdownCard' }));
jest.mock('../src/components/RbaOutlook', () => ({ RbaOutlook: 'RbaOutlook' }));
jest.mock('../src/components/Ribbon', () => ({ Ribbon: 'Ribbon' }));
jest.mock('../src/components/Screen', () => ({ ScreenScrollView: 'ScreenScrollView' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Disclosure: 'Disclosure', Divider: 'Divider', Row: 'Row' }));
jest.mock('../src/components/viz/HistoryExplorer', () => ({ HistoryExplorer: 'HistoryExplorer' }));

beforeEach(() => { mockCore = null; mockNavigate.mockClear(); mockSurfaces.clear(); jest.mocked(usePerformanceAuditProbe).mockClear(); });

test.each(['Mortgage', 'Savings', 'TD'])('the research audit route override matches the real %s category navigation', async (section) => {
  let tree!: ReturnType<typeof TestRenderer.create>;
  act(() => { tree = TestRenderer.create(<Research />); });
  try {
    const actionId = 'outlook.snapshot.browse.first';
    const action = mockSurfaces.get('outlook.dashboard')!.actions![actionId];
    const result = await action({ section }) as { expectedPath: string };
    const step = buildDeepPerformanceAuditPlan(null).passes[0].steps.find(item => item.semanticActionId === actionId)!;
    const href = mockNavigate.mock.calls.at(-1)![0];
    // The runner trusts the mounted action's override before the plan. Check
    // both against the actual shared navigation helper, not another mock URL.
    expect(result.expectedPath).toBe(href.pathname);
    expect(result.expectedPath).toBe(step.expectedPath);
    expect(result.expectedPath).toBe('/categories');
    expect(step.expectedSurface).toBe('browse.hierarchy');
  } finally { act(() => tree.unmount()); }
});

test('closed economics does not register graphic readiness and reopening requires fresh evidence', async () => {
  mockCore = makeHealthyCore();
  let tree!: InspectableRenderer;
  act(() => { tree = TestRenderer.create(<Research />) as InspectableRenderer; });
  const economics = () => jest.mocked(usePerformanceAuditProbe).mock.calls.filter(call => call[1].id === 'economic-graphics').at(-1)!;
  const toggle = () => tree.root.findAll(node => node.props.title === 'What is shaping rates')[0].props.onToggle();
  try {
    expect(economics()[2]).toBe(false);
    await act(async () => { await mockSurfaces.get('outlook.dashboard')!.actions!['outlook.history.mode.spread'](); });
    expect(economics()[2]).toBe(false);
    act(toggle);
    expect(economics()[2]).toBe(true);
    expect(economics()[1]).toMatchObject({ required: true, status: 'pending', layoutMeasured: false });
    act(() => { tree.root.findAll(node => node.type === 'RbaOutlook')[0].props.onAuditStateChange({
      status: 'ready', expectedCount: 2, pointCount: 2, layoutMeasured: true, accessibleSummary: true,
    }); });
    expect(economics()[1]).toMatchObject({ status: 'ready', actualCount: 2 });
    act(toggle);
    expect(economics()[2]).toBe(false);
    act(toggle);
    expect(economics()[1]).toMatchObject({ status: 'pending', actualCount: 0, layoutMeasured: false });
  } finally { act(() => tree.unmount()); }
});

test('the RBA action opens and verifies its own chart rather than the ready market history', async () => {
  mockCore = makeHealthyCore();
  let tree!: InspectableRenderer;
  act(() => { tree = TestRenderer.create(<Research />) as InspectableRenderer; });
  const graphic = () => jest.mocked(usePerformanceAuditProbe).mock.calls.filter(call => call[1].id === 'rba-graphic').at(-1)![1];
  const step = buildDeepPerformanceAuditPlan(mockCore).passes[0].steps
    .find(item => item.semanticActionId === 'outlook.rba-response.decision.previous')!;
  const registry = new PerformanceAuditReadinessRegistry();
  registry.beginCapture('rba-own-evidence');
  registry.registerSurface({ id: 'outlook.dashboard', probes: [{ id: 'history', kind: 'graphic', status: 'ready',
    expectedCount: 85, actualCount: 85, layoutMeasured: true, accessibleSummary: true }] });
  try {
    expect(step.expectedSurface).toBe('outlook.rba-response');
    expect(step.readiness).toContain('graphics');
    // The runner chooses an action on the planned surface when several surfaces
    // on the current route expose the same action name.
    await act(async () => { await mockSurfaces.get(step.expectedSurface)!.actions![step.semanticActionId](); });
    expect(graphic()).toMatchObject({ required: true, status: 'pending', layoutMeasured: false });
    const rbaSurface = registry.registerSurface({ id: step.expectedSurface, probes: [graphic()] })!;
    expect(registry.snapshot(['outlook.dashboard'], ['graphic']).ready).toBe(true);
    expect(registry.snapshot([step.expectedSurface], ['graphic']).ready).toBe(false);
    act(() => { tree.root.findAll(node => node.type === 'RbaChart')[0].props.onGraphicReady({
      revision: `${mockCore!.rba.at(-1)!.date}:0:measured`, expectedCount: 1, pointCount: 1,
      layoutMeasured: true, accessibleSummary: true, emptyStateRendered: false,
    }); });
    registry.upsertProbe(rbaSurface, graphic());
    expect(registry.snapshot([step.expectedSurface], ['graphic']).ready).toBe(true);
    await act(async () => { await mockSurfaces.get(step.expectedSurface)!.actions![step.semanticActionId](); });
    registry.upsertProbe(rbaSurface, graphic());
    expect(registry.snapshot([step.expectedSurface], ['graphic']).ready).toBe(false);
  } finally { act(() => tree.unmount()); }
});
