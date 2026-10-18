import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import RateReceiptScreen from '../app/rate-receipt';
import { openProduct } from '../src/lib/nav';
import { buildStaySwitchProjection } from '../src/data/staySwitchProjection';
import { catalogue, product, programme, core as emptyCore } from '../testUtils/publicRateJourney';
import { DEFAULT_PREFS } from '../src/data/storeTypes';
import { normalizeUserRateScenario } from '../src/data/userRateScenario';
import { clearMortgageComparison } from '../src/data/mortgageComparison';
import { captureRatesSession, restoreRatesSession, initializeRatesSession, updateRatesSection } from '../src/data/ratesSession';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';

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
const mockRoute: { key: string; ri?: string; programme?: string; origin?: string } = { key: row.product_key };

jest.mock('../src/data/store', () => ({
  useStore: jest.requireActual('zustand').create(() => mockState),
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  Stack: { Screen: 'StackScreen' },
  useLocalSearchParams: () => mockRoute,
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
  HistoryLegend: 'HistoryLegend',
  OfficialLinks: 'OfficialLinks',
  ProductFacts: 'ProductFacts',
  ProductRatesList: 'ProductRatesList',
  ProductSpecs: 'ProductSpecs',
  SectionTitle: 'SectionTitle',
  SelectedRateConditions: jest.requireActual('../src/components/product/RateConditionsDisclosure').SelectedRateConditions,
}));
jest.mock('../src/components/Screen', () => ({ ScreenScrollView: 'ScreenScrollView', Screen: 'Screen', screenScrollContentStyle: () => ({}) }));
jest.mock('../src/components/ui', () => ({
  AppText: 'AppText', Button: 'Button', Card: 'Card', IconButton: 'IconButton', Row: 'Row', Disclosure: 'Disclosure', Chip: 'Chip', Divider: 'Divider',
}));
jest.mock('../src/components/scenario/StaySwitchChart', () => ({ StaySwitchChart: 'StaySwitchChart' }));
jest.mock('../src/data/bankInsights', () => ({ filterBankInsightsForSuitability: () => null }));
jest.mock('../src/data/historySelectors', () => ({ selectBankHistoryChartModel: () => null }));
jest.mock('../src/hooks/useBankRateHistory', () => ({ useBankRateHistory: () => ({
  snapshots: null, updating: false, failed: false, historyAvailable: false,
  richHistory: false, missingDates: [], revision: 'history-disabled',
}) }));
jest.mock('../src/data/notifications', () => ({ ensurePermissions: jest.fn(async () => true) }));
jest.mock('../src/hooks/useAuditExternalLinks', () => ({ useAuditExternalLinks: jest.fn() }));
jest.mock('../src/components/ExternalLinkConfirmation', () => ({ useTrustedExternalUrl: () => ({ requestExternalUrl: jest.fn() }) }));
jest.mock('../src/data/staySwitchProjection', () => ({ buildStaySwitchProjection: jest.fn(() => null) }));
jest.mock('../src/hooks/usePerformanceAuditReadiness', () => ({ usePerformanceAuditSurface: jest.fn() }));
jest.mock('../src/hooks/useLogoReadiness', () => ({
  useLogoReadiness: () => ({ ready: true, expectedCount: 1, terminalCount: 1, onLogoRenderStateChange: jest.fn() }),
}));
jest.mock('../src/hooks/useSuitabilityRevision', () => ({ useSuitabilityRevision: () => 1 }));
const mockScenario = normalizeUserRateScenario(undefined);
Object.assign(mockScenario.mortgage, { mode: 'refi', loanBalance: '100000', propertyValue: '800000', currentRate: '8' });
let mockCatalogue: any;
jest.mock('../src/data/publicRateCatalogue', () => ({ usePublicRateCatalogue: () => mockCatalogue }));
jest.mock('../src/components/scenario/PublicRateEvidence', () => ({ PublicRateEvidence: 'PublicRateEvidence' }));
jest.mock('../src/components/scenario/PublicCostComparison', () => ({ PublicCostComparison: 'PublicCostComparison' }));
jest.mock('../src/components/product/DetailsOnlyProduct', () => ({ DetailsOnlyProduct: 'DetailsOnlyProduct' }));
jest.mock('../src/hooks/useUserRateScenario', () => ({
  useUserRateScenario: () => ({
    scenario: mockScenario, storageStatus: 'ready',
  }),
}));

jest.mock('../src/lib/proAccess', () => ({ effectiveBankInsights: () => false, effectiveHistoryRibbon: () => false, effectiveDeepSearch: () => false }));
jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: { success: '#0a0', primary: '#00a', warning: '#fa0', rateLoan: '#00a', rateDeposit: '#0a0' },
    ledger: { info: '#36c' },
    radius: { sm: 8 }, font: { body: 14 }, spacing: (n: number) => n * 4,
  }),
}));

