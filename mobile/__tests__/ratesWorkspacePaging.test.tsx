import { catalogue as publicCatalogueFixture, programme as publicProgramme, product as publicProduct } from '../testUtils/publicRateJourney';
import { publicOfferSelectionToken } from '../src/data/publicOfferIdentity';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { DEFAULT_PREFS } from '../src/data/storeTypes';
import { EMPTY_FILTERS } from '../src/data/selectors';
import { captureRatesSession, restoreRatesSession, initializeRatesSession, updateRatesSection, recordRatesScroll, useRatesSession } from '../src/data/ratesSession';
import { clearMortgageComparison, useMortgageComparison } from '../src/data/mortgageComparison';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { buildDeepPerformanceAuditPlan } from '../src/lib/performanceAuditPlan';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { openCompare, openProduct } from '../src/lib/nav';
import { isVerifiedRatesPagePreparation } from '../src/lib/ratesAuditPage';
import { PERFORMANCE_AUDIT_STEP_LIMIT_MS, PerformanceAuditMutationBarrier } from '../src/lib/performanceAuditTiming';
import { PerformanceAuditReadinessRegistry, PerformanceAuditReadinessTimeoutError } from '../src/lib/performanceAuditReadiness';

jest.mock('../src/data/store', () => ({ useStore: jest.requireActual('zustand').create(() => ({})) }));
jest.mock('../src/lib/nav', () => ({ ...jest.requireActual('../src/lib/nav'), openCompare: jest.fn(), openProduct: jest.fn() }));
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
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Row: 'Row', Button: 'Button', Chip: 'Chip', Card: 'Card', Disclosure: 'Disclosure' }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: {}, font: { body: 14 }, spacing: (n: number) => n * 4 }) }));
let mockPublicCatalogue: any = null;
const mockUnavailableCatalogue = { status: 'unavailable', generationId: null, products: [], coverage: [], references: [], evidence: [], allLoaded: false,
  getProduct: () => undefined, getProgrammes: () => [], loadAll: async () => undefined };
jest.mock('../src/data/publicRateCatalogue', () => ({ usePublicRateCatalogue: () => mockPublicCatalogue ?? mockUnavailableCatalogue }));
let mockAuditCancelled = false;
let mockEmitLoad = true;
const mockCancelListeners = new Set<() => void>();
jest.mock('../src/lib/performanceAudit', () => {
  const actual = jest.requireActual('../src/lib/performanceAudit');
  return { ...actual, getPerformanceAuditState: () => ({ ...actual.getPerformanceAuditState(), cancelRequested: mockAuditCancelled }),
    subscribePerformanceAudit: (listener: () => void) => { mockCancelListeners.add(listener); return () => mockCancelListeners.delete(listener); } };
});
let mockHoldScroll = false;
let mockRejectScroll = false;
let mockAutoViewability = true;
let mockNative: any;
const mockScrollCalls: number[] = [];
const mockScrollResolutions: (() => void)[] = [];
jest.mock('@shopify/flash-list', () => ({ FlashList: jest.requireActual('react').forwardRef((props: any, ref: any) => {
  const R = jest.requireActual('react');
  const key = props.data.map((row: any, index: number) => props.keyExtractor(row, index)).join('|');
  const [window, setWindow] = R.useState({ key, offset: 0 });
  const offset = window.key === key ? window.offset : 0;
  const first = Math.floor(offset / 100), last = Math.min(first + 4, props.data.length - 1);
  const latest = R.useRef({ props, key, offset, first, last }); latest.current = { props, key, offset, first, last };
  const handle = R.useMemo(() => {
    const emit = () => {
      if (!mockAutoViewability) return;
      const value = latest.current;
      value.props.onViewableItemsChanged({ viewableItems: value.props.data.slice(value.first, value.last + 1).map((item: any, slot: number) => ({
        item, index: value.first + slot, key: value.props.keyExtractor(item, value.first + slot), isViewable: true,
      })) });
    };
    return {
      get props() { return latest.current.props; },
      getLayout: (index: number) => ({ x: 0, y: index * 100, width: 320, height: 100 }),
      getWindowSize: () => ({ width: 320, height: 500 }), getFirstItemOffset: () => 0,
      getAbsoluteLastScrollOffset: () => latest.current.offset,
      computeVisibleIndices: () => ({ startIndex: latest.current.first, endIndex: latest.current.last }),
      scrollToOffset: ({ offset }: any) => setWindow({ key: latest.current.key, offset }),
      scrollToIndex: ({ index }: any) => {
        mockScrollCalls.push(index);
        if (mockRejectScroll) return Promise.reject(new Error('native target scroll failed'));
        setWindow({ key: latest.current.key, offset: Math.max(0, Math.min(index - 2, latest.current.props.data.length - 5)) * 100 });
        return mockHoldScroll ? new Promise<void>(resolve => mockScrollResolutions.push(resolve)) : Promise.resolve();
      },
      recomputeViewableItems: emit,
    };
  }, []);
  mockNative = handle;
  R.useImperativeHandle(ref, () => handle, [handle]);
  R.useLayoutEffect(() => { props.onCommitLayoutEffect(); }, [props.extraData, key, offset]);
  R.useEffect(() => { if (mockEmitLoad) props.onLoad(); }, []);
  R.useEffect(() => {
    props.onScroll({ nativeEvent: { contentOffset: { y: offset } } });
    handle.recomputeViewableItems();
  }, [props.extraData, key, offset]);
  return R.createElement('FlashList', props, props.ListHeaderComponent,
    ...props.data.slice(first, last + 1).map((item: any, slot: number) => R.createElement(R.Fragment, { key: props.keyExtractor(item, first + slot) }, props.renderItem({ item, index: first + slot, target: 'Cell' }))),
    props.data[15] && (first > 15 || last < 15) ? R.createElement(R.Fragment, { key: 'measurement' }, props.renderItem({ item: props.data[15], index: 15, target: 'Measurement' })) : null,
    props.ListFooterComponent);
}) }));
// eslint-disable-next-line import/first -- route uses the controlled native/store harness above
import RatesWorkspace from '../src/components/rates/RatesWorkspace';
const mockStore = jest.requireMock('../src/data/store').useStore;
const original = captureRatesSession();
const rows = Array.from({ length: 45 }, (_, i) => ({ product_key: `p-${i}`, product_name: `Loan ${i}`, provider: i % 2 ? 'B' : 'A',
  rate: String((500 + i) / 10000), comparison_rate: String((510 + i) / 10000), rate_index: i, rate_type: i % 2 ? 'FIXED' : 'VARIABLE', account_class: 'standard' })).reverse();
