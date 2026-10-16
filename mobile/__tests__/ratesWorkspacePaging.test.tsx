import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { DEFAULT_PREFS } from '../src/data/storeTypes';
import { EMPTY_FILTERS } from '../src/data/selectors';
import { captureRatesSession, restoreRatesSession, initializeRatesSession, updateRatesSection, useRatesSession } from '../src/data/ratesSession';
import { clearMortgageComparison, useMortgageComparison } from '../src/data/mortgageComparison';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';

jest.mock('../src/data/store', () => ({ useStore: jest.requireActual('zustand').create(() => ({})) }));
jest.mock('expo-router', () => ({ Stack: { Screen: 'StackScreen' }, router: { push: jest.fn() }, useLocalSearchParams: () => ({}) }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true, useNavigation: () => ({}) }));
jest.mock('../src/hooks/useReadyNavigationEffect', () => ({ useReadyNavigationEffect: () => {} }));
jest.mock('../src/hooks/useBackOwnedSheetState', () => ({ useBackOwnedSheetState: () => jest.requireActual('react').useState(false) }));
jest.mock('../src/hooks/useDebouncedValue', () => ({ useDebouncedValue: (value: unknown) => value }));
jest.mock('../src/hooks/useSuitabilityRevision', () => ({ useSuitabilityRevision: () => 1 }));
jest.mock('../src/hooks/useSearchFilterOptions', () => ({ useSearchFilterOptions: () => ({ options: jest.requireActual('../src/data/searchFilterOptions').EMPTY_SEARCH_FILTER_OPTIONS, ready: true, error: null, retry: jest.fn() }) }));
jest.mock('../src/hooks/usePreparedSearchRows', () => ({ usePreparedSearchRows: (...args: any[]) => ({
  rows: jest.requireActual('../src/data/selectors').queryAndSort(...args.slice(0, 8)), ready: true, error: null, retry: jest.fn(),
}) }));
jest.mock('../src/hooks/useVirtualizedListReadiness', () => ({ useVirtualizedListReadiness: (_revision: unknown, count: number) => ({
  ready: true, visiblyCommitted: true, measuredVisibleCount: count, committedItemCount: count,
  onCommitLayoutEffect: jest.fn(), onLoad: jest.fn(), onViewableItemsChanged: jest.fn(), onRevisionLayout: jest.fn(), onContentSizeChange: jest.fn(),
}) }));
jest.mock('../src/hooks/useLogoReadiness', () => ({ useLogoReadiness: () => ({ ready: true, expectedCount: 0, terminalCount: 0, onLogoRenderStateChange: jest.fn() }) }));
jest.mock('../src/hooks/usePerformanceAuditReadiness', () => ({ usePerformanceAuditSurface: jest.fn() }));
jest.mock('../src/components/Screen', () => ({ Screen: 'Screen', screenScrollContentStyle: () => ({}) }));
jest.mock('../src/components/SheetSurface', () => ({ SheetSurface: ({ children }: any) => jest.requireActual('react').createElement('SheetSurface', null, children) }));
jest.mock('../src/components/FilterSheet', () => ({ FilterSheet: 'FilterSheet' }));
jest.mock('../src/components/ProductCard', () => ({ ProductCard: 'ProductCard' }));
jest.mock('../src/components/SearchReportExport', () => ({ SearchReportExport: 'SearchReportExport' }));
jest.mock('../src/components/TouchTarget', () => ({ TouchTarget: 'TouchTarget' }));
jest.mock('../src/components/IconAction', () => ({ IconAction: 'IconAction' }));
jest.mock('../src/components/controls', () => ({ SearchBar: 'SearchBar', SegmentedControl: 'SegmentedControl' }));
jest.mock('../src/components/icons/AppIcon', () => ({ __esModule: true, default: 'Icon' }));
jest.mock('../src/components/feedback', () => ({ EmptyState: 'EmptyState', LoadingRows: 'LoadingRows', ScreenSkeleton: 'ScreenSkeleton', IndeterminateProgressBar: 'Progress' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Row: 'Row', Button: 'Button', Chip: 'Chip' }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: {}, font: { body: 14 }, spacing: (n: number) => n * 4 }) }));
jest.mock('@shopify/flash-list', () => ({ FlashList: jest.requireActual('react').forwardRef((props: any, ref: any) => {
  const R = jest.requireActual('react');
  R.useImperativeHandle(ref, () => ({ scrollToOffset: jest.fn(), recomputeViewableItems: jest.fn() }));
  return R.createElement('FlashList', props, props.ListHeaderComponent,
    ...props.data.map((item: any, index: number) => R.createElement(R.Fragment, { key: props.keyExtractor(item, index) }, props.renderItem({ item, index }))), props.ListFooterComponent);
}) }));
// eslint-disable-next-line import/first -- route uses the controlled native/store harness above
import RatesWorkspace from '../src/components/rates/RatesWorkspace';
const mockStore = jest.requireMock('../src/data/store').useStore;
const original = captureRatesSession();
const rows = Array.from({ length: 45 }, (_, i) => ({ product_key: `p-${i}`, product_name: `Loan ${i}`, provider: i % 2 ? 'B' : 'A',
  rate: String((500 + i) / 10000), comparison_rate: String((510 + i) / 10000), rate_index: i, rate_type: i % 2 ? 'FIXED' : 'VARIABLE', account_class: 'standard' })).reverse();
