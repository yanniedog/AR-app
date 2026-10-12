import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import Research from '../app/research';
import { DEFAULT_PREFS as mockDefaultPrefs } from '../src/data/storeTypes';
import { buildDeepPerformanceAuditPlan } from '../src/lib/performanceAuditPlan';
import { compactPerformanceAuditReadinessEvidence, PerformanceAuditReadinessRegistry, type PerformanceAuditSurfaceDefinition } from '../src/lib/performanceAuditReadiness';
import { appHealthDisplayObservations } from '../src/lib/performanceAuditHealth';
import { evaluateAppHealthDisplayQuality } from '../src/lib/appHealth/displayQuality';
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
    return { surfaceId: surface.id };
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
  const economicData = () => jest.mocked(usePerformanceAuditProbe).mock.calls.filter(call => call[1].id === 'economic-data').at(-1)!;
  const toggle = () => tree.root.findAll(node => node.props.title === 'What is shaping rates')[0].props.onToggle();
  try {
    expect(economics()[2]).toBe(false);
    expect(economicData()[2]).toBe(false);
    await act(async () => { await mockSurfaces.get('outlook.dashboard')!.actions!['outlook.history.mode.spread'](); });
    expect(economics()[2]).toBe(false);
    act(toggle);
    expect(economics()[2]).toBe(true);
    expect(economicData()[2]).toBe(true);
    expect(economicData()[1]).toMatchObject({ required: true, status: 'pending' });
    expect(economics()[1]).toMatchObject({ required: true, status: 'pending', layoutMeasured: false });
    act(() => { tree.root.findAll(node => node.type === 'RbaOutlook')[0].props.onAuditStateChange({
      status: 'ready', expectedCount: 2, pointCount: 2, layoutMeasured: true, graphicReady: true, accessibleSummary: true,
    }); });
    expect(economics()[1]).toMatchObject({ status: 'ready', actualCount: 2 });
    act(toggle);
    expect(economics()[2]).toBe(false);
    act(toggle);
    expect(economics()[1]).toMatchObject({ status: 'pending', actualCount: 0, layoutMeasured: false });
  } finally { act(() => tree.unmount()); }
});

test('missing economics keeps its optional data error while a measured empty graphic is unavailable', () => {
  mockCore = makeHealthyCore();
  let tree!: InspectableRenderer;
  act(() => { tree = TestRenderer.create(<Research />) as InspectableRenderer; });
  try {
    act(() => tree.root.findAll(node => node.props.title === 'What is shaping rates')[0].props.onToggle());
    act(() => tree.root.findAll(node => node.type === 'RbaOutlook')[0].props.onAuditStateChange({
      status: 'error', error: 'Economic signals are not saved on this device.', indicatorCount: 0,
      expectedCount: 0, pointCount: 0, layoutMeasured: true, emptyStateRendered: true,
      graphicReady: true, accessibleSummary: true,
    }));
    const probes = ['economic-graphics', 'economic-data'].map(id =>
      jest.mocked(usePerformanceAuditProbe).mock.calls.filter(call => call[1].id === id).at(-1)![1]);
    const registry = new PerformanceAuditReadinessRegistry();
    registry.beginCapture('economic-unavailable');
    const economyStep = buildDeepPerformanceAuditPlan(mockCore).passes[0].steps
      .find(step => step.semanticActionId === 'outlook.economy.lens.next')!;
    expect(economyStep.expectedSurface).toBe('outlook.economy');
    for (const id of ['economic-graphics', 'economic-data']) {
      const registration = jest.mocked(usePerformanceAuditProbe).mock.calls
        .filter(call => call[1].id === id).at(-1)!;
      expect(registration[0].surfaceId).toBe(economyStep.expectedSurface);
    }
    registry.registerSurface({ id: economyStep.expectedSurface, probes });
    const snapshot = registry.snapshot([economyStep.expectedSurface]);
    expect(snapshot.ready).toBe(false);
    expect(snapshot.blockers).toEqual([expect.objectContaining({ code: 'probe-error', probeId: 'economic-data' })]);
    const observations = appHealthDisplayObservations([{
      id: 'economy', kind: 'journey', label: 'Economy', status: 'skipped', durationMs: null,
      metrics: { readinessEvidence: compactPerformanceAuditReadinessEvidence(snapshot) },
    }]);
    const chart = evaluateAppHealthDisplayQuality([
      { id: economyStep.expectedSurface, requiredRoles: ['chart'] },
    ], observations).find(check => check.id === 'display-chart');
    expect(chart).toMatchObject({ status: 'unavailable', metrics: { failed: 0, unavailable: 1 } });
  } finally { act(() => tree.unmount()); }
});