// eslint-disable-next-line import/first -- route import must follow its store/UI mocks
import ProductDetail from '../app/product/[key]';


jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true, useNavigation: () => ({}) }));
jest.mock('../src/hooks/useReadyNavigationEffect', () => ({ useReadyNavigationEffect: () => {} }));
jest.mock('../src/hooks/useBackOwnedSheetState', () => ({ useBackOwnedSheetState: () => jest.requireActual('react').useState(false) }));
jest.mock('../src/hooks/useDebouncedValue', () => ({ useDebouncedValue: (value: unknown) => value }));
jest.mock('../src/hooks/useSearchFilterOptions', () => ({ useSearchFilterOptions: () => ({ options: jest.requireActual('../src/data/searchFilterOptions').EMPTY_SEARCH_FILTER_OPTIONS, ready: true }) }));
jest.mock('../src/hooks/usePreparedSearchRows', () => ({ usePreparedSearchRows: (...args: any[]) => ({ rows: jest.requireActual('../src/data/selectors').queryAndSort(...args.slice(0, 8)), ready: true }) }));
jest.mock('../src/components/FilterSheet', () => ({ FilterSheet: 'FilterSheet' }));
jest.mock('../src/components/SheetSurface', () => ({ SheetSurface: 'SheetSurface' }));
jest.mock('../src/components/ProductCard', () => ({ ProductCard: 'ProductCard' }));
jest.mock('../src/components/SearchReportExport', () => ({ SearchReportExport: 'SearchReportExport' }));
jest.mock('../src/components/TouchTarget', () => ({ TouchTarget: 'TouchTarget' }));
jest.mock('../src/components/IconAction', () => ({ IconAction: 'IconAction' }));
jest.mock('../src/components/controls', () => ({ SearchBar: 'SearchBar', SegmentedControl: 'SegmentedControl' }));
jest.mock('@shopify/flash-list', () => ({ FlashList: jest.requireActual('react').forwardRef((props: any, _ref: any) => {
  const R = jest.requireActual('react');
  return R.createElement('FlashList', props, props.ListHeaderComponent,
    ...props.data.map((item: any, index: number) => R.createElement(R.Fragment, { key: props.keyExtractor(item, index) }, props.renderItem({ item, index, target: 'Cell' }))));
}) }));
// eslint-disable-next-line import/first -- mount both routes against the same store/router harness
import RatesWorkspace from '../src/components/rates/RatesWorkspace';