function install(profile = DEFAULT_PREFS.profileFilters) { installMandatoryEligibility(selectMandatoryEligibility(mockStore.getState().core, profile, null)); }
beforeEach(() => {
  jest.clearAllMocks();
  mockPublicCatalogue = null; mockAuditCancelled = false; mockEmitLoad = true; mockCancelListeners.clear();
  mockHoldScroll = false; mockRejectScroll = false; mockAutoViewability = true; mockScrollCalls.length = 0; mockScrollResolutions.length = 0;
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => { callback(0); return 0; });
  restoreRatesSession(original); clearMortgageComparison();
  mockStore.setState({ hydrated: true, activeSection: 'Mortgage', source: 'sample',
    prefs: { ...DEFAULT_PREFS, includeNonStandard: true, enableDeepSearch: false },
    core: { run_date: '2026-10-16', sections: { Mortgage: { rates: rows }, Savings: { rates: [] }, TD: { rates: [] } } },
    details: null, manifest: null, coreIntegrity: null, subscriptions: [], searchIndexStatus: 'idle',
    setActiveSection: jest.fn((activeSection: string) => mockStore.setState({ activeSection })),
    ensureDetails: jest.fn(), ensureSearchIndex: jest.fn(), subscribeSearch: jest.fn(), unsubscribeSearch: jest.fn(),
    setPref: jest.fn((key: string, value: unknown) => { mockStore.setState((state: any) => ({ prefs: { ...state.prefs, [key]: value } })); install(mockStore.getState().prefs.profileFilters); }),
  }, true);
  initializeRatesSession(mockStore.getState().prefs, 'Mortgage'); install();
});
afterEach(() => { jest.restoreAllMocks(); restoreRatesSession(original); clearMortgageComparison(); installMandatoryEligibility(selectMandatoryEligibility(null, DEFAULT_PREFS.profileFilters, null)); });
function mount() { let tree: any; act(() => { tree = TestRenderer.create(<RatesWorkspace />); }); return tree; }
function currentProgramme(row: (typeof rows)[number], programmeId: string, offerId: string) {
  const value = publicProgramme({ productId: row.product_key, programmeId, offerId,
    sourceBindings: [{ rateIndex: row.rate_index, pointer: `/lendingRates/${row.rate_index}` }] });
  return { ...value, freshness: { ...value.freshness, lastSuccessAt: new Date().toISOString() }, components: [
    { ...value.components[0], value: row.rate, scopeId: offerId },
    { ...value.components[0], componentId: 'comparison', role: 'comparison' as const, value: row.comparison_rate, scopeId: offerId },
  ] };
}
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