test('uncached economics cannot block the mounted market browse action', async () => {
  mockCore = makeHealthyCore();
  let tree!: InspectableRenderer;
  act(() => { tree = TestRenderer.create(<Research />) as InspectableRenderer; });
  try {
    act(() => tree.root.findAll(node => node.props.title === 'What is shaping rates')[0].props.onToggle());
    act(() => tree.root.findAll(node => node.type === 'RbaOutlook')[0].props.onAuditStateChange({
      status: 'error', error: 'Economic signals are not saved on this device.', indicatorCount: 0,
      expectedCount: 0, pointCount: 0, layoutMeasured: true, emptyStateRendered: true,
      graphicReady: true, accessibleSummary: true,
    }));
    const latestProbes = new Map(jest.mocked(usePerformanceAuditProbe).mock.calls
      .filter(call => call[2] !== false)
      .map(call => [`${call[0].surfaceId}:${call[1].id}`, call]));
    const registry = new PerformanceAuditReadinessRegistry();
    registry.beginCapture('browse-after-uncached-economics');
    for (const surface of mockSurfaces.values()) {
      const probes = [...latestProbes.values()]
        .filter(call => call[0].surfaceId === surface.id).map(call => call[1]);
      registry.registerSurface({ ...surface, probes });
    }
    expect(registry.snapshot(['outlook.economy']).blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'probe-error', probeId: 'economic-data' }),
    ]));
    // Other missing mock chart assets may remain pending, but economics is not
    // among the dashboard's data prerequisites or terminal failures.
    const dashboard = registry.snapshot(['outlook.dashboard'], undefined, ['data', 'layout']);
    expect(dashboard.surfaces[0].probes.some(probe => probe.id.startsWith('economic-'))).toBe(false);
    expect(dashboard.blockers.some(blocker => blocker.code === 'probe-error')).toBe(false);
    const result = await registry.invokeAction('outlook.dashboard', 'outlook.snapshot.browse.first', { section: 'Mortgage' });
    expect(result).toEqual({ expectedPath: '/categories' });
    expect(mockNavigate).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/categories' }));
  } finally { act(() => tree.unmount()); }
});

test('economic view changes update the scoped surface and probes independently of market-history state', () => {
  mockCore = makeHealthyCore();
  let tree!: InspectableRenderer;
  act(() => { tree = TestRenderer.create(<Research />) as InspectableRenderer; });
  try {
    act(() => tree.root.findAll(node => node.props.title === 'What is shaping rates')[0].props.onToggle());
    const reportEconomicRender = (renderRevision: string, graphicReady: boolean) => act(() => {
      tree.root.findAll(node => node.type === 'RbaOutlook')[0].props.onAuditStateChange({
        status: graphicReady ? 'ready' : 'pending', revision: 'cached-economic-edition', renderRevision,
        indicatorCount: 1, expectedCount: 2, pointCount: 2, layoutMeasured: graphicReady,
        emptyStateRendered: false, graphicReady, accessibleSummary: graphicReady,
      });
    });
    reportEconomicRender('cached-economic-edition:policy:5Y:0', true);
    const marketRevision = mockSurfaces.get('outlook.dashboard')!.renderRevision;
    const before = mockSurfaces.get('outlook.economy')!.renderRevision;
    reportEconomicRender('cached-economic-edition:policy:All:0', false);
    const surface = mockSurfaces.get('outlook.economy')!;
    expect(surface.renderRevision).not.toBe(before);
    expect(mockSurfaces.get('outlook.dashboard')!.renderRevision).toBe(marketRevision);
    expect(mockSurfaces.get('outlook.dashboard')!.actions!['outlook.economy.window.next']).toBeUndefined();
    const graphic = () => jest.mocked(usePerformanceAuditProbe).mock.calls
      .filter(call => call[1].id === 'economic-graphics').at(-1)![1];
    expect(graphic()).toMatchObject({ status: 'pending', renderRevision: surface.renderRevision, layoutMeasured: false });
    reportEconomicRender('cached-economic-edition:policy:All:0', true);
    expect(graphic()).toMatchObject({ status: 'ready', renderRevision: surface.renderRevision, layoutMeasured: true });
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