test.each([false, true])('Rates opens a public-only mortgage with private pricing scope and OR facets=%s', async useOr => {
  const previous = captureRatesSession();
  const saved = JSON.stringify(mockScenario);
  jest.mocked(buildStaySwitchProjection).mockClear();
  const p = programme({ sourceBindings: [], conditions: [
    { conditionId: 'amount', field: 'amount', operator: 'bounds', minimum: '500000', evidenceIds: [] },
    { conditionId: 'lvr', field: 'lvr', operator: 'bounds', maximum: '0.8', evidenceIds: [] },
    ...(useOr ? [
      { conditionId: 'purpose', field: 'purpose' as const, operator: 'eq' as const, value: 'INVESTMENT', evidenceIds: [] },
      { conditionId: 'repayment', field: 'repayment' as const, operator: 'eq' as const, value: 'INTEREST_ONLY', evidenceIds: [] },
    ] : []),
  ] });
  mockCatalogue = { ...catalogue([{ ...p, freshness: { ...p.freshness, lastSuccessAt: new Date().toISOString() } }], [product], []),
    coverage: [], evidence: [], loadAll: async () => undefined, loadProduct: async () => undefined };
  const store = jest.requireMock('../src/data/store').useStore;
  store.setState({ ...mockState, hydrated: true, source: 'sample', activeSection: 'Mortgage', core: emptyCore([]),
    details: { products: { [product.productKey]: {} } },
    prefs: { ...DEFAULT_PREFS, includeNonStandard: true }, subscriptions: [], searchIndexStatus: 'idle',
    setActiveSection: jest.fn(), ensureSearchIndex: jest.fn(), subscribeSearch: jest.fn(), unsubscribeSearch: jest.fn() }, true);
  initializeRatesSession(store.getState().prefs, 'Mortgage');
  if (useOr) updateRatesSection('Mortgage', current => ({ filters: { ...current.filters,
    loanPurposes: ['OO', 'INV'], repaymentTypes: ['PI', 'IO'] } }));
  installMandatoryEligibility(selectMandatoryEligibility(store.getState().core, DEFAULT_PREFS.profileFilters, null));
  clearMortgageComparison();
  let rates!: InspectableRenderer, detail!: InspectableRenderer;
  try {
    act(() => { rates = TestRenderer.create(<RatesWorkspace />) as InspectableRenderer; });
    expect(rates.root.findAllByType('ProductCard')).toHaveLength(0);
    act(() => {
      rates.root.findAllByProps({ accessibilityLabel: 'Loan amount' })[0].props.onChangeText('600000');
      rates.root.findAllByProps({ accessibilityLabel: 'LVR' })[0].props.onChangeText('75');
    });
    const card = rates.root.findAllByType('ProductCard')[0];
    expect(card.props.rateScenario).toMatchObject({ amount: '600000', lvr: '0.75' });
    act(() => card.props.onPress());
    const destination = jest.mocked(router.push).mock.calls.at(-1)![0] as unknown as { params: typeof mockRoute };
    expect(destination.params).toEqual({ key: product.productKey, programme: p.programmeId, origin: 'rates-comparison' });
    Object.assign(mockRoute, destination.params);
    act(() => rates.unmount());
    await act(async () => { detail = TestRenderer.create(<ProductDetail />) as InspectableRenderer; });
    expect(detail.root.findAllByType('DetailsOnlyProduct')).toHaveLength(0);
    expect(buildStaySwitchProjection).not.toHaveBeenCalled();
    const evidence = detail.root.findAllByType('PublicRateEvidence')[0];
    expect(evidence.props.row.rate).toBe('0.06');
    expect(evidence.props.scenario).toMatchObject({ amount: '600000', lvr: '0.75',
      ...(useOr ? { purpose: 'INVESTMENT', repayment: 'INTEREST_ONLY' } : {}) });
    expect(detail.root.findAllByType('PublicCostComparison')[0].props.rateScenario).toMatchObject({ amount: '600000', lvr: '0.75' });
    act(() => detail.root.findAllByProps({ title: 'Bank-call brief' })[0].props.onPress());
    const receiptDestination = jest.mocked(router.push).mock.calls.at(-1)![0] as unknown as { params: typeof mockRoute };
    expect(receiptDestination.params).toEqual({ key: product.productKey, programme: p.programmeId, origin: 'rates-comparison' });
    Object.assign(mockRoute, receiptDestination.params);
    act(() => detail.unmount());
    await act(async () => { detail = TestRenderer.create(<RateReceiptScreen />) as InspectableRenderer; });
    expect(detail.root.findAllByProps({ title: 'Copy' })).toHaveLength(1);
    const texts = detail.root.findAllByType('AppText').map(node => node.props.children);
    expect(texts).toContain('$600,000');
    expect(texts).not.toContain('$100,000');
    expect(texts).not.toContain('Simple interest-rate difference');
    const surface = jest.mocked(usePerformanceAuditSurface).mock.calls.at(-1)![0];
    act(() => { surface.actions!['receipt.back-to-product']({ productKey: product.productKey, rateIndex: 0 }); });
    expect(jest.mocked(router.replace).mock.calls.at(-1)![0]).toMatchObject({ params: {
      key: product.productKey, programme: p.programmeId, origin: 'rates-comparison' } });
    act(() => detail.unmount());
    delete mockRoute.origin;
    await act(async () => { detail = TestRenderer.create(<RateReceiptScreen />) as InspectableRenderer; });
    expect(detail.root.findAllByType('PublicRateEvidence')[0].props.scenario).toMatchObject({ amount: '100000' });
    expect(detail.root.findAllByProps({ title: 'Copy' })).toHaveLength(0);
    act(() => detail.unmount());
    // A Saved/Dashboard-style open must keep its saved 100k assumptions even
    // while the in-memory Rates comparison still contains 600k.
    openProduct(product.productKey, undefined, p.programmeId);
    const ordinary = jest.mocked(router.push).mock.calls.at(-1)![0] as unknown as { params: typeof mockRoute };
    expect(ordinary.params).toEqual({ key: product.productKey, programme: p.programmeId });
    delete mockRoute.origin;
    await act(async () => { detail = TestRenderer.create(<ProductDetail />) as InspectableRenderer; });
    expect(detail.root.findAllByType('DetailsOnlyProduct')).toHaveLength(1);
    act(() => detail.unmount());
    // Normal Product pricing still constructs its persisted Stay/Switch model
    // when the selected programme actually applies at the saved amount.
    mockCatalogue = { ...mockCatalogue, ...catalogue([{ ...p, conditions: [], freshness: { ...p.freshness, lastSuccessAt: new Date().toISOString() } }], [product], []) };
    await act(async () => { detail = TestRenderer.create(<ProductDetail />) as InspectableRenderer; });
    expect(buildStaySwitchProjection).toHaveBeenCalled();
    expect(jest.mocked(buildStaySwitchProjection).mock.calls.at(-1)![0].scenario.mortgage.loanBalance).toBe('100000');
    act(() => detail.unmount());
    await act(async () => { detail = TestRenderer.create(<RateReceiptScreen />) as InspectableRenderer; });
    const normalTexts = detail.root.findAllByType('AppText').map(node => node.props.children);
    expect(normalTexts).toContain('$100,000');
    expect(normalTexts).toContain('Simple interest-rate difference');
    expect(normalTexts).not.toContain('$600,000');
    expect(JSON.stringify(mockScenario)).toBe(saved);
  } finally {
    act(() => { detail?.unmount(); clearMortgageComparison(); restoreRatesSession(previous); });
    installMandatoryEligibility(selectMandatoryEligibility(null, DEFAULT_PREFS.profileFilters, null));
  }
});