test.each([[10, false], [10, true], [20, false], [20, true]] as const)('the seeded audit reaches exact later-page targets and restores the mounted %s-row session with initial comparison mode %s', async (pageSize, initialMode) => {
  const catalogue = Array.from({ length: 45 }, (_, i) => ({ product_key: `p-${String(i).padStart(2, '0')}`,
    product_name: `Loan ${String(i).padStart(2, '0')}`, provider: 'Bank', rate_index: i,
    rate: String((500 + i) / 10000), comparison_rate: String((510 + i) / 10000), account_class: 'standard' }));
  mockStore.setState((state: any) => ({ prefs: { ...state.prefs, ratesPageSize: pageSize },
    core: { ...state.core, sections: { ...state.core.sections, Mortgage: { rates: catalogue } } } }));
  install();
  updateRatesSection('Mortgage', { query: 'Loan', selected: ['1#p-01'], selectMode: initialMode });
  updateRatesSection('Mortgage', { page: 2 }); recordRatesScroll('Mortgage', 137);
  useMortgageComparison.setState({ loanAmount: '123456', lvr: '78' });
  const before = captureRatesSession(), preferences = JSON.parse(JSON.stringify(mockStore.getState().prefs));
  const comparison = { ...useMortgageComparison.getState() };
  const plan = buildDeepPerformanceAuditPlan(mockStore.getState().core, { seed: 'review-412', includeNonStandard: true });
  const targets = [plan.inputs.primaryProduct!, plan.inputs.secondaryProduct!];
  expect(targets.map(target => target.productKey)).toEqual(['p-20', 'p-35']);
  const steps = plan.passes[0].steps.filter(step => step.scenarioId === 'route.rates');
  const tree = mount(), list = () => tree.root.findByType('FlashList').props;
  const surface = () => jest.mocked(usePerformanceAuditSurface).mock.calls.at(-1)![0];
  try {
    for (const step of steps) {
      const action = surface().actions![step.semanticActionId];
      expect(action).toEqual(expect.any(Function));
      if (step.semanticActionId.startsWith('search.compare.select.')) {
        expect(useRatesSession.getState().sections.Mortgage.selectMode).toBe(true);
        expect(tree.root.findAllByType('ProductCard').every((card: any) => card.props.selectMode === true)).toBe(true);
      }
      let result: unknown;
      let pending: unknown;
      act(() => { pending = action(step.parameters); });
      await act(async () => { result = await pending; });
      expect(result ?? {}).not.toHaveProperty('unavailableReason');
      if (step.semanticActionId === 'search.filters.clear') {
        expect(useRatesSession.getState().sections.Mortgage.page).toBe(1);
        expect(surface().actions!['search.compare.select.0']({ selectionToken: targets[0].selectionToken }))
          .toHaveProperty('unavailableReason');
      }
      if (step.semanticActionId.startsWith('search.compare.page.')) {
        const target = targets[Number(step.semanticActionId.at(-1))];
        expect(isVerifiedRatesPagePreparation(step.semanticActionId, target.selectionToken, result))
          .toBe(false);
        expect(list().data.some((row: any) => row.product_key === target.productKey && row.rate_index === target.rateIndex)).toBe(true);
        const evidence = surface().probes!.find(probe => probe.id === 'search.list')!;
        expect(evidence.expectedCount).toBe(list().data.length);
        expect(evidence.expectedCount).toBeLessThanOrEqual(pageSize);
        expect(evidence.visibleCount).toBeGreaterThan(0);
        expect(evidence.visibleCount).toBeLessThanOrEqual(5);
        expect(surface().probes!.find(probe => probe.id === 'search.audit-target')!.status).toBe('ready');
      }
    }
    expect(useRatesSession.getState().sections.Mortgage.selected).toEqual(targets.map(target => target.selectionToken));
    expect(openCompare).toHaveBeenCalledWith(targets.map(target => target.selectionToken));
    expect(mockStore.getState().prefs).toEqual(preferences);
    expect(mockStore.getState().setPref).not.toHaveBeenCalled();
    let lastPage: unknown; act(() => { lastPage = surface().actions!['search.compare.page.0']({ selectionToken: '44#p-44' }); });
    await act(async () => { await lastPage; });
    expect(list().data).toHaveLength(5);
    expect(list().data.at(-1).rate_index).toBe(44);
    expect(surface().probes!.find(probe => probe.id === 'search.list')!.expectedCount).toBe(5);
  } finally {
    // The runner restores the same production snapshots after success/cancellation.
    act(() => { useMortgageComparison.setState(comparison); restoreRatesSession(before); });
    expect(captureRatesSession()).toEqual(before);
    expect(useMortgageComparison.getState()).toEqual(comparison);
    expect(mockStore.getState().prefs).toEqual(preferences);
    expect(list().data[0].rate_index).toBe(pageSize);
    act(() => tree.unmount());
  }
});

