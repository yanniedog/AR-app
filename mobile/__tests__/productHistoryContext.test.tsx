import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import fixture from './fixtures/bankwest-easy-saver-eligibility-20260913.json';
import type { CorePayload, RateRow } from '../src/types';

type TestNode = {
  props: Record<string, any>;
  children: (TestNode | string)[];
  findAllByProps: (props: Record<string, unknown>) => TestNode[];
  findAllByType: (type: string) => TestNode[];
  findByProps: (props: Record<string, unknown>) => TestNode;
};
type InspectableRenderer = ReactTestRenderer & { root: TestNode };

const [row, prize] = fixture.rates as RateRow[];
const mockParams = { key: row.product_key, ri: '4' };
const mockHistoryModel = { dates: ['2026-09-12', '2026-09-13'], allDates: ['2026-09-12', '2026-09-13'], points: [] };
const emptyRibbon = {
  counts: { rates: 1, products: 1, providers: 1 },
  range: { min: 0.05, max: 0.05, mean: 0.05, median: 0.05 },
  providers: [],
};
const core: CorePayload = {
  schema_version: 1,
  run_date: '2026-09-13',
  sections: {
    Mortgage: { rates: [], ribbon: emptyRibbon },
    Savings: { rates: [row, prize], ribbon: { ...emptyRibbon, counts: { rates: 2, products: 1, providers: 1 } } },
    TD: { rates: [], ribbon: { ...emptyRibbon, counts: { rates: 0, products: 0, providers: 0 } } },
  },
  brands: {},
  rba: [],
};
const mockState: Record<string, any> = {
  core,
  coreIntegrity: null,
  manifest: null,
  details: { products: { [row.product_key]: fixture.detail } },
  savedRates: [],
  toggleSavedRate: jest.fn(),
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
  useLocalSearchParams: () => mockParams,
}));
jest.mock('../src/components/BankAvatar', () => ({ BankAvatar: 'BankAvatar' }));
jest.mock('../src/components/AppNavigationMenu', () => ({ NavigationMenuButton: 'NavigationMenuButton' }));
jest.mock('../src/components/BankHistoryChart', () => ({ BankHistoryChart: 'BankHistoryChart' }));
jest.mock('../src/components/ChartErrorBoundary', () => ({ ChartErrorBoundary: 'ChartErrorBoundary' }));
jest.mock('../src/components/feedback', () => ({ EmptyState: 'EmptyState' }));
jest.mock('../src/components/product/ProductRateChangeLine', () => ({ ProductRateChangeLine: 'ProductRateChangeLine' }));
jest.mock('../src/components/product/ProductTermsDisclosure', () => ({ ProductTermsDisclosure: 'ProductTermsDisclosure' }));
jest.mock('../src/components/product/ProductDetailParts', () => ({
  AccessNotice: 'AccessNotice',
  DetailGroup: 'DetailGroup',
  HistoryLegend: jest.requireActual('../src/components/product/ProductDetailParts').HistoryLegend,
  SelectedRateConditions: jest.requireActual('../src/components/product/RateConditionsDisclosure').SelectedRateConditions,
  OfficialLinks: 'OfficialLinks',
  ProductFacts: 'ProductFacts',
  ProductRatesList: 'ProductRatesList',
  ProductSpecs: 'ProductSpecs',
  SectionTitle: 'SectionTitle',
}));
jest.mock('../src/components/Screen', () => ({ ScreenScrollView: 'ScreenScrollView' }));
jest.mock('../src/components/ui', () => ({
  AppText: 'AppText', Button: 'Button', Card: 'Card', IconButton: 'IconButton', Row: 'Row', Disclosure: 'Disclosure',
}));
jest.mock('../src/components/scenario/StaySwitchChart', () => ({ StaySwitchChart: 'StaySwitchChart' }));
jest.mock('../src/data/bankInsights', () => ({ filterBankInsightsForSuitability: () => null }));
jest.mock('../src/data/historySelectors', () => ({ selectBankHistoryChartModel: () => mockHistoryModel }));
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
jest.mock('../src/lib/yieldToUi', () => ({ yieldToUi: async () => undefined }));
jest.mock('../src/lib/proAccess', () => ({ effectiveBankInsights: () => false, effectiveHistoryRibbon: (prefs: { showHistoryRibbon?: boolean }) => Boolean(prefs.showHistoryRibbon) }));
jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    radius: { sm: 4 },
    colors: { success: '#0a0', primary: '#00a', warning: '#fa0', rateLoan: '#00a', rateDeposit: '#0a0' },
  }),
}));

