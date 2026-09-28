import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import fixture from './fixtures/bankwest-easy-saver-eligibility-20260913.json';
import type { BankInsightsPayload } from '../src/data/bankInsights';
import type { BankRateSnapshot } from '../src/data/bankRateOverview';
import type { CorePayload, RateRow } from '../src/types';

type TestNode = {
  props: Record<string, any>;
  children: (TestNode | string)[];
  findAllByType: (type: string) => TestNode[];
};
type Renderer = ReactTestRenderer & { root: TestNode };

const [row] = fixture.rates as RateRow[];
const mockParams = { provider: row.provider };
const emptyRibbon = {
  counts: { rates: 0, products: 0, providers: 0 },
  range: { min: null, max: null, mean: null, median: null },
  providers: [],
};
const core: CorePayload = {
  schema_version: 1,
  run_date: '2026-09-28',
  sections: {
    Mortgage: { rates: [], ribbon: emptyRibbon },
    Savings: { rates: [row], ribbon: emptyRibbon },
    TD: { rates: [], ribbon: emptyRibbon },
  },
  brands: {},
  rba: [],
};
const mockTodayInsights: BankInsightsPayload = {
  schema_version: 1,
  run_date: core.run_date,
  run_dates: [core.run_date],
  banks: { [row.provider]: { Savings: { best: [0.05], median: [0.05], count: [1] } } },
  events: [],
};
const snapshots: Record<string, BankRateSnapshot> = {
  '2026-09-26': { Savings: { [row.provider]: { min: 3, max: 5, mean: 4, median: 4.25, count: 4 } } },
  '2026-09-27': { Savings: {} },
  '2026-09-28': { Savings: { [row.provider]: { min: 3.5, max: 5.5, mean: 4.5, median: 4.75, count: 4 } } },
};
const mockRateHistory = {
  snapshots: snapshots as Record<string, BankRateSnapshot> | null,
  historyAvailable: true,
  updating: false,
  failed: false,
  missingDates: [] as string[],
  revision: 'profile-1',
};
const mockState = {
  core,
  coreIntegrity: null,
  manifest: null,
  details: { products: { [row.product_key]: fixture.detail } },
  prefs: { includeNonStandard: true, depositRankMetric: 'base', mortgageRateMetric: 'comparison' },
  bankInsights: mockTodayInsights,
  productHistory: null,
  productHistoryError: null,
  ensureBankInsights: jest.fn(async () => undefined),
  ensureProductHistory: jest.fn(async () => undefined),
};

jest.mock('../src/data/store', () => ({ useStore: (select: (state: typeof mockState) => unknown) => select(mockState) }));
jest.mock('expo-router', () => ({
  Stack: { Screen: 'StackScreen' },
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ setParams: jest.fn() }),
}));
jest.mock('../src/components/BankAvatar', () => ({ BankAvatar: 'BankAvatar' }));
jest.mock('../src/components/BankHistoryChart', () => ({ BankHistoryChart: 'BankHistoryChart' }));
jest.mock('../src/components/BankInsights', () => ({ BankMoveRow: 'BankMoveRow' }));
jest.mock('../src/components/ChartErrorBoundary', () => ({ ChartErrorBoundary: 'ChartErrorBoundary' }));
jest.mock('../src/components/feedback', () => ({ EmptyState: 'EmptyState', ScreenSkeleton: 'ScreenSkeleton' }));
jest.mock('../src/components/ProductCard', () => ({ ProductCard: 'ProductCard' }));
jest.mock('../src/components/Screen', () => ({ ScreenScrollView: 'ScreenScrollView' }));
jest.mock('../src/components/controls', () => ({ SegmentedControl: 'SegmentedControl' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Card: 'Card', Chip: 'Chip', Divider: 'Divider', Row: 'Row' }));
jest.mock('../src/data/bankInsights', () => ({
  ...jest.requireActual('../src/data/bankInsights'),
  filterBankInsightsForSuitability: () => mockTodayInsights,
}));
jest.mock('../src/hooks/useBankRateHistory', () => ({ useBankRateHistory: () => mockRateHistory }));
jest.mock('../src/hooks/usePerformanceAuditReadiness', () => ({ usePerformanceAuditSurface: jest.fn() }));
jest.mock('../src/hooks/useLogoReadiness', () => ({
  useLogoReadiness: () => ({ ready: true, expectedCount: 1, terminalCount: 1, onLogoRenderStateChange: jest.fn() }),
}));
jest.mock('../src/hooks/useSuitabilityRevision', () => ({ useSuitabilityRevision: () => 1 }));
jest.mock('../src/lib/nav', () => ({ openProduct: jest.fn() }));
jest.mock('../src/lib/performanceAudit', () => ({ isPerformanceAuditActive: () => true }));
jest.mock('../src/lib/proAccess', () => ({ effectiveBankInsights: () => true }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: {} }) }));

// eslint-disable-next-line import/first -- route import must follow its store/UI mocks
import BankDetail from '../app/bank/[provider]';

function mount(): Renderer {
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(<BankDetail />) as Renderer; });
  return tree;
}
function copy(tree: Renderer): string {
  return tree.root.findAllByType('AppText').map(node => node.children.join('')).join('\n');
}

describe('bank detail profile-filtered history', () => {
  beforeEach(() => {
    Object.assign(mockRateHistory, {
      snapshots, historyAvailable: true, updating: false, failed: false, missingDates: [], revision: 'profile-1',
    });
  });

  it('retains earlier dates, full ranges and real statistics when the legacy aggregate only contains today', () => {
    const tree = mount();
    try {
      const chart = tree.root.findAllByType('BankHistoryChart')[0];
      expect(chart.props.section).toBe('Savings');
      expect(chart.props.dates).toEqual(['2026-09-26', '2026-09-27', '2026-09-28']);
      expect(chart.props.allDates).toEqual(chart.props.dates);
      expect(chart.props.points).toEqual([
        { date: '2026-09-26', min: 0.03, max: 0.05, mean: 0.04, median: 0.0425, count: 4 },
        { date: '2026-09-27', min: null, max: null, mean: null, median: null, count: 0 },
        { date: '2026-09-28', min: 0.035, max: 0.055, mean: 0.045, median: 0.0475, count: 4 },
      ]);
      expect(copy(tree)).toContain('Range, mean and median of this lender’s advertised rates matching your settings');
      expect(copy(tree)).not.toContain('sharpest offer to its typical rate');
    } finally { act(() => tree.unmount()); }
  });

  it.each(['updating', 'failed'] as const)('hides obsolete rates while the next profile history is %s', (state) => {
    const tree = mount();
    try {
      expect(tree.root.findAllByType('BankHistoryChart')).toHaveLength(1);
      mockRateHistory[state] = true;
      mockRateHistory.revision = 'profile-2';
      act(() => tree.update(<BankDetail />));
      expect(tree.root.findAllByType('BankHistoryChart')).toHaveLength(0);
      expect(copy(tree)).toContain(state === 'updating'
        ? 'Updating historical rates for your settings…'
        : 'Historical rates could not be prepared. Try refreshing the data.');
    } finally { act(() => tree.unmount()); }
  });

  it('does not revive legacy rates when the current profile has no historical matches', () => {
    mockRateHistory.snapshots = { '2026-09-28': { Savings: {} } };
    const tree = mount();
    try {
      expect(tree.root.findAllByType('BankHistoryChart')).toHaveLength(0);
    } finally { act(() => tree.unmount()); }
  });
});
