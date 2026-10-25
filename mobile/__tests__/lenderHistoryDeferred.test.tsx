import React from 'react';
import mockReact from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import BankDetail from '../app/bank/[provider]';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { EMPTY_PROFILE } from '../src/data/profile';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import type { CorePayload, RateRow } from '../src/types';

type TestNode = {
  props: Record<string, unknown>;
  findByType: (type: unknown) => TestNode;
  findAllByType: (type: unknown) => TestNode[];
};
type InspectableRenderer = ReactTestRenderer & { root: TestNode };

const mockRows: RateRow[] = Array.from({ length: 8 }, (_, index) => ({
  provider: 'A',
  product_key: `loan-${index}`,
  product_name: `Loan ${index}`,
  rate: String(0.04 + index / 1000),
  rate_index: index,
}));
const mockCore = {
  run_date: '2026-10-13',
  sections: {
    Mortgage: { rates: mockRows },
    Savings: { rates: [] },
    TD: { rates: [] },
  },
  rba: [],
} as unknown as CorePayload;
const mockState = {
  core: mockCore,
  coreIntegrity: null,
  manifest: null,
  details: null,
  prefs: { includeNonStandard: true, depositRankMetric: 'base', mortgageRateMetric: 'headline' },
  bankInsights: {
    run_dates: Array.from({ length: 40 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`),
    banks: {
      A: {
        Mortgage: {
          best: Array.from({ length: 40 }, () => 0.05),
          median: Array.from({ length: 40 }, () => 0.055),
          count: Array.from({ length: 40 }, () => 3),
        },
      },
    },
  },
  ensureBankInsights: jest.fn(),
  productHistoryError: null,
  productHistory: null,
  ensureProductHistory: jest.fn(),
};

let mockHistorySurfaceReady = false;
const mockUseBankRateHistory = jest.fn((_enabled?: boolean) => ({
  snapshots: null,
  updating: false,
  failed: false,
  historyAvailable: false,
  revision: 'disabled',
  missingDates: [],
}));

jest.mock('../src/data/store', () => ({
  useStore: (select: (state: typeof mockState) => unknown) => select(mockState),
}));
jest.mock('expo-router', () => ({
  Stack: { Screen: 'StackScreen' },
  useRouter: () => ({ setParams: jest.fn() }),
  useLocalSearchParams: () => ({ provider: 'A' }),
}));
jest.mock('@shopify/flash-list', () => ({
  FlashList: ({ data, renderItem, ListHeaderComponent, ListFooterComponent, ...props }: any) =>
    mockReact.createElement('FlashList', { ...props, data }, ListHeaderComponent,
      ...data.slice(0, 4).map((item: any, index: number) =>
        mockReact.createElement(mockReact.Fragment, { key: String(index) }, renderItem({ item, index }))),
      ListFooterComponent),
}));
jest.mock('../src/components/ProductCard', () => ({
  ProductCard: (props: any) => mockReact.createElement('ProductCard', props),
}));
jest.mock('../src/components/BankAvatar', () => ({ BankAvatar: 'BankAvatar' }));
jest.mock('../src/components/BankHistoryChart', () => ({ BankHistoryChart: 'BankHistoryChart' }));
jest.mock('../src/components/BankInsights', () => ({ BankMoveRow: 'BankMoveRow' }));
jest.mock('../src/components/ChartErrorBoundary', () => ({ ChartErrorBoundary: 'ChartErrorBoundary' }));
jest.mock('../src/components/feedback', () => ({
  EmptyState: 'EmptyState',
  ScreenSkeleton: 'ScreenSkeleton',
}));
jest.mock('../src/components/Screen', () => ({
  Screen: 'Screen',
  DataHealthBannerStrip: 'DataHealthBannerStrip',
  responsiveScreenContentStyle: () => ({}),
}));
jest.mock('../src/components/controls', () => ({ SegmentedControl: 'SegmentedControl' }));
jest.mock('../src/components/ui', () => ({
  AppText: 'AppText',
  Card: 'Card',
  Chip: 'Chip',
  Divider: 'Divider',
  Row: 'Row',
}));
jest.mock('../src/hooks/usePerformanceAuditReadiness', () => ({
  usePerformanceAuditSurface: jest.fn(),
}));
jest.mock('../src/hooks/useSuitabilityRevision', () => ({ useSuitabilityRevision: () => 1 }));
jest.mock('../src/hooks/useDeferredHistorySurface', () => ({
  useDeferredHistorySurface: () => mockHistorySurfaceReady,
}));
jest.mock('../src/hooks/useBankRateHistory', () => ({
  useBankRateHistory: (enabled?: boolean) => mockUseBankRateHistory(enabled),
}));
jest.mock('../src/lib/proAccess', () => ({ effectiveBankInsights: () => true }));
jest.mock('../src/lib/nav', () => ({ openProduct: jest.fn() }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({}) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));

beforeEach(() => {
  mockHistorySurfaceReady = false;
  mockUseBankRateHistory.mockClear();
  jest.mocked(usePerformanceAuditSurface).mockClear();
});

test('lender open keeps history disabled and omits BankHistoryChart until deferred surface is ready', () => {
  installMandatoryEligibility(selectMandatoryEligibility(mockCore, EMPTY_PROFILE, null));
  let tree!: InspectableRenderer;
  act(() => {
    tree = TestRenderer.create(<BankDetail />) as InspectableRenderer;
  });

  expect(mockUseBankRateHistory).toHaveBeenLastCalledWith(false);
  expect(tree.root.findAllByType('BankHistoryChart' as unknown)).toHaveLength(0);
  let audit = jest.mocked(usePerformanceAuditSurface).mock.calls.at(-1)![0];
  expect(audit.renderRevision).toContain('history-deferred');
  expect(audit.probes!.find((probe) => probe.id === 'lender.history-graphic')).toMatchObject({
    status: 'ready',
    required: false,
  });
  expect(audit.probes!.find((probe) => probe.id === 'lender.history-data')).toMatchObject({
    status: 'ready',
    required: false,
    actualCount: 0,
  });
  expect(audit.probes!.find((probe) => probe.id === 'lender.logo')).toMatchObject({
    expectedCount: 1,
  });

  mockHistorySurfaceReady = true;
  act(() => {
    tree.update(<BankDetail />);
  });
  expect(mockUseBankRateHistory).toHaveBeenLastCalledWith(true);
  expect(tree.root.findAllByType('BankHistoryChart' as unknown).length).toBeGreaterThan(0);
  audit = jest.mocked(usePerformanceAuditSurface).mock.calls.at(-1)![0];
  expect(audit.renderRevision).not.toContain('history-deferred');
  expect(audit.probes!.find((probe) => probe.id === 'lender.logo')).toMatchObject({
    expectedCount: 1,
  });

  act(() => {
    tree.unmount();
  });
  installMandatoryEligibility(selectMandatoryEligibility(null, EMPTY_PROFILE, null));
});