test('same-page preparation activates visible controls before selection without resetting scroll or selections', async () => {
  updateRatesSection('Mortgage', { selected: ['0#p-0'], selectMode: false });
  recordRatesScroll('Mortgage', 137);
  const tree = mount();
  const surface = () => jest.mocked(usePerformanceAuditSurface).mock.calls.at(-1)![0];
  try {
    expect(surface().actions!['search.compare.select.1']({ selectionToken: '1#p-1' })).toHaveProperty('unavailableReason');
    expect(useRatesSession.getState().sections.Mortgage.selected).toEqual(['0#p-0']);
    let result: unknown;
    let pending: unknown; act(() => { pending = surface().actions!['search.compare.page.1']({ selectionToken: '1#p-1' }); });
    await act(async () => { result = await pending; });
    expect(isVerifiedRatesPagePreparation('search.compare.page.1', '1#p-1', result)).toBe(false);
    expect(useRatesSession.getState().sections.Mortgage).toMatchObject({ page: 1, selectMode: true, scrollOffset: 137, selected: ['0#p-0'] });
    expect(tree.root.findAllByType('ProductCard').every((card: any) => card.props.selectMode === true)).toBe(true);
    act(() => { surface().actions!['search.compare.select.1']({ selectionToken: '1#p-1' }); });
    expect(useRatesSession.getState().sections.Mortgage.selected).toEqual(['0#p-0', '1#p-1']);
  } finally { act(() => tree.unmount()); }
});

test.each([10, 20] as const)('target pages use the sorted filtered results with %s rows per page', async pageSize => {
  mockStore.setState((state: any) => ({ prefs: { ...state.prefs, ratesPageSize: pageSize } }));
  updateRatesSection('Mortgage', { filters: { ...EMPTY_FILTERS, includeNonStandard: true, providers: ['B'] } });
  const tree = mount();
  const surface = () => jest.mocked(usePerformanceAuditSurface).mock.calls.at(-1)![0];
  try {
    let result: unknown;
    let pending: unknown; act(() => { pending = surface().actions!['search.compare.page.0']({ selectionToken: '35#p-35' }); });
    await act(async () => { result = await pending; });
    expect(result).toMatchObject({ resultIndex: 17, requestedPage: pageSize === 10 ? 2 : 1 });
    const rendered = tree.root.findByType('FlashList').props.data;
    expect(rendered.every((row: any) => row.provider === 'B')).toBe(true);
    expect(rendered.some((row: any) => row.rate_index === 35)).toBe(true);
    expect(rendered[0].rate_index).toBe(pageSize === 10 ? 21 : 1);
    act(() => { surface().actions!['search.compare.select.0']({ selectionToken: '35#p-35' }); });
    expect(useRatesSession.getState().sections.Mortgage.selected).toEqual(['35#p-35']);
  } finally { act(() => tree.unmount()); }
});

test('cancelled page preparation restores page, selection and scroll; absent or filtered targets never mutate state', async () => {
  updateRatesSection('Mortgage', { selected: ['0#p-0'], selectMode: true, page: 3 });
  recordRatesScroll('Mortgage', 219);
  updateRatesSection('Savings', { query: 'retained', page: 2 });
  updateRatesSection('Savings', { page: 2 });
  const before = captureRatesSession(), preferences = JSON.parse(JSON.stringify(mockStore.getState().prefs));
  let tree = mount();
  const surface = () => jest.mocked(usePerformanceAuditSurface).mock.calls.at(-1)![0];
  try {
    let pending: unknown; act(() => { pending = surface().actions!['search.compare.page.0']({ selectionToken: '35#p-35' }); });
    await act(async () => { await pending; });
    expect(useRatesSession.getState().sections.Mortgage.page).toBe(2);
    expect(useRatesSession.getState().sections.Mortgage.selected).toEqual(before.sections.Mortgage.selected);
    const prepared = captureRatesSession();
    expect(surface().actions!['search.compare.page.1']({ selectionToken: '35#missing' })).toHaveProperty('unavailableReason');
    expect(captureRatesSession()).toEqual(prepared);
    act(() => updateRatesSection('Mortgage', { filters: { ...EMPTY_FILTERS, includeNonStandard: true, providers: ['A'] } }));
    const filtered = captureRatesSession();
    // p-35 exists in core but is outside these actual results.
    expect(surface().actions!['search.compare.page.0']({ selectionToken: '35#p-35' })).toHaveProperty('unavailableReason');
    expect(captureRatesSession()).toEqual(filtered);
    act(() => tree.unmount());
    restoreRatesSession(before);
    tree = mount();
    expect(captureRatesSession()).toEqual(before);
    expect(tree.root.findByType('FlashList').props.data[0].rate_index).toBe(40);
    expect(mockStore.getState().prefs).toEqual(preferences);
    expect(mockStore.getState().setPref).not.toHaveBeenCalled();
  } finally { act(() => tree.unmount()); }
});