// eslint-disable-next-line import/first -- route import must follow its store/UI mocks
import ProductDetail from '../app/product/[key]';

// Market-axis scaffolding and ledger entries below are controlled unit context;
// the selected ordinary/prize rows and shared product detail are retained real data.
async function renderProduct() {
  let tree!: InspectableRenderer;
  await act(async () => {
    tree = TestRenderer.create(<ProductDetail />) as InspectableRenderer;
    await Promise.resolve();
  });
  return tree;
}

function copy(tree: InspectableRenderer): string {
  return tree.root.findAllByType('AppText').map((node) => node.children.join('')).join('\n');
}

describe('product-wide history context on an exact-tier page', () => {
  beforeEach(() => {
    mockState.core = core;
    mockParams.ri = '4';
    mockState.prefs.showHistoryRibbon = false;
    mockState.productHistory = null;
  });

  it.each([false, true])('does not call an older cached capture current with history enabled=%s', async (enabled) => {
    // Controlled date context only: the rate rows remain the retained real fixture.
    mockState.core = { ...core, run_date: '2026-09-12' };
    mockState.prefs.showHistoryRibbon = enabled;
    const tree = await renderProduct();
    const renderedCopy = copy(tree);
    expect(renderedCopy).toContain('Selected tier 5.00% · product best 11.50%');
    expect(renderedCopy).not.toMatch(/product best 11\.50% today/);
    if (enabled) {
      expect(renderedCopy).toContain('11.50% best across all tiers in this capture');
      expect(tree.root.findAllByType('BankHistoryChart')[0].props.highlightSeries.values['2026-09-12']).toBe(0.115);
    }
    act(() => tree.unmount());
  });

  it('explains all-tier scope and a differing selected rate before history is enabled', async () => {
    const tree = await renderProduct();
    expect(tree.root.findByProps({ text: 'Product-wide history' })).toBeTruthy();
    expect(copy(tree)).toContain('Includes conditional and restricted tiers. The best tier can change.');
    expect(copy(tree)).toContain('Selected tier 5.00% · product best 11.50%');
    expect(tree.root.findByProps({ title: 'Show product-wide history' })).toBeTruthy();
    act(() => tree.unmount());
  });

  it('labels the unchanged seeded maximum in the legend, accessible series and warming copy', async () => {
    mockState.prefs.showHistoryRibbon = true;
    const tree = await renderProduct();
    const chart = tree.root.findAllByType('BankHistoryChart')[0];
    expect(chart.props.highlightSeries.label).toBe('Bankwest Easy Saver · Best advertised rate · all tiers');
    expect(chart.props.highlightSeries.valueScope).toBe('best · all tiers');
    expect(chart.props.highlightSeries.values['2026-09-13']).toBe(0.115);
    expect(copy(tree)).toContain('Best advertised rate · all tiers');
    expect(copy(tree)).toContain('11.50% best across all tiers in this capture');
    expect(tree.root.findAllByType('ProductSpecs')[0].props.row.rate).toBe('0.05');
    act(() => tree.unmount());
  });

  it('keeps persisted history values and scope while avoiding duplicate selected-tier comparison when equal', async () => {
    mockParams.ri = '5';
    mockState.prefs.showHistoryRibbon = true;
    mockState.productHistory = { run_date: core.run_date, run_dates: mockHistoryModel.dates, products: { [row.product_key]: [0.115, 0.115] } };
    const before = JSON.stringify(mockState.productHistory);
    const tree = await renderProduct();
    const chart = tree.root.findAllByType('BankHistoryChart')[0];
    expect(chart.props.highlightSeries.values).toEqual({ '2026-09-12': 0.115, '2026-09-13': 0.115 });
    expect(chart.props.highlightSeries.label).toContain('Best advertised rate · all tiers');
    expect(copy(tree)).toContain('Includes conditional and restricted tiers. The best tier can change.');
    expect(copy(tree)).not.toContain('Selected tier 11.50%');
    expect(JSON.stringify(mockState.productHistory)).toBe(before);
    act(() => tree.unmount());
  });
});
