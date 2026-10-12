import React from 'react';
import mockReact from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import BankDetail from '../app/bank/[provider]';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { openProduct } from '../src/lib/nav';
import { EMPTY_PROFILE } from '../src/data/profile';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import type { CorePayload, RateRow } from '../src/types';

type TestNode = { props: Record<string, any>; findByType: (type: any) => TestNode; findAllByType: (type: any) => TestNode[] };
type InspectableRenderer = ReactTestRenderer & { root: TestNode };

const mockRows: RateRow[] = Array.from({ length: 31 }, (_, index) => ({ provider: 'A',
  product_key: `loan-${index}`, product_name: `Loan ${index}`, rate: String(0.04 + index / 1000), rate_index: index }));
const mockCore = { run_date: '2026-10-13', sections: { Mortgage: { rates: mockRows },
  Savings: { rates: [] }, TD: { rates: [] } }, rba: [] } as unknown as CorePayload;
const mockState = { core: mockCore, coreIntegrity: null, manifest: null, details: null,
  prefs: { includeNonStandard: true, depositRankMetric: 'base', mortgageRateMetric: 'headline' },
  bankInsights: null, ensureBankInsights: jest.fn(), productHistoryError: null,
  productHistory: null, ensureProductHistory: jest.fn() };
let mockStart = 0;
const mockMountedProducts = jest.fn();
jest.mock('../src/data/store', () => ({ useStore: (select: (state: typeof mockState) => unknown) => select(mockState) }));
jest.mock('expo-router', () => ({ Stack: { Screen: 'StackScreen' },
  useRouter: () => ({ setParams: jest.fn() }), useLocalSearchParams: () => ({ provider: 'A' }) }));
jest.mock('@shopify/flash-list', () => ({ FlashList: ({ data, renderItem, ListHeaderComponent, ListFooterComponent, ...props }: any) =>
  mockReact.createElement('FlashList', { ...props, data }, ListHeaderComponent,
    ...data.slice(mockStart, mockStart + 4).map((item: any, index: number) =>
      mockReact.createElement(mockReact.Fragment, { key: item.row.product_key }, renderItem({ item, index }))),
    ListFooterComponent) }));
jest.mock('../src/components/ProductCard', () => ({ ProductCard: (props: any) => {
  mockMountedProducts(props.row.product_key); return mockReact.createElement('ProductCard', props);
} }));
jest.mock('../src/components/BankAvatar', () => ({ BankAvatar: 'BankAvatar' }));
jest.mock('../src/components/BankHistoryChart', () => ({ BankHistoryChart: 'BankHistoryChart' }));
jest.mock('../src/components/BankInsights', () => ({ BankMoveRow: 'BankMoveRow' }));
jest.mock('../src/components/ChartErrorBoundary', () => ({ ChartErrorBoundary: 'ChartErrorBoundary' }));
jest.mock('../src/components/feedback', () => ({ EmptyState: 'EmptyState', ScreenSkeleton: 'ScreenSkeleton' }));
jest.mock('../src/components/Screen', () => ({ Screen: 'Screen', DataHealthBannerStrip: 'DataHealthBannerStrip', responsiveScreenContentStyle: () => ({}) }));
jest.mock('../src/components/controls', () => ({ SegmentedControl: 'SegmentedControl' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Card: 'Card', Chip: 'Chip', Divider: 'Divider', Row: 'Row' }));
jest.mock('../src/hooks/usePerformanceAuditReadiness', () => ({ usePerformanceAuditSurface: jest.fn() }));
jest.mock('../src/hooks/useLogoReadiness', () => ({ useLogoReadiness: () => ({ ready: true, expectedCount: 1, terminalCount: 1, onLogoRenderStateChange: jest.fn() }) }));
jest.mock('../src/hooks/useSuitabilityRevision', () => ({ useSuitabilityRevision: () => 1 }));
jest.mock('../src/hooks/useBankRateHistory', () => ({ useBankRateHistory: () => ({ snapshots: null,
  updating: false, failed: false, historyAvailable: false, revision: 'disabled', missingDates: [] }) }));
jest.mock('../src/lib/proAccess', () => ({ effectiveBankInsights: () => false }));
jest.mock('../src/lib/nav', () => ({ openProduct: jest.fn() }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({}) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));

test('retains every lender product while mounting viewport cards and measuring the committed list', () => {
  installMandatoryEligibility(selectMandatoryEligibility(mockCore, EMPTY_PROFILE, null));
  mockStart = 0;
  mockMountedProducts.mockClear();
  let tree!: InspectableRenderer;
  act(() => { tree = TestRenderer.create(<BankDetail />) as InspectableRenderer; });
  const list = tree.root.findByType('FlashList' as any);
  expect(list.props.data).toHaveLength(31);
  expect(tree.root.findAllByType('ProductCard' as any)).toHaveLength(4);
  expect(new Set(mockMountedProducts.mock.calls.map(([key]) => key)).size).toBe(4);
  let audit = jest.mocked(usePerformanceAuditSurface).mock.calls.at(-1)![0];
  expect(audit.probes!.find(probe => probe.id === 'lender.products')!.status).toBe('pending');
  act(() => {
    list.props.onLoad();
    list.props.onViewableItemsChanged({ viewableItems: Array.from({ length: 4 }, () => ({ isViewable: true })) });
  });
  audit = jest.mocked(usePerformanceAuditSurface).mock.calls.at(-1)![0];
  expect(audit.probes!.find(probe => probe.id === 'lender.products')).toMatchObject({
    status: 'ready', expectedCount: 31, actualCount: 31, visibleCount: 4,
  });
  mockStart = 27;
  act(() => tree.update(<BankDetail />));
  const last = tree.root.findAllByType('ProductCard' as any).at(-1)!;
  expect(last.props.row).toBe(mockRows[30]);
  act(() => last.props.onPress());
  expect(openProduct).toHaveBeenLastCalledWith('loan-30', 30);
  act(() => tree.unmount());
  installMandatoryEligibility(selectMandatoryEligibility(null, EMPTY_PROFILE, null));
});