test('offscreen measurement rows cannot be selected; exact Cell, settled scroll and fresh viewport evidence are all required', async () => {
  updateRatesSection('Mortgage', { page: 2, selectMode: true });
  mockHoldScroll = true;
  const tree = mount();
  const surface = () => jest.mocked(usePerformanceAuditSurface).mock.calls.at(-1)![0];
  const probe = () => surface().probes!.find(p => p.id === 'search.audit-target')!;
  const action = (name: string) => surface().actions![name]({ selectionToken: '35#p-35' });
  const emit = (indices: number[], patch: object = {}) => {
    const list = tree.root.findByType('FlashList').props;
    act(() => list.onViewableItemsChanged({ viewableItems: indices.map(index => ({ item: list.data[index], index,
      key: list.keyExtractor(list.data[index], index), isViewable: true, ...patch })) }));
  };
  try {
    // Five actual Cells plus one Measurement: never all twenty page rows.
    expect(tree.root.findAllByType('ProductCard')).toHaveLength(6);
    expect(tree.root.findAllByType('ProductCard').some((card: any) => card.props.row.rate_index === 35)).toBe(true);
    expect(action('search.compare.select.1')).toEqual({ unavailableReason: 'The selected exact rate is not committed and visible' });
    expect(useRatesSession.getState().sections.Mortgage.selected).toEqual([]);
    let pending: any;
    act(() => { pending = action('search.compare.page.1'); });
    await act(async () => { await Promise.resolve(); });
    expect(mockScrollCalls).toEqual([15]);
    expect(probe()).toMatchObject({ actualCount: 1, visibleCount: 0, status: 'pending' });
    expect(surface().probes!.find(p => p.id === 'search.list')!.status).toBe('ready');
    expect(action('search.compare.select.1')).toHaveProperty('unavailableReason');
    // A projected native window before Promise completion is insufficient.
    mockAutoViewability = false;
    let receipt: unknown;
    await act(async () => { mockScrollResolutions.shift()!(); receipt = await pending; });
    expect(probe().status).toBe('pending');
    emit([13]); // Another visible row still cannot stand in for the exact target.
    expect(probe().status).toBe('pending');
    emit([15], { key: 'wrong-key' });
    expect(action('search.compare.select.1')).toHaveProperty('unavailableReason');
    emit([15]);
    await act(async () => { await pending; });
    expect(receipt).toMatchObject({ renderedSelectionToken: null, committedSelectionToken: null, viewableSelectionToken: null });
    expect(probe()).toMatchObject({ actualCount: 1, visibleCount: 1, status: 'ready' });
    act(() => { action('search.compare.select.1'); });
    expect(useRatesSession.getState().sections.Mortgage.selected).toEqual(['35#p-35']);
    emit([15]);
    const revision = surface().renderRevision;
    let repeated: unknown;
    act(() => { pending = action('search.compare.page.1'); });
    await act(async () => { repeated = await pending; });
    expect(isVerifiedRatesPagePreparation('search.compare.page.1', '35#p-35', repeated)).toBe(true);
    expect(mockScrollCalls).toEqual([15]);
    expect(surface().renderRevision).toBe(revision); // No fabricated render for a real no-op.
    expect(useRatesSession.getState().sections.Mortgage.selected).toEqual(['35#p-35']);
    // The actual selection remains the visible checkbox toggle, including a repeated action.
    act(() => { action('search.compare.select.1'); });
    expect(useRatesSession.getState().sections.Mortgage.selected).toEqual([]);
    act(() => mockNative.scrollToOffset({ offset: 0 }));
    emit([15]); // Delayed exact token is outside current geometry and no longer a Cell.
    expect(probe().required).toBe(false);
    expect(action('search.compare.select.1')).toHaveProperty('unavailableReason');
    act(() => { surface().actions!['search.section.next'](); });
    expect(surface().probes!.find(p => p.id === 'search.audit-target')!.required).toBe(false);
    expect(surface().probes!.filter(p => p.required && p.status === 'error')).toEqual([]);
  } finally { act(() => tree.unmount()); }
});

test('cancellation before list restoration prevents an unissued target scroll and preserves the snapshot', async () => {
  updateRatesSection('Mortgage', { page: 2, selectMode: true, selected: ['21#p-21'] });
  recordRatesScroll('Mortgage', 137);
  const before = captureRatesSession(), prefs = JSON.parse(JSON.stringify(mockStore.getState().prefs));
  mockEmitLoad = false;
  const tree = mount();
  const surface = () => jest.mocked(usePerformanceAuditSurface).mock.calls.at(-1)![0];
  const staleLoad = tree.root.findByType('FlashList').props.onLoad;
  let pending: any;
  act(() => { pending = surface().actions!['search.compare.page.1']({ selectionToken: '35#p-35' }); });
  act(() => { mockAuditCancelled = true; mockCancelListeners.forEach(listener => listener()); });
  await expect(pending).resolves.toHaveProperty('unavailableReason');
  expect(mockScrollCalls).toEqual([]);
  act(() => tree.unmount());
  act(() => { restoreRatesSession(before); staleLoad(); });
  expect(mockScrollCalls).toEqual([]);
  expect(captureRatesSession()).toEqual(before);
  expect(mockStore.getState().prefs).toEqual(prefs);
});

