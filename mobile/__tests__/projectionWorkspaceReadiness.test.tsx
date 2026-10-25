import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { normalizeUserRateScenario } from '../src/data/userRateScenario';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { publicComparisonCore } from '../src/data/publicRateIntegration';

const mockScenario = normalizeUserRateScenario({ mortgage: { mode: 'refi', loanBalance: '600000', currentRate: '6.4', years: '28' } });
mockScenario.projections.mortgage.holdVariableRate = true;
const mockCore = { run_date: '2026-10-21', sections: {} };
jest.mock('../src/data/store', () => ({ useStore: (select: (value: unknown) => unknown) => select({ core: mockCore, prefs: {}, activeSection: 'Mortgage' }) }));
jest.mock('expo-router', () => ({ router: { setParams: jest.fn() }, useLocalSearchParams: () => ({}) }));
jest.mock('../src/hooks/useScenarioSection', () => ({ useScenarioSection: () => ['Mortgage'] }));
jest.mock('../src/hooks/useSuitabilityRevision', () => ({ useSuitabilityRevision: () => 0 }));
jest.mock('../src/hooks/useUserRateScenario', () => ({ useUserRateScenario: () => ({ scenario: mockScenario, storageStatus: 'ready', update: jest.fn() }) }));
jest.mock('../src/data/publicRateCatalogue', () => ({ usePublicRateCatalogue: () => ({ status: 'unavailable', references: [] }) }));
jest.mock('../src/data/publicRateIntegration', () => ({
  ...jest.requireActual('../src/data/publicRateIntegration'),
  resolveLocalCurrentRate: () => ({ status: 'exact', payableRate: '0.064' }),
  publicComparisonCore: jest.fn(() => mockCore),
}));
const mockUseResolvedPublicRankingRows = jest.fn((_options?: unknown) => ({
  ready: true,
  candidates: [],
  resolution: { rows: [], priced: 0, unresolved: 0, complete: true },
  mortgageScope: { rows: [], unverified: 0, unverifiedRows: new WeakSet(), invalid: false },
}));
jest.mock('../src/hooks/useResolvedPublicRankingRows', () => ({
  useResolvedPublicRankingRows: (options: unknown) => mockUseResolvedPublicRankingRows(options),
}));
jest.mock('../src/hooks/usePerformanceAuditReadiness', () => ({ usePerformanceAuditSurface: jest.fn() }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: {}, radius: { md: 8 }, font: { body: 16 }, spacing: (value: number) => value }) }));
jest.mock('../src/components/Screen', () => ({ ScreenScrollView: 'ScreenScrollView' }));
jest.mock('../src/components/controls', () => ({ CompactToggle: 'CompactToggle', SegmentedControl: 'SegmentedControl' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Badge: 'Badge', Button: 'Button', Card: 'Card', Chip: 'Chip', Row: 'Row' }));
jest.mock('../src/components/icons/AppIcon', () => 'Icon');
jest.mock('../src/components/calculation/SelectedCalculationTarget', () => ({ SelectedCalculationTarget: () => null }));
jest.mock('../src/components/calculation/ProjectionFactRows', () => ({ ProjectionFactRows: () => null }));
jest.mock('../src/components/projections/LifecycleChart', () => ({ LifecycleChart: () => null }));
jest.mock('../src/components/scenario/ProjectionSummary', () => ({ ProjectionSummary: () => null }));
jest.mock('../src/components/scenario/StaySwitchChart', () => ({ StaySwitchChart: () => null }));
jest.mock('../src/components/scenario/LocalRateEditor', () => ({ LocalRateEditor: () => null }));
jest.mock('../src/components/scenario/PublicRateEvidence', () => ({ PublicRateEvidence: () => null }));
jest.mock('../src/components/scenario/PublicCostComparison', () => ({ PublicCostComparison: () => null }));
jest.mock('../src/components/scenario/SavingsQualificationEditor', () => ({ SavingsQualificationEditor: () => null }));

// eslint-disable-next-line import/first -- native dependencies use the mocks above
import { ProjectionWorkspace } from '../src/components/calculation/ProjectionWorkspace';

test('a settled calculation copy does not block the next mounted projection action', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(<ProjectionWorkspace />); });
  try {
    expect(mockUseResolvedPublicRankingRows).toHaveBeenCalledWith(
      expect.objectContaining({ candidates: [] }),
    );
    const calls = jest.mocked(usePerformanceAuditSurface).mock.calls;
    const surface = calls.filter(([definition]) => definition.id === 'projections.lifecycle-chart').at(-1)![0];
    expect(surface.probes!.find(probe => probe.id === 'projections.model')).toMatchObject({ status: 'ready', error: null });
    let result: unknown;
    act(() => { result = surface.actions!['projections.metric.next'](); });
    expect(result).toBeUndefined();
    const changed = jest.mocked(usePerformanceAuditSurface).mock.calls.filter(([definition]) => definition.id === 'projections.lifecycle-chart').at(-1)![0];
    expect(changed.renderRevision).not.toBe(surface.renderRevision);
    expect(publicComparisonCore).not.toHaveBeenCalled();
  } finally { act(() => tree.unmount()); }
});
