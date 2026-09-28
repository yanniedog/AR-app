import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import Research from '../app/research';
import { DEFAULT_PREFS as mockDefaultPrefs } from '../src/data/storeTypes';
import { buildDeepPerformanceAuditPlan } from '../src/lib/performanceAuditPlan';
import type { PerformanceAuditSurfaceDefinition } from '../src/lib/performanceAuditReadiness';

const mockNavigate = jest.fn();
const mockSurfaces = new Map<string, PerformanceAuditSurfaceDefinition>();
jest.mock('expo-router', () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
  useLocalSearchParams: () => ({}),
}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => false, useScrollToTop: () => undefined }));
jest.mock('../src/data/store', () => ({
  useStore: (selector: (state: unknown) => unknown) => selector({ core: null, prefs: mockDefaultPrefs }),
}));
jest.mock('../src/hooks/useSuitabilityRevision', () => ({ useSuitabilityRevision: () => 0 }));
jest.mock('../src/hooks/usePerformanceAuditReadiness', () => ({
  usePerformanceAuditSurface: (surface: PerformanceAuditSurfaceDefinition) => {
    mockSurfaces.set(surface.id, surface);
    return {};
  },
  usePerformanceAuditProbe: () => undefined,
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
jest.mock('../src/components/ui', () => ({}));
jest.mock('../src/components/viz/HistoryExplorer', () => ({ HistoryExplorer: 'HistoryExplorer' }));

beforeEach(() => { mockNavigate.mockClear(); mockSurfaces.clear(); });

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