test('issued native scrolling drains before same-page rollback restores viewport, selection and private inputs', async () => {
  updateRatesSection('Mortgage', { page: 2, selectMode: true, selected: ['21#p-21'] });
  recordRatesScroll('Mortgage', 137);
  useMortgageComparison.setState({ loanAmount: '345678', lvr: '72' });
  const before = captureRatesSession(), inputs = { ...useMortgageComparison.getState() };
  const prefs = JSON.parse(JSON.stringify(mockStore.getState().prefs));
  mockHoldScroll = true;
  const tree = mount(), barrier = new PerformanceAuditMutationBarrier();
  const surface = () => jest.mocked(usePerformanceAuditSurface).mock.calls.at(-1)![0];
  try {
    let pending: any, finished = false;
    act(() => { pending = barrier.track(Promise.resolve(surface().actions!['search.compare.page.1']({ selectionToken: '35#p-35' }))); });
    void pending.then(() => { finished = true; });
    await act(async () => { await Promise.resolve(); });
    act(() => { mockAuditCancelled = true; mockCancelListeners.forEach(listener => listener()); });
    await act(async () => { await Promise.resolve(); });
    expect(finished).toBe(false); expect(barrier.hasPending).toBe(true);
    expect(await barrier.drain(1)).toBe(false);
    await act(async () => { mockScrollResolutions.shift()!(); await pending; });
    await expect(pending).resolves.toHaveProperty('unavailableReason');
    expect(await barrier.drain()).toBe(true);
    act(() => { restoreRatesSession(before); useMortgageComparison.setState(inputs); });
    expect(mockNative.getAbsoluteLastScrollOffset()).toBe(137);
    expect(captureRatesSession()).toEqual(before);
    expect(useMortgageComparison.getState()).toEqual(inputs);
    expect(mockStore.getState().prefs).toEqual(prefs);
  } finally { act(() => tree.unmount()); }
});

test('unmount after native issue never reports a false drain or runs late recovery scrolls', async () => {
  updateRatesSection('Mortgage', { page: 2, selectMode: true });
  mockHoldScroll = true;
  const tree = mount(), barrier = new PerformanceAuditMutationBarrier();
  let pending: any;
  act(() => { pending = barrier.track(Promise.resolve(jest.mocked(usePerformanceAuditSurface).mock.calls.at(-1)![0]
    .actions!['search.compare.page.1']({ selectionToken: '35#p-35' }))); });
  await act(async () => { await Promise.resolve(); });
  act(() => tree.unmount());
  expect(barrier.hasPending).toBe(true);
  expect(await barrier.drain(1)).toBe(false); // A real unresolved FlashList promise must keep recovery held.
  await act(async () => { mockScrollResolutions.shift()!(); await pending; });
  await expect(pending).resolves.toHaveProperty('unavailableReason');
  expect(await barrier.drain()).toBe(true);
  expect(mockScrollCalls).toEqual([15]);
});


test('a context change before deferred native issue cancels without scrolling the stale target', async () => {
  updateRatesSection('Mortgage', { page: 2, selectMode: true });
  const tree = mount();
  const surface = () => jest.mocked(usePerformanceAuditSurface).mock.calls.at(-1)![0];
  try {
    let pending: any;
    act(() => { pending = surface().actions!['search.compare.page.1']({ selectionToken: '35#p-35' }); });
    act(() => { surface().actions!['search.section.next'](); });
    await act(async () => { await pending; });
    await expect(pending).resolves.toHaveProperty('unavailableReason');
    expect(mockScrollCalls).toEqual([]);
    expect(surface().probes!.find(p => p.id === 'search.audit-target')!.required).toBe(false);
  } finally { act(() => tree.unmount()); }
});

