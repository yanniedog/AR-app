import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import type { CorePayload, RateRow } from '../src/types';

type TestNode = {
  props: Record<string, any>;
  findAllByProps: (props: Record<string, unknown>) => TestNode[];
  findAllByType: (type: string) => TestNode[];
  findByProps: (props: Record<string, unknown>) => TestNode;
};
type InspectableRenderer = ReactTestRenderer & { root: TestNode };

const row: RateRow = {
  provider: 'Example Bank',
  product_key: 'product:v1:ambiguous',
  product_id: 'product:v1:ambiguous',
  product_name: 'Ambiguous tier product',
  rate: '0.05',
  exact_alert_eligible: false,
};
const emptyRibbon = {
  counts: { rates: 1, products: 1, providers: 1 },
  range: { min: 0.05, max: 0.05, mean: 0.05, median: 0.05 },
  providers: [],
};
const core: CorePayload = {
  schema_version: 1,
  run_date: '2026-08-15',
  sections: {
    Mortgage: { rates: [row], ribbon: emptyRibbon },
    Savings: { rates: [], ribbon: { ...emptyRibbon, counts: { rates: 0, products: 0, providers: 0 } } },
    TD: { rates: [], ribbon: { ...emptyRibbon, counts: { rates: 0, products: 0, providers: 0 } } },
  },
  brands: {},
  rba: [],
};
const toggleSavedRate = jest.fn((_row: RateRow, scope?: 'rate' | 'product') => {
  if (scope !== 'product') throw new Error('ineligible exact save reached the store');
});
const mockState: Record<string, any> = {
  core,
  coreIntegrity: null,
  manifest: null,
  details: null,
  savedRates: [],
  toggleSavedRate,
  notificationsEnabled: false,
  prefs: {
    includeNonStandard: true,
    depositRankMetric: 'base',
    mortgageRateMetric: 'comparison',
  },
  isProductSubscribed: () => false,
  subscribeProduct: jest.fn(),
  unsubscribeProduct: jest.fn(),
  setPref: jest.fn(),
  historyBanks: null,
  bankInsights: null,
  bankInsightsError: null,
  productHistory: null,
  productHistoryError: null,
  ensureDetails: jest.fn(async () => undefined),
  ensureHistoryBanks: jest.fn(async () => undefined),
  ensureBankInsights: jest.fn(async () => undefined),
  ensureProductHistory: jest.fn(async () => undefined),
};

jest.mock('../src/data/store', () => ({
  useStore: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  Stack: { Screen: 'StackScreen' },
  useLocalSearchParams: () => ({ key: row.product_key }),
}));
jest.mock('../src/components/BankAvatar', () => ({ BankAvatar: 'BankAvatar' }));
jest.mock('../src/components/AppNavigationMenu', () => ({ NavigationMenuButton: 'NavigationMenuButton' }));
jest.mock('../src/components/BankHistoryChart', () => ({ BankHistoryChart: 'BankHistoryChart' }));
jest.mock('../src/components/ChartErrorBoundary', () => ({ ChartErrorBoundary: 'ChartErrorBoundary' }));
jest.mock('../src/components/feedback', () => ({ EmptyState: 'EmptyState' }));
jest.mock('../src/components/product/ProductRateChangeLine', () => ({ ProductRateChangeLine: 'ProductRateChangeLine' }));
jest.mock('../src/components/product/ProductDetailParts', () => ({
  AccessNotice: 'AccessNotice',
  DetailGroup: 'DetailGroup',
  HistoryLegend: 'HistoryLegend',
  OfficialLinks: 'OfficialLinks',
  ProductFacts: 'ProductFacts',
  ProductRatesList: 'ProductRatesList',
  ProductSpecs: 'ProductSpecs',
  SectionTitle: 'SectionTitle',
}));
jest.mock('../src/components/Screen', () => ({ ScreenScrollView: 'ScreenScrollView' }));
jest.mock('../src/components/ui', () => ({
  AppText: 'AppText', Button: 'Button', Card: 'Card', IconButton: 'IconButton', Row: 'Row',
}));
jest.mock('../src/components/scenario/StaySwitchChart', () => ({ StaySwitchChart: 'StaySwitchChart' }));
jest.mock('../src/data/bankInsights', () => ({ filterBankInsightsForSuitability: () => null }));
jest.mock('../src/data/historySelectors', () => ({ selectBankHistoryChartModel: () => null }));
jest.mock('../src/data/notifications', () => ({ ensurePermissions: jest.fn(async () => true) }));
jest.mock('../src/data/rateReceipt', () => ({ buildRateReceipt: () => null, buildNegotiationBrief: () => null }));
jest.mock('../src/data/staySwitchProjection', () => ({ buildStaySwitchProjection: () => null }));
jest.mock('../src/hooks/usePerformanceAuditReadiness', () => ({ usePerformanceAuditSurface: jest.fn() }));
jest.mock('../src/hooks/useLogoReadiness', () => ({
  useLogoReadiness: () => ({ ready: true, expectedCount: 1, terminalCount: 1, onLogoRenderStateChange: jest.fn() }),
}));
jest.mock('../src/hooks/useSuitabilityRevision', () => ({ useSuitabilityRevision: () => 1 }));
jest.mock('../src/hooks/useUserRateScenario', () => ({
  useUserRateScenario: () => ({
    scenario: { currentProducts: { mortgage: { provider: null, productKey: null } } },
  }),
}));
jest.mock('../src/lib/nav', () => ({ openBank: jest.fn(), openRateReceipt: jest.fn() }));
jest.mock('../src/lib/proAccess', () => ({ effectiveBankInsights: () => false, effectiveHistoryRibbon: () => false }));
jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: { success: '#0a0', primary: '#00a', warning: '#fa0', rateLoan: '#00a', rateDeposit: '#0a0' },
  }),
}));

// eslint-disable-next-line import/first -- route import must follow its store/UI mocks
import ProductDetail from '../app/product/[key]';

describe('Product detail save eligibility', () => {
  beforeEach(() => toggleSavedRate.mockClear());

  it('routes both header and body actions to a non-crashing product-wide save', async () => {
    let tree!: InspectableRenderer;
    await act(async () => {
      tree = TestRenderer.create(<ProductDetail />) as InspectableRenderer;
      await Promise.resolve();
    });

    const stack = tree.root.findAllByType('StackScreen').at(-1)!;
    let header!: InspectableRenderer;
    act(() => {
      header = TestRenderer.create(stack.props.options.headerRight()) as InspectableRenderer;
    });
    const headerSave = header.root.findByProps({ accessibilityLabel: 'Save all product variants to My rates' });
    const bodySave = tree.root.findByProps({ title: 'Save product to My rates' });

    expect(() => {
      act(() => headerSave.props.onPress());
      act(() => bodySave.props.onPress());
    }).not.toThrow();
    expect(toggleSavedRate).toHaveBeenNthCalledWith(1, row, 'product');
    expect(toggleSavedRate).toHaveBeenNthCalledWith(2, row, 'product');

    act(() => header.unmount());
    act(() => tree.unmount());
  });
});