function install(profile = DEFAULT_PREFS.profileFilters) { installMandatoryEligibility(selectMandatoryEligibility(mockStore.getState().core, profile, null)); }
beforeEach(() => {
  restoreRatesSession(original); clearMortgageComparison();
  mockStore.setState({ hydrated: true, activeSection: 'Mortgage', source: 'sample',
    prefs: { ...DEFAULT_PREFS, includeNonStandard: true, enableDeepSearch: false },
    core: { run_date: '2026-10-16', sections: { Mortgage: { rates: rows }, Savings: { rates: [] }, TD: { rates: [] } } },
    details: null, manifest: null, coreIntegrity: null, subscriptions: [], searchIndexStatus: 'idle',
    ensureDetails: jest.fn(), ensureSearchIndex: jest.fn(), subscribeSearch: jest.fn(), unsubscribeSearch: jest.fn(),
    setPref: (key: string, value: unknown) => { mockStore.setState((state: any) => ({ prefs: { ...state.prefs, [key]: value } })); install(mockStore.getState().prefs.profileFilters); },
  }, true);
  initializeRatesSession(mockStore.getState().prefs, 'Mortgage'); install();
});
afterEach(() => { restoreRatesSession(original); clearMortgageComparison(); installMandatoryEligibility(selectMandatoryEligibility(null, DEFAULT_PREFS.profileFilters, null)); });
function mount() { let tree: any; act(() => { tree = TestRenderer.create(<RatesWorkspace />); }); return tree; }
test('the mounted workspace pages sorted rows, retains cross-page selections, and clamps size/dataset changes', () => {
  const tree = mount();
  const list = () => tree.root.findByType('FlashList').props;
  const button = (name: string) => tree.root.findAllByType('Button').find((node: any) => node.props.accessibilityLabel === name);
  try {
    expect(list().data.map((row: any) => row.rate_index)).toEqual(Array.from({ length: 20 }, (_, i) => i));
    act(() => updateRatesSection('Mortgage', { selected: ['0#p-0'], selectMode: true }));
    act(() => button('Next page').props.onPress());
    expect(list().data[0].rate_index).toBe(20); expect(list().data).toHaveLength(20);
    expect(useRatesSession.getState().sections.Mortgage.selected).toEqual(['0#p-0']);
    act(() => button('Last page').props.onPress()); expect(list().data.map((row: any) => row.rate_index)).toEqual([40, 41, 42, 43, 44]);
    act(() => mockStore.getState().setPref('ratesPageSize', 10)); expect(list().data[0].rate_index).toBe(20); expect(list().data).toHaveLength(10);
    act(() => button('Last page').props.onPress()); expect(list().data[0].rate_index).toBe(40);
    act(() => mockStore.setState((state: any) => ({ core: { ...state.core, sections: { ...state.core.sections, Mortgage: { rates: rows.slice(-11) } } } })));
    expect(list().data).toHaveLength(1); expect(list().data[0].rate_index).toBe(10);
    expect(useRatesSession.getState().sections.Mortgage.page).toBe(2);
  } finally { act(() => tree.unmount()); }
});
test('temporary filters reset paging and never erase the saved profile; clearing saved requirements retains explicit temporary filters', () => {
  const profile = { ...DEFAULT_PREFS.profileFilters, rateTypes: ['VARIABLE'] };
  mockStore.getState().setPref('profileFilters', profile);
  const tree = mount(), list = () => tree.root.findByType('FlashList').props;
  try {
    expect(list().data.every((row: any) => row.rate_type === 'VARIABLE')).toBe(true);
    act(() => updateRatesSection('Mortgage', { page: 2 })); expect(list().data).toHaveLength(3);
    act(() => updateRatesSection('Mortgage', { filters: { ...EMPTY_FILTERS, includeNonStandard: true, providers: ['B'] } }));
    expect(useRatesSession.getState().sections.Mortgage.page).toBe(1); expect(list().data).toHaveLength(0);
    expect(mockStore.getState().prefs.profileFilters).toEqual(profile);
    act(() => tree.root.findAllByType('Button').find((node: any) => node.props.title === 'Clear Home loans requirements').props.onPress());
    expect(list().data.every((row: any) => row.provider === 'B')).toBe(true);
    expect(useRatesSession.getState().sections.Mortgage.filters.providers).toEqual(['B']);
  } finally { act(() => tree.unmount()); }
});
test('comparison uncertainty counts the complete filtered result set, not the pre-filter catalogue or current page', () => {
  const tree = mount();
  try {
    act(() => useMortgageComparison.setState({ loanAmount: '300000' }));
    act(() => updateRatesSection('Mortgage', { filters: { ...EMPTY_FILTERS, includeNonStandard: true, providers: ['B'] } }));
    expect(tree.root.findByType('FlashList').props.data).toHaveLength(20);
    expect(tree.root.findAllByType('AppText').some((node: any) => node.props.children === 'Eligibility unverified · 22')).toBe(true);
  } finally { act(() => tree.unmount()); }
});