test('a context change during issued native work drains without recomputing stale target visibility', async () => {
  updateRatesSection('Mortgage', { page: 2, selectMode: true });
  mockHoldScroll = true;
  const tree = mount(), barrier = new PerformanceAuditMutationBarrier();
  const surface = () => jest.mocked(usePerformanceAuditSurface).mock.calls.at(-1)![0];
  try {
    let pending: any;
    act(() => { pending = barrier.track(Promise.resolve(surface().actions!['search.compare.page.1']({ selectionToken: '35#p-35' }))); });
    await act(async () => { await Promise.resolve(); });
    const recompute = jest.spyOn(mockNative, 'recomputeViewableItems');
    act(() => { surface().actions!['search.section.next'](); });
    recompute.mockClear();
    expect(await barrier.drain(1)).toBe(false);
    await act(async () => { mockScrollResolutions.shift()!(); await pending; });
    await expect(pending).resolves.toHaveProperty('unavailableReason');
    expect(recompute).not.toHaveBeenCalled();
    expect(surface().probes!.find(p => p.id === 'search.audit-target')!.required).toBe(false);
  } finally { act(() => tree.unmount()); }
});

test('native target scroll rejection stays a rejected action instead of an optional-unavailable skip', async () => {
  updateRatesSection('Mortgage', { page: 2, selectMode: true });
  mockRejectScroll = true;
  const tree = mount();
  let pending: any;
  act(() => { pending = jest.mocked(usePerformanceAuditSurface).mock.calls.at(-1)![0]
    .actions!['search.compare.page.1']({ selectionToken: '35#p-35' }); });
  const rejected = expect(pending).rejects.toThrow('native target scroll failed');
  await act(async () => { await rejected; });
  expect(useRatesSession.getState().sections.Mortgage.selected).toEqual([]);
  act(() => tree.unmount());
});


test('step abort cancels preparation still waiting for load, drains safely and prevents late scrolling', async () => {
  updateRatesSection('Mortgage', { page: 2, selectMode: true });
  const before = captureRatesSession();
  mockEmitLoad = false;
  const tree = mount(), barrier = new PerformanceAuditMutationBarrier(), abort = new AbortController();
  const surface = () => jest.mocked(usePerformanceAuditSurface).mock.calls.at(-1)![0];
  let pending: any;
  try {
    act(() => { pending = barrier.track(Promise.resolve(surface().actions!['search.compare.page.1'](
      { selectionToken: '35#p-35' }, { signal: abort.signal }))); });
    expect(barrier.hasPending).toBe(true);
    act(() => { abort.abort(); }); // The runner aborts when its unchanged step watchdog expires.
    await act(async () => { await pending; });
    expect(await barrier.drain(0)).toBe(true);
    await expect(pending).resolves.toHaveProperty('unavailableReason');
    act(() => { restoreRatesSession(before); tree.root.findByType('FlashList').props.onLoad(); });
    await act(async () => { await Promise.resolve(); });
    expect(mockScrollCalls).toEqual([]);
    expect(captureRatesSession()).toEqual(before);
  } finally { act(() => tree.unmount()); }
});

test('native completion without exact viewability uses bounded readiness and permits safe rollback', async () => {
  updateRatesSection('Mortgage', { page: 2, selectMode: true, selected: ['21#p-21'] });
  recordRatesScroll('Mortgage', 137);
  useMortgageComparison.setState({ loanAmount: '345678', lvr: '72' });
  const before = captureRatesSession(), inputs = { ...useMortgageComparison.getState() };
  const tree = mount(), barrier = new PerformanceAuditMutationBarrier();
  const surface = () => jest.mocked(usePerformanceAuditSurface).mock.calls.at(-1)![0];
  mockAutoViewability = false;
  try {
    let pending: any;
    act(() => { pending = barrier.track(Promise.resolve(surface().actions!['search.compare.page.1']({ selectionToken: '35#p-35' }))); });
    await act(async () => { await pending; });
    expect(barrier.hasPending).toBe(false);
    const probe = surface().probes!.find(p => p.id === 'search.audit-target')!;
    expect(probe).toMatchObject({ required: true, status: 'pending', visibleCount: 0 });
    jest.useFakeTimers();
    const registry = new PerformanceAuditReadinessRegistry();
    registry.beginCapture('missing-exact-viewport');
    registry.registerSurface({ id: 'rates', probes: [probe] });
    let error: unknown;
    const wait = registry.waitForReady({ surfaceIds: ['rates'], timeoutMs: PERFORMANCE_AUDIT_STEP_LIMIT_MS })
      .catch(value => { error = value; });
    await jest.advanceTimersByTimeAsync(PERFORMANCE_AUDIT_STEP_LIMIT_MS + 1);
    await wait;
    expect(error).toBeInstanceOf(PerformanceAuditReadinessTimeoutError);
    expect(barrier.hasPending).toBe(false);
    jest.useRealTimers();
    expect(await barrier.drain(0)).toBe(true);
    act(() => { mockAuditCancelled = true; mockCancelListeners.forEach(listener => listener()); restoreRatesSession(before); useMortgageComparison.setState(inputs); });
    expect(mockNative.getAbsoluteLastScrollOffset()).toBe(137);
    expect(captureRatesSession()).toEqual(before);
    expect(useMortgageComparison.getState()).toEqual(inputs);
  } finally { jest.useRealTimers(); act(() => tree.unmount()); }
});