test('Rates 75% offer does not show the saved 90% LVR contradiction; ordinary Product retains its saved-tier warning', async () => {
  const previous = captureRatesSession(), savedMortgage = { ...mockScenario.mortgage };
  const p = programme({ sourceBindings: [], conditions: [
    { conditionId: 'amount', field: 'amount', operator: 'bounds', minimum: '500000', evidenceIds: [] },
    { conditionId: 'lvr', field: 'lvr', operator: 'bounds', maximum: '0.8', evidenceIds: [] },
  ] });
  mockCatalogue = { ...catalogue([{ ...p, freshness: { ...p.freshness, lastSuccessAt: new Date().toISOString() } }], [product], []),
    coverage: [], evidence: [], loadAll: async () => undefined, loadProduct: async () => undefined };
  Object.assign(mockScenario.mortgage, { mode: 'refi', loanBalance: '450000', propertyValue: '500000' });
  const store = jest.requireMock('../src/data/store').useStore;
  store.setState({ ...mockState, hydrated: true, source: 'sample', activeSection: 'Mortgage', core: emptyCore([]),
    details: { products: { [product.productKey]: {} } }, prefs: { ...DEFAULT_PREFS, includeNonStandard: true },
    subscriptions: [], searchIndexStatus: 'idle', setActiveSection: jest.fn(), ensureSearchIndex: jest.fn(),
    subscribeSearch: jest.fn(), unsubscribeSearch: jest.fn() }, true);
  initializeRatesSession(store.getState().prefs, 'Mortgage'); clearMortgageComparison();
  installMandatoryEligibility(selectMandatoryEligibility(store.getState().core, DEFAULT_PREFS.profileFilters, null));
  let rates!: InspectableRenderer, detail!: InspectableRenderer;
  try {
    act(() => { rates = TestRenderer.create(<RatesWorkspace />) as InspectableRenderer; });
    act(() => {
      rates.root.findAllByProps({ accessibilityLabel: 'Loan amount' })[0].props.onChangeText('600000');
      rates.root.findAllByProps({ accessibilityLabel: 'LVR' })[0].props.onChangeText('75');
    });
    const card = rates.root.findAllByType('ProductCard')[0];
    expect(card.props.rateScenario).toMatchObject({ amount: '600000', lvr: '0.75' });
    act(() => card.props.onPress());
    Object.assign(mockRoute, (jest.mocked(router.push).mock.calls.at(-1)![0] as unknown as { params: typeof mockRoute }).params);
    act(() => rates.unmount());
    await act(async () => { detail = TestRenderer.create(<ProductDetail />) as InspectableRenderer; });
    expect(detail.root.findAllByType('PublicRateEvidence')[0].props.scenario).toMatchObject({ amount: '600000', lvr: '0.75' });
    const scopedTexts = detail.root.findAllByType('AppText').map(node => node.props.children);
    expect(scopedTexts).toContain('Eligibility unverified');
    expect(scopedTexts).not.toContain('Outside listed LVR tier');
    expect(scopedTexts).not.toContain('Outside published LVR');
    act(() => detail.unmount());
    // An ordinary catalogue Product still checks the saved account's 90% LVR.
    mockCatalogue = { ...mockCatalogue, ...catalogue([], [], []), status: 'unavailable' };
    store.setState({ core: emptyCore([{ ...row, product_key: product.productKey, lvr_tier: 'lvr_=80%' }]) });
    delete mockRoute.origin; delete mockRoute.programme;
    await act(async () => { detail = TestRenderer.create(<ProductDetail />) as InspectableRenderer; });
    expect(detail.root.findAllByType('AppText').map(node => node.props.children)).toContain('Outside listed LVR tier');
    expect(mockScenario.mortgage.loanBalance).toBe('450000');
  } finally {
    act(() => { detail?.unmount(); clearMortgageComparison(); restoreRatesSession(previous); });
    Object.assign(mockScenario.mortgage, savedMortgage);
    delete mockRoute.origin; delete mockRoute.programme;
    installMandatoryEligibility(selectMandatoryEligibility(null, DEFAULT_PREFS.profileFilters, null));
  }
});