test.each([10, 20])('combined ready public catalogue uses exact virtualized offer keys and programme navigation with %s-row pages', async (pageSize) => {
  const products = rows.map(row => ({ ...publicProduct, productId: row.product_key, productKey: row.product_key, name: row.product_name, programmeIds: [`programme-${row.rate_index}`] }));
  const programmes = rows.map(row => currentProgramme(row, `programme-${row.rate_index}`, `offer-${row.rate_index}`));
  mockPublicCatalogue = { ...mockUnavailableCatalogue, ...publicCatalogueFixture(programmes, products, []), generationId: 'synthetic-generation-1' };
  mockStore.setState((state: any) => ({ prefs: { ...state.prefs, ratesPageSize: pageSize } }));
  updateRatesSection('Mortgage', { page: Math.floor(35 / pageSize) + 1, selectMode: true });
  const tree = mount(), token = publicOfferSelectionToken('p-35', 'offer-35');
  const surface = () => jest.mocked(usePerformanceAuditSurface).mock.calls.at(-1)![0];
  try {
    await act(async () => { await Promise.resolve(); });
    expect(surface().actions!['search.compare.select.1']({ selectionToken: token })).toHaveProperty('unavailableReason');
    let pending: unknown;
    act(() => { pending = surface().actions!['search.compare.page.1']({ selectionToken: token }); });
    await act(async () => { await pending; });
    const list = tree.root.findByType('FlashList').props;
    const localIndex = 35 % pageSize;
    expect(list.keyExtractor(list.data[localIndex], localIndex)).toBe(JSON.stringify(['rate', 'p-35', 'offer', 'offer-35']));
    expect(surface().probes!.find(probe => probe.id === 'search.audit-target')).toMatchObject({ status: 'ready', visibleCount: 1 });
    act(() => { surface().actions!['search.compare.select.1']({ selectionToken: token }); });
    expect(useRatesSession.getState().sections.Mortgage.selected).toEqual([token]);
    act(() => { updateRatesSection('Mortgage', { selectMode: false }); });
    const card = tree.root.findAllByType('ProductCard').find((node: any) => node.props.row.rate_index === 35);
    act(() => { card.props.onPress(); });
    expect(openProduct).toHaveBeenCalledWith('p-35', 35, 'programme-35');
  } finally { act(() => tree.unmount()); }
});

test('distinct opaque public pairs retain separate native keys and exact audit selection', async () => {
  const collisionRows = [{ ...rows.at(-1)!, product_key: 'UNIT-A', product_name: 'Loan A', rate_index: 0 },
    { ...rows.at(-2)!, product_key: 'UNIT', product_name: 'Loan B', rate_index: 1 }];
  const products = collisionRows.map((row, index) => ({ ...publicProduct, productId: row.product_key, productKey: row.product_key,
    name: row.product_name, programmeIds: [`collision-programme-${index}`] }));
  const programmes = collisionRows.map((row, index) => currentProgramme(row, `collision-programme-${index}`, index === 0 ? 'B' : 'A-B'));
  mockPublicCatalogue = { ...mockUnavailableCatalogue, ...publicCatalogueFixture(programmes, products, []), generationId: 'collision-generation' };
  mockStore.setState((state: any) => ({ core: { ...state.core, sections: { ...state.core.sections, Mortgage: { rates: collisionRows } } } }));
  install(); updateRatesSection('Mortgage', { selectMode: true });
  const tree = mount(), token = publicOfferSelectionToken('UNIT', 'A-B');
  const surface = () => jest.mocked(usePerformanceAuditSurface).mock.calls.at(-1)![0];
  try {
    await act(async () => { await Promise.resolve(); });
    const list = tree.root.findByType('FlashList').props;
    expect(list.data).toHaveLength(2);
    expect(new Set(list.data.map((row: any, index: number) => list.keyExtractor(row, index))).size).toBe(2);
    let pending: unknown;
    act(() => { pending = surface().actions!['search.compare.page.1']({ selectionToken: token }); });
    let prepared: unknown;
    await act(async () => { prepared = await pending; });
    expect(isVerifiedRatesPagePreparation('search.compare.page.1', token, prepared)).toBe(true);
    expect(surface().probes!.find(probe => probe.id === 'search.audit-target')).toMatchObject({ status: 'ready', visibleCount: 1 });
    act(() => { surface().actions!['search.compare.select.1']({ selectionToken: token }); });
    expect(useRatesSession.getState().sections.Mortgage.selected).toEqual([token]);
  } finally { act(() => tree.unmount()); }
});
