import React from 'react';
import type { RateRow } from '../src/types';
import TestRenderer, { act } from 'react-test-renderer';

import Search from '../src/components/rates/RatesWorkspace';
import { captureRatesSession, restoreRatesSession, initializeRatesSession, updateRatesSection, recordRatesScroll, useRatesSession } from '../src/data/ratesSession';
import { DEFAULT_PREFS } from '../src/data/storeTypes';
import { setSuitabilityAllowed } from '../src/data/suitabilityGate';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { rateConditionFixture } from '../testUtils/rateConditions';
import { router } from 'expo-router';
const originalRatesSession = captureRatesSession();
let mockParams: Record<string, string | string[]> = { section: 'TD' };

let mockState: any;
const mockEnsureDetails = jest.fn(async () => undefined);
const mockSurfaces = new Map<string, any>();
const mockListMount = jest.fn();
const mockListUnmount = jest.fn();
const mockRecomputeViewableItems = jest.fn();
const mockScrollToOffset = jest.fn();
const mockSearchMount = jest.fn();
const mockSearchUnmount = jest.fn();
let mockVisibleCount: number | null = null;
let mockSuppressViewability = false;
let mockNavigationReady = true;
let mockCommittedQuery: string | null = null;
let mockDimensions = { width: 411, height: 914, scale: 1, fontScale: 1 };
let mockBottomInset = 0;
const mockNavigationListeners = { ready: new Set<() => void>(), state: new Set<() => void>(), blur: new Set<() => void>() };
const mockNavigation = {
  isReady: () => mockNavigationReady,
  isFocused: () => true,
  addListener: (event: 'ready' | 'state' | 'blur', listener: () => void) => {
    mockNavigationListeners[event].add(listener); return () => mockNavigationListeners[event].delete(listener);
  },
};
jest.mock('../src/data/store', () => ({
  useStore: Object.assign((selector: any) => selector(mockState), { getState: () => mockState }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), setParams: jest.fn((values: Record<string, undefined>) => { if (!mockNavigationReady) throw new Error('Attempted to navigate before mounting the Root Layout'); mockParams = { ...mockParams, ...values } as any; }) }, Stack: { Screen: 'StackScreen' },
  useLocalSearchParams: () => mockParams,
  useNavigationContainerRef: () => mockNavigation,
}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true, useNavigation: () => mockNavigation }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ default: () => mockDimensions }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: mockBottomInset }) }));
jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => jest.requireActual('../src/theme/theme').lightTheme,
}));
jest.mock('../src/lib/yieldToUi', () => ({ scheduleAfterInteractions: () => () => undefined }));
jest.mock('../src/hooks/usePerformanceAuditReadiness', () => ({
  usePerformanceAuditSurface: (surface: any) => mockSurfaces.set(surface.id, surface),
}));
jest.mock('../src/hooks/useLogoReadiness', () => ({ useLogoReadiness: () => ({ ready: true }) }));
jest.mock('../src/hooks/useDebouncedValue', () => ({ useDebouncedValue: (value: string) => mockCommittedQuery ?? value }));
jest.mock('../src/hooks/useSearchFilterOptions', () => ({
  useSearchFilterOptions: () => ({ ready: true, options: {} }),
}));
jest.mock('@shopify/flash-list', () => {
  const React = jest.requireActual('react');
  return { FlashList: React.forwardRef(function MockFlashList(props: any, ref: any) {
    const measure = () => {
      if (!mockSuppressViewability) props.onViewableItemsChanged({ viewableItems:
        props.data.slice(0, mockVisibleCount ?? 3).map((item: unknown, index: number) => ({ isViewable: true, item, index, key: props.keyExtractor(item, index) })) });
    };
    const propsRef = React.useRef(props); propsRef.current = props;
    const measureRef = React.useRef(measure);
    measureRef.current = measure;
    const loadRef = React.useRef(props.onLoad);
    loadRef.current = props.onLoad;
    const { extraData, onCommitLayoutEffect } = props;
    React.useImperativeHandle(ref, () => ({
      get props() { return propsRef.current; }, getLayout: (index: number) => ({ x: 0, y: index * 100, height: 100, width: 320 }),
      getWindowSize: () => ({ width: 320, height: (mockVisibleCount ?? 3) * 100 }),
      getFirstItemOffset: () => 0, getAbsoluteLastScrollOffset: () => 0,
      computeVisibleIndices: () => ({ startIndex: 0, endIndex: Math.min(mockVisibleCount ?? 3, propsRef.current.data.length) - 1 }),
      scrollToIndex: () => Promise.resolve(), scrollToOffset: (...args: unknown[]) => mockScrollToOffset(...args), recomputeViewableItems: () => {
      mockRecomputeViewableItems(); measureRef.current();
    } }), []);
    React.useEffect(() => {
      mockListMount();
      measureRef.current();
      loadRef.current();
      return () => mockListUnmount();
    }, []);
    React.useEffect(() => { onCommitLayoutEffect(); }, [extraData, onCommitLayoutEffect]);
    return React.createElement('FlashList', props, props.ListHeaderComponent,
      props.data.length ? props.data.map((item: any, index: number) =>
        React.createElement('Rate', { key: index }, props.renderItem({ item, index, target: index < (mockVisibleCount ?? 3) ? 'Cell' : 'Measurement' })))
        : props.ListEmptyComponent);
  }) };
});
jest.mock('../src/components/SearchReportExport', () => ({ SearchReportExport: 'SearchReportExport' }));
jest.mock('../src/components/FilterSheet', () => ({ FilterSheet: 'FilterSheet' }));
jest.mock('../src/components/ProductCard', () => ({ ProductCard: 'ProductCard' }));
jest.mock('../src/components/Screen', () => ({ Screen: 'Screen', screenEdgeStyle: () => ({}), screenScrollContentStyle: () => ({}) }));
jest.mock('../src/components/IconAction', () => ({ IconAction: 'IconAction' }));
jest.mock('../src/components/controls', () => {
  const React = jest.requireActual('react');
  return { SegmentedControl: 'SegmentedControl', SearchBar: (props: any) => {
    const [focused, setFocused] = React.useState(false);
    React.useEffect(() => { mockSearchMount(); return () => mockSearchUnmount(); }, []);
    return React.createElement('SearchBar', { ...props, focused, onFocus: () => setFocused(true), onBlur: () => setFocused(false) });
  } };
});
jest.mock('../src/components/feedback', () => ({
  EmptyState: 'EmptyState', IndeterminateProgressBar: 'IndeterminateProgressBar', LoadingRows: 'LoadingRows', ScreenSkeleton: 'ScreenSkeleton',
}));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Card: 'Card', Chip: 'Chip', Row: 'Row' }));
jest.mock('../src/components/SheetSurface', () => ({ SheetSurface: 'SheetSurface' }));
jest.mock('../src/components/TouchTarget', () => ({ TouchTarget: 'TouchTarget' }));

beforeEach(() => {
  mockDimensions = { width: 411, height: 914, scale: 1, fontScale: 1 };
  mockBottomInset = 0;
  mockNavigationReady = true; mockNavigationListeners.ready.clear(); mockNavigationListeners.state.clear(); mockNavigationListeners.blur.clear();
  mockCommittedQuery = null;
  (router.setParams as jest.Mock).mockClear();
  restoreRatesSession(originalRatesSession); mockParams = { section: 'TD' };
  mockEnsureDetails.mockClear(); mockSurfaces.clear();
  mockListMount.mockClear(); mockListUnmount.mockClear();
  mockRecomputeViewableItems.mockClear(); mockScrollToOffset.mockClear(); mockVisibleCount = null; mockSuppressViewability = false;
  mockSearchMount.mockClear(); mockSearchUnmount.mockClear();
  jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => { callback(0); return 0; });
  const fixture = rateConditionFixture();
  mockState = { ...fixture, prefs: { ...DEFAULT_PREFS, enableDeepSearch: false }, subscriptions: [], hydrated: true, activeSection: 'TD', setActiveSection: jest.fn(),
    detailsLoading: false, ensureDetails: mockEnsureDetails, searchIndexStatus: 'idle' };
  setSuitabilityAllowed(new Set(), { rebuildClosed: true });
  installMandatoryEligibility({ active: false, loading: false, rows: new WeakSet(), productKeys: new Set() });
});
afterEach(() => {
  jest.restoreAllMocks();
  setSuitabilityAllowed(null);
  installMandatoryEligibility({ active: false, loading: false, rows: new WeakSet(), productKeys: new Set() });
});

test('a closed suitability gate offers recovery instead of claiming no products match', () => {
  let tree: any;
  act(() => { tree = TestRenderer.create(<Search />); });
  try {
    expect(tree.root.findByType('EmptyState' as any).props.title).toBe('Rates unavailable');
    expect(tree.root.findAllByProps({ title: 'Reset Rates view' })).toHaveLength(0);
    expect(tree.root.findByType('SearchReportExport' as any).props.disabled).toBe(true);
    expect(mockSurfaces.get('rates.results').probes.find((probe: any) => probe.id === 'search.list').status).toBe('pending');
    act(() => tree.root.findByProps({ title: 'Retry' }).props.onPress());
    expect(mockEnsureDetails).toHaveBeenCalledWith({ force: true, abandonInFlight: true });
    act(() => setSuitabilityAllowed(new Set([mockState.productKey])));
    expect(tree.root.findByType('FlashList' as any).props.data.length).toBeGreaterThan(0);
    expect(tree.root.findAllByType('EmptyState' as any)).toHaveLength(0);
  } finally { act(() => tree.unmount()); }
});

test('a details warm keeps the closed gate in a loading state', () => {
  mockState.detailsLoading = true;
  let tree: any;
  act(() => { tree = TestRenderer.create(<Search />); });
  try {
    expect(tree.root.findByType('IndeterminateProgressBar' as any).props.caption).toBe('Loading');
    expect(tree.root.findAllByType('EmptyState' as any)).toHaveLength(0);
  } finally { act(() => tree.unmount()); }
});

test('a verified empty result still offers the normal filter controls', () => {
  setSuitabilityAllowed(new Set());
  let tree: any;
  act(() => { tree = TestRenderer.create(<Search />); });
  try {
    expect(tree.root.findByType('EmptyState' as any).props.title).toBe('No matching products');
    expect(tree.root.findAllByProps({ title: 'Reset Rates view' })).toHaveLength(1);
    expect(tree.root.findAllByProps({ title: 'Retry' })).toHaveLength(0);
  } finally { act(() => tree.unmount()); }
});

test('the explicit full catalogue remains available while standard suitability is closed', () => {
  mockState.prefs.includeNonStandard = true;
  let tree: any;
  act(() => { tree = TestRenderer.create(<Search />); });
  try {
    expect(tree.root.findByType('FlashList' as any).props.data.length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ title: 'Retry' })).toHaveLength(0);
  } finally { act(() => tree.unmount()); }
});

test('full catalogue opt-in still waits for mandatory profile verification', () => {
  mockState.prefs.includeNonStandard = true;
  installMandatoryEligibility({ active: true, loading: true, rows: new WeakSet(), productKeys: new Set() });
  let tree: any;
  act(() => { tree = TestRenderer.create(<Search />); });
  try {
    expect(tree.root.findByType('FlashList' as any).props.data).toHaveLength(0);
    expect(tree.root.findByType('EmptyState' as any).props.title).toBe('Rates unavailable');
    expect(tree.root.findByType('SearchReportExport' as any).props.disabled).toBe(true);
  } finally { act(() => tree.unmount()); }
});

test.each(['', '   '])('an empty committed query %j renders real prepared rates while the optional index is pending', (query) => {
  setSuitabilityAllowed(new Set([mockState.productKey]));
  mockState = { ...mockState, prefs: { ...mockState.prefs, enableDeepSearch: true },
    searchIndex: null, searchIndexStatus: 'loading' };
  initializeRatesSession(mockState.prefs, 'TD');
  updateRatesSection('TD', { query });
  let tree: any; act(() => { tree = TestRenderer.create(<Search />); });
  try {
    const list = tree.root.findByType('FlashList' as any);
    const actualRows = mockState.core.sections.TD.rates;
    expect(list.props.data).toHaveLength(actualRows.length);
    for (const row of list.props.data) expect(actualRows).toContain(row);
    expect(tree.root.findAllByType('ProductCard' as any)).toHaveLength(actualRows.length);
    expect(tree.root.findAllByType('LoadingRows' as any)).toHaveLength(0);
    expect(tree.root.findByType('SearchReportExport' as any).props.disabled).toBe(false);
    const surface = () => mockSurfaces.get('rates.results');
    expect(surface().probes.find((probe: any) => probe.id === 'search.data').status).toBe('ready');
    expect(surface().probes.find((probe: any) => probe.id === 'search.list')).toMatchObject({
      status: 'ready', actualCount: actualRows.length, visibleCount: Math.min(3, actualRows.length),
    });
    const revision = surface().renderRevision;
    const preparedRows = list.props.data;
    act(() => list.props.onScroll({ nativeEvent: { contentOffset: { y: 312 } } }));
    const restored = mockScrollToOffset.mock.calls.length;
    mockState = { ...mockState, searchIndexStatus: 'ready', searchIndex: {
      schema_version: 1, run_date: mockState.core.run_date, products: { [mockState.productKey]: 'indexed details' },
    } };
    act(() => tree.update(<Search />));
    expect(list.props.data).toBe(preparedRows);
    expect(surface().renderRevision).toBe(revision);
    expect(mockScrollToOffset).toHaveBeenCalledTimes(restored);
    expect(useRatesSession.getState().sections.TD.scrollOffset).toBe(312);
  } finally { act(() => tree.unmount()); }
});

test('only the committed nonempty query waits for and consumes the actual deep-search index', () => {
  setSuitabilityAllowed(new Set([mockState.productKey]));
  mockState = { ...mockState, prefs: { ...mockState.prefs, enableDeepSearch: true },
    searchIndex: null, searchIndexStatus: 'loading' };
  mockCommittedQuery = '';
  let tree: any; act(() => { tree = TestRenderer.create(<Search />); });
  try {
    const dataProbe = () => mockSurfaces.get('rates.results').probes.find((probe: any) => probe.id === 'search.data');
    const list = tree.root.findByType('FlashList' as any);
    act(() => tree.root.findByType('SearchBar' as any).props.onChangeText('indexed details'));
    expect(tree.root.findByType('SearchBar' as any).props.value).toBe('indexed details');
    expect(list.props.data.length).toBeGreaterThan(0);
    expect(dataProbe().status).toBe('ready');
    // The live input has changed, but exporting cannot use the previous committed query.
    expect(tree.root.findByType('SearchReportExport' as any).props.disabled).toBe(true);
    mockCommittedQuery = null;
    act(() => tree.update(<Search />));
    expect(list.props.data).toHaveLength(0);
    expect(dataProbe().status).toBe('pending');
    expect(tree.root.findAllByType('LoadingRows' as any)).toHaveLength(1);
    expect(tree.root.findAllByType('EmptyState' as any)).toHaveLength(0);
    mockState = { ...mockState, searchIndexStatus: 'ready', searchIndex: {
      schema_version: 1, run_date: mockState.core.run_date, products: { [mockState.productKey]: 'indexed details' },
    } };
    act(() => tree.update(<Search />));
    expect(list.props.data).toHaveLength(mockState.core.sections.TD.rates.length);
    expect(dataProbe().status).toBe('ready');
    expect(tree.root.findByType('SearchReportExport' as any).props.disabled).toBe(false);
  } finally { act(() => tree.unmount()); }
});

test('an empty query with a pending index still blocks invalidated source suitability and mandatory eligibility', () => {
  setSuitabilityAllowed(new Set([mockState.productKey]));
  mockState = { ...mockState, prefs: { ...mockState.prefs, enableDeepSearch: true },
    searchIndex: null, searchIndexStatus: 'loading' };
  let tree: any; act(() => { tree = TestRenderer.create(<Search />); });
  try {
    const probe = () => mockSurfaces.get('rates.results').probes.find((entry: any) => entry.id === 'search.data');
    expect(probe().status).toBe('ready');
    act(() => setSuitabilityAllowed(new Set(), { rebuildClosed: true }));
    expect(probe().status).toBe('pending');
    expect(tree.root.findByType('FlashList' as any).props.data).toHaveLength(0);
    expect(tree.root.findByType('EmptyState' as any).props.title).toBe('Rates unavailable');
    expect(tree.root.findByType('SearchReportExport' as any).props.disabled).toBe(true);
    act(() => setSuitabilityAllowed(new Set([mockState.productKey])));
    expect(probe().status).toBe('ready');
    act(() => installMandatoryEligibility({ active: true, loading: true, rows: new WeakSet(), productKeys: new Set() }));
    expect(probe().status).toBe('pending');
    expect(tree.root.findByType('FlashList' as any).props.data).toHaveLength(0);
    expect(tree.root.findByType('SearchReportExport' as any).props.disabled).toBe(true);
    // No core/source is never a prepared-ready Rates screen.
    mockState = { ...mockState, core: null };
    act(() => tree.update(<Search />));
    expect(probe().status).toBe('pending');
    expect(tree.root.findAllByType('FlashList' as any)).toHaveLength(0);
    expect(tree.root.findAllByType('ScreenSkeleton' as any)).toHaveLength(1);
  } finally { act(() => tree.unmount()); }
});

test('audit comparison reports a missing filtered rate immediately and can clear the bank filter', () => {
  mockState.prefs.includeNonStandard = true;
  let tree: any;
  act(() => { tree = TestRenderer.create(<Search />); });
  try {
    act(() => mockSurfaces.get('rates.results').actions['search.filters.open']());
    act(() => mockSurfaces.get('rates.results').actions['search.filter.provider.first']({ provider: 'Missing Bank' }));
    act(() => mockSurfaces.get('rates.results').actions['search.filters.apply']());
    expect(tree.root.findByType('FlashList' as any).props.data).toHaveLength(0);
    expect(mockSurfaces.get('rates.results').actions['search.compare.select.0']({ selectionToken: 'missing' }))
      .toEqual({ unavailableReason: 'The selected exact rate is not on the rendered results page' });
    act(() => mockSurfaces.get('rates.results').actions['search.filters.clear']());
    expect(tree.root.findByType('FlashList' as any).props.data.length).toBeGreaterThan(0);
  } finally { act(() => tree.unmount()); }
});

test('deep search retries when a cached edition is confirmed live, without a retry card', () => {
  const ensureSearchIndex = jest.fn(async () => undefined);
  mockState = {
    ...mockState, prefs: { ...mockState.prefs, enableDeepSearch: true }, source: 'cache',
    searchIndex: null, searchIndexStatus: 'unavailable', ensureSearchIndex,
    searchIndexError: 'Deep search needs the optional live search index.',
  };
  let tree: any;
  act(() => { tree = TestRenderer.create(<Search />); });
  try {
    expect(ensureSearchIndex).not.toHaveBeenCalled();
    expect(tree.root.findAllByProps({ title: 'Retry deep search' })).toHaveLength(0);
    // A refresh that confirms the same edition only promotes the source.
    mockState = { ...mockState, source: 'remote' };
    act(() => tree.update(<Search />));
    expect(ensureSearchIndex).toHaveBeenCalledTimes(1);
  } finally { act(() => tree.unmount()); }
});

test('unavailable results that cycle through loading on a live source do not re-run deep search', () => {
  const ensureSearchIndex = jest.fn(async () => undefined);
  mockState = {
    ...mockState, prefs: { ...mockState.prefs, enableDeepSearch: true }, source: 'remote',
    searchIndex: null, searchIndexStatus: 'unavailable', ensureSearchIndex,
    searchIndexError: 'Deep search is not cached for this data edition. Basic name search still works.',
  };
  let tree: any;
  act(() => { tree = TestRenderer.create(<Search />); });
  try {
    // A local audit's ensure reports loading, then unavailable again.
    for (const searchIndexStatus of ['loading', 'unavailable', 'loading', 'unavailable']) {
      mockState = { ...mockState, searchIndexStatus };
      act(() => tree.update(<Search />));
    }
    expect(ensureSearchIndex).not.toHaveBeenCalled();
  } finally { act(() => tree.unmount()); }
});

test('comparison and filter disclosure commit without remounting unchanged search results', () => {
  mockState.prefs.includeNonStandard = true;
  let tree: any;
  act(() => { tree = TestRenderer.create(<Search />); });
  try {
    const initialRows = tree.root.findByType('FlashList' as any).props.data;
    const first = initialRows[0];
    const measuredCount = Math.min(3, initialRows.length);
    const listProbe = () => mockSurfaces.get('rates.results').probes.find((probe: any) => probe.id === 'search.list');
    expect(listProbe().visibleCount).toBe(measuredCount);
    let measurements = mockRecomputeViewableItems.mock.calls.length;
    const token = `${first.rate_index}#${first.product_key}`;
    let previousRevision = mockSurfaces.get('rates.results').renderRevision;
    let previousListRevision = tree.root.findByType('FlashList' as any).props.extraData;
    for (const [action, parameters] of [
      ['search.filters.open'], ['search.filters.apply'], ['search.compare.mode'],
      ['search.compare.select.0', { selectionToken: token }],
    ] as const) {
      act(() => mockSurfaces.get('rates.results').actions[action](parameters));
      expect(mockListMount).toHaveBeenCalledTimes(1);
      expect(mockListUnmount).not.toHaveBeenCalled();
      expect(tree.root.findByType('FlashList' as any).props.data).toBe(initialRows);
      const revision = mockSurfaces.get('rates.results').renderRevision;
      expect(revision).not.toBe(previousRevision);
      const listRevision = tree.root.findByType('FlashList' as any).props.extraData;
      expect(listRevision).not.toBe(previousListRevision);
      expect(mockSurfaces.get('rates.results').probes.find((probe: any) => probe.id === 'search.layout').renderRevision).toBe(revision);
      previousListRevision = listRevision;
      expect(listProbe().visibleCount).toBe(measuredCount);
      expect(mockRecomputeViewableItems).toHaveBeenCalledTimes(++measurements);
      previousRevision = revision;
    }
    expect(tree.root.findAllByType('ProductCard' as any)[0].props.selected).toBe(true);
    // Applied filters keep the input mounted, with a new commit/measurement.
    act(() => mockSurfaces.get('rates.results').actions['search.filters.open']());
    act(() => mockSurfaces.get('rates.results').actions['search.filter.provider.first']({ provider: 'Missing Bank' }));
    act(() => mockSurfaces.get('rates.results').actions['search.filters.apply']());
    expect(mockListMount).toHaveBeenCalledTimes(1);
    expect(mockListUnmount).not.toHaveBeenCalled();
    expect(tree.root.findByType('FlashList' as any).props.data).toHaveLength(0);
    expect(listProbe().visibleCount).toBe(0);
  } finally { act(() => tree.unmount()); }
});

test('an updated native viewport with no visible rows never inherits an earlier positive measurement', () => {
  mockState.prefs.includeNonStandard = true;
  let tree: any;
  act(() => { tree = TestRenderer.create(<Search />); });
  try {
    const listProbe = () => mockSurfaces.get('rates.results').probes.find((probe: any) => probe.id === 'search.list');
    expect(listProbe().visibleCount).toBeGreaterThan(0);
    mockVisibleCount = 0;
    act(() => mockSurfaces.get('rates.results').actions['search.compare.mode']());
    expect(mockListMount).toHaveBeenCalledTimes(1);
    expect(listProbe().visibleCount).toBe(0);
    expect(listProbe().status).toBe('pending');
  } finally { act(() => tree.unmount()); }
});

test('a missing fresh native callback leaves the current viewport unverified', () => {
  mockState.prefs.includeNonStandard = true;
  let tree: any;
  act(() => { tree = TestRenderer.create(<Search />); });
  try {
    const listProbe = () => mockSurfaces.get('rates.results').probes.find((probe: any) => probe.id === 'search.list');
    expect(listProbe().visibleCount).toBeGreaterThan(0);
    mockSuppressViewability = true;
    act(() => mockSurfaces.get('rates.results').actions['search.compare.mode']());
    expect(mockListMount).toHaveBeenCalledTimes(1);
    expect(listProbe().visibleCount).toBeNull();
    expect(listProbe().status).toBe('pending');
    act(() => tree.root.findByType('FlashList' as any).props.onViewableItemsChanged({
      viewableItems: [{ isViewable: true, item: tree.root.findByType('FlashList' as any).props.data[0] }],
    }));
    expect(listProbe().visibleCount).toBe(1);
    expect(listProbe().status).toBe('ready');
  } finally { act(() => tree.unmount()); }
});


test('filter Cancel discards the real draft and preserves query/type/sort/offset', () => {
  mockState.prefs.includeNonStandard = true;
  let tree: any; act(() => { tree = TestRenderer.create(<Search />); });
  try {
    const list = tree.root.findByType('FlashList' as any);
    act(() => tree.root.findByType('SearchBar' as any).props.onChangeText('Macquarie'));
    act(() => tree.root.findByProps({ word: 'Bank' }).props.onPress());
    act(() => list.props.onScroll({ nativeEvent: { contentOffset: { y: 312 } } }));
    const initialRows = list.props.data, before = captureRatesSession();
    act(() => mockSurfaces.get('rates.results').actions['search.filters.open']());
    act(() => mockSurfaces.get('rates.results').actions['search.filter.provider.first']({ provider: 'Missing Bank' }));
    expect(tree.root.findByType('FlashList' as any).props.data).toBe(initialRows);
    act(() => tree.root.findByType('FilterSheet' as any).props.onClose());
    expect(tree.root.findByType('FlashList' as any).props.data).toBe(initialRows);
    expect(tree.root.findByType('FilterSheet' as any).props.visible).toBe(false);
    expect(captureRatesSession()).toEqual(before);
    expect(mockScrollToOffset).toHaveBeenLastCalledWith({ offset: 0, animated: false });
  } finally { act(() => tree.unmount()); }
});
test('the canonical list pages all 24 rows in groups of 20 and taps preserve the exact rate', () => {
  mockState.prefs.includeNonStandard = true;
  const sample = mockState.core.sections.TD.rates[0];
  mockState.core.sections.TD.rates = Array.from({ length: 24 }, (_, index) => ({ ...sample, product_key: 'p-' + index, rate_index: index, rate: '0.045' }));
  let tree: any; act(() => { tree = TestRenderer.create(<Search />); });
  try {
    const list = tree.root.findByType('FlashList' as any); expect(list.props.data).toHaveLength(20);
    expect(list.props.ListFooterComponent.props).toMatchObject({ total: 24, page: 1, size: 20 });
    const card = tree.root.findAllByType('ProductCard' as any)[0]; act(() => card.props.onPress());
    expect(router.push).toHaveBeenCalledWith({ pathname: '/product/[key]', params: { key: card.props.row.product_key, ri: String(card.props.row.rate_index), origin: 'rates-comparison' } });
    expect(mockSurfaces.get('rates.results').routeKey).toBe('/browse');
    act(() => list.props.ListFooterComponent.props.onPage(2));
    expect(list.props.data.map((row: RateRow) => row.rate_index)).toEqual([20, 21, 22, 23]);
  } finally { act(() => tree.unmount()); }
});
test('unlisted entries stay verified product identities without fabricated rates or description UI', () => {
  mockState.prefs.includeNonStandard = true;
  mockState.details.products['unlisted-key'] = { description: 'Unique provider marketing sentence', displayIdentity: { name: 'Verified Name', provider: 'Recorded Bank' } };
  let tree: any; act(() => { tree = TestRenderer.create(<Search />); });
  try {
    act(() => mockSurfaces.get('rates.results').actions['search.filters.open']());
    const availability = tree.root.findAllByType('SegmentedControl' as any).find((node: any) => node.props.options.some((option: any) => option.value === 'unlisted'));
    act(() => availability.props.onChange('unlisted'));
    act(() => mockSurfaces.get('rates.results').actions['search.filters.apply']());
    const data = tree.root.findByType('FlashList' as any).props.data; expect(data).toHaveLength(1);
    expect(data[0]).not.toHaveProperty('rate'); expect(tree.root.findAllByType('ProductCard' as any)).toHaveLength(0);
    expect(tree.root.findAllByType('AppText' as any).map((node: any) => String(node.props.children)).join(' ')).not.toContain('Unique provider marketing sentence');
    const row = tree.root.findAllByType('TouchTarget' as any).find((node: any) => node.props.accessibilityLabel === 'Verified Name');
    act(() => row.props.onPress());
    expect(router.push).toHaveBeenCalledWith({ pathname: '/product/[key]', params: { key: 'unlisted-key' } });
  } finally { act(() => tree.unmount()); }
});

test('a queued scroll restoration cannot affect a replacement product-type list', () => {
  mockState.prefs.includeNonStandard = true; mockParams = {};
  initializeRatesSession(mockState.prefs, 'TD'); recordRatesScroll('TD', 420);
  const frames: FrameRequestCallback[] = [];
  const raf = jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
  let tree: any; act(() => { tree = TestRenderer.create(<Search />); });
  try {
    act(() => tree.root.findByType('FlashList' as any).props.onLoad());
    act(() => mockSurfaces.get('rates.results').actions['search.section.next']());
    act(() => frames.forEach(callback => callback(0)));
    expect(mockScrollToOffset).toHaveBeenCalledTimes(1);
    expect(mockScrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: false });
    expect(useRatesSession.getState().section).toBe('Mortgage');
    expect(useRatesSession.getState().sections.TD.scrollOffset).toBe(420);
  } finally { act(() => tree.unmount()); raf.mockRestore(); }
});


test('cold parameterized Rates waits for container-ready before consuming and clearing its intent', () => {
  mockState.prefs.includeNonStandard = true; mockNavigationReady = false;
  mockParams = { section: 'TD', query: 'Macquarie', path: '' };
  let tree: any; act(() => { tree = TestRenderer.create(<Search />); });
  try {
    expect(router.setParams).not.toHaveBeenCalled();
    expect(useRatesSession.getState().initialized).toBe(false);
    act(() => { mockNavigationReady = true; [...mockNavigationListeners.ready].forEach(listener => listener()); });
    expect(router.setParams).toHaveBeenCalledTimes(1);
    expect(useRatesSession.getState().sections.TD.query).toBe('Macquarie');
    expect(tree.root.findByType('FlashList' as any).props.data.length).toBeGreaterThan(0);
    act(() => [...mockNavigationListeners.state].forEach(listener => listener()));
    expect(router.setParams).toHaveBeenCalledTimes(1);
  } finally { act(() => tree.unmount()); }
});


test.each([
  [411, 1],
  [360, 1.3],
  [320, 2],
])('five Rates icon actions fit at %s dp and font scale %s without a second quick-action row', (width, fontScale) => {
  mockDimensions = { ...mockDimensions, width, fontScale };
  mockState.prefs.includeNonStandard = true;
  let tree: any; act(() => { tree = TestRenderer.create(<Search />); });
  try {
    const controls = ['Filter', 'Sort', 'Compare', 'Bank', 'More'].map(word =>
      tree.root.findByProps({ word }));
    const toolbar = controls[0].parent;
    expect(controls.every(control => control.parent === toolbar)).toBe(true);
    expect(toolbar.props.style.flexWrap).toBe('wrap');
    const contentWidth = width - 32;
    expect(controls.every(control => control.type === 'IconAction')).toBe(true);
    expect(controls.length * 48 + (controls.length - 1) * toolbar.props.gap).toBeLessThanOrEqual(contentWidth);
    expect(tree.root.findByType('FlashList' as any).findAllByType('Button' as any).filter((node: any) =>
      ['Filter', 'Sort', 'Compare', 'Bank A–Z'].includes(node.props.title))).toHaveLength(0);
    const actions = tree.root.findByProps({ accessibilityLabel: 'Search actions' });
    expect(actions.parent).toBe(toolbar);
    expect(actions.props.word).toBe('More');
    expect(actions.props.icon).toBe('ellipsis-horizontal');
    expect(tree.root.findByProps({ testID: 'rates-task-controls' }).findAllByType('AppText' as any).map((node: any) =>
      React.Children.toArray(node.props.children).join(''))).toEqual([
        tree.root.findByType('FlashList' as any).props.data.length + ' rates', 'Advertised',
      ]);
    expect(tree.root.findByType('FlashList' as any).props.contentContainerStyle.paddingTop).toBe(0);
    act(() => controls[0].props.onPress());
    const filter = tree.root.findByType('FilterSheet' as any);
    expect(filter.props.visible).toBe(true);
    act(() => filter.props.onApply({ ...filter.props.filters, providers: ['Macquarie'] }));
    expect(controls[0].props.badge).toBe(1);
    expect(controls[0].props.accessibilityLabel).toBe('Temporary filters (1)');
    act(() => controls[1].props.onPress());
    expect(tree.root.findAllByType('SheetSurface' as any).some((node: any) => node.props.visible && node.props.title === 'Sort')).toBe(true);
    act(() => controls[2].props.onPress());
    const done = tree.root.findByProps({ word: 'Done' });
    expect(done.props.icon).toBe('checkmark-circle');
    expect(done.props.accessibilityState).toEqual({ selected: true });
    expect(done.props.active).toBe(true);
    act(() => controls[3].props.onPress());
    expect(useRatesSession.getState().sections.TD.sort).toBe('bank');
    expect(controls[3].props.accessibilityLabel).toBe('Bank A–Z');
    expect(controls[3].props.accessibilityState).toEqual({ selected: true });
    act(() => controls[3].props.onPress());
    expect(useRatesSession.getState().sections.TD.sort).toBe('rate');
    act(() => actions.props.onPress());
    expect(tree.root.findAllByType('SheetSurface' as any).some((node: any) => node.props.visible && node.props.title === 'Search')).toBe(true);
  } finally { act(() => tree.unmount()); }
});

test.each([[411, 1], [360, 2]])('task controls remain outside a scrolled list at %s dp / %s font scale with direct search and one filter sheet', (width, fontScale) => {
  mockDimensions = { ...mockDimensions, width, fontScale };
  mockState.prefs.includeNonStandard = true;
  let tree: any; act(() => { tree = TestRenderer.create(<Search />); });
  try {
    const list = tree.root.findByType('FlashList' as any);
    const controls = tree.root.findByProps({ testID: 'rates-task-controls' });
    expect(list.props.ListHeaderComponent).toBeDefined();
    expect(list.findAllByType('SearchBar' as any)).toHaveLength(0);
    expect(controls.findAllByType('SearchBar' as any)).toHaveLength(1);
    act(() => list.props.onScroll({ nativeEvent: { contentOffset: { y: 2400 } } }));
    expect(useRatesSession.getState().sections.TD.scrollOffset).toBe(2400);
    expect(list.props.keyboardShouldPersistTaps).toBe('handled');
    expect(list.props.keyboardDismissMode).toBe('on-drag');
    expect(list.props.maintainVisibleContentPosition).toEqual({ disabled: true });
    const input = controls.findByType('SearchBar' as any);
    expect(input.props.value).toBe('');
    expect(input.props.placeholder).toBe('Search');
    expect(input.props.accessibilityLabel).toBe('Search rates or banks');
    expect(input.props.onSubmitEditing).toBeUndefined();
    expect(list.findAllByType('Button' as any).filter((node: any) => node.props.title === 'Search')).toHaveLength(0);
    act(() => tree.root.findByProps({ word: 'Filter' }).props.onPress());
    expect(tree.root.findAllByType('FilterSheet' as any)).toHaveLength(1);
    expect(tree.root.findByType('FilterSheet' as any).props.visible).toBe(true);
    expect(useRatesSession.getState().sections.TD.scrollOffset).toBe(2400);
    expect(tree.root.findByProps({ testID: 'rates-task-controls' })).toBe(controls);
    expect(mockSearchMount).toHaveBeenCalledTimes(1);
    expect(mockSearchUnmount).not.toHaveBeenCalled();
  } finally { act(() => tree.unmount()); }
});

test.each([[360, 2], [320, 2], [360, 1.3]])('summary metadata reserves a whole line at %s dp / %s font scale without shrinking its label', (width, fontScale) => {
  mockDimensions = { ...mockDimensions, width, fontScale };
  mockParams = { section: 'Mortgage' };
  mockState.prefs.mortgageRateMetric = 'comparison';
  mockState.prefs.includeNonStandard = true;
  let tree: any; act(() => { tree = TestRenderer.create(<Search />); });
  try {
    const actions = tree.root.findByProps({ accessibilityLabel: 'Search actions' });
    const summary = tree.root.findByProps({ testID: 'rates-task-controls' }).findAllByType('AppText' as any)
      .find((node: any) => node.props.children === 'Comparison');
    expect(summary).toBeDefined();
    expect(summary.props.accessibilityLabel).toBe('Comparison rate');
    expect(summary.parent.props.style).toMatchObject({ width: '100%', flexShrink: 0 });
    expect(summary.parent).not.toBe(actions.parent);
    expect(actions.parent.props.style.flexWrap).toBe('wrap');
    expect(summary.parent.findAllByType('Button' as any)).toHaveLength(0);
    expect(summary.props.numberOfLines).toBeUndefined();
    expect(summary.props.adjustsFontSizeToFit).toBeUndefined();
    expect(summary.props.allowFontScaling).not.toBe(false);
    act(() => actions.parent.findByProps({ word: 'Bank' }).props.onPress());
    expect(useRatesSession.getState().sections.Mortgage.sort).toBe('bank');
    act(() => actions.props.onPress());
    expect(tree.root.findAllByType('SheetSurface' as any).some((node: any) => node.props.visible && node.props.title === 'Search')).toBe(true);
  } finally { act(() => tree.unmount()); }
});

test.each([[411, 1, 0], [360, 2, 48]])('Compare reserves its own bottom space at %s dp / %s font scale / %s inset without replacing exact selections', (width, fontScale, bottomInset) => {
  mockDimensions = { ...mockDimensions, width, fontScale };
  mockBottomInset = bottomInset;
  mockState.prefs.includeNonStandard = true;
  (router.push as jest.Mock).mockClear();
  let tree: any; act(() => { tree = TestRenderer.create(<Search />); });
  try {
    const list = tree.root.findByType('FlashList' as any);
    const input = tree.root.findByType('SearchBar' as any);
    const rows = list.props.data.slice(0, 2);
    expect(rows).toHaveLength(2);
    expect(rows[0].product_key).toBe(rows[1].product_key);
    expect(rows[0].rate_index).not.toBe(rows[1].rate_index);
    const tokens = rows.map((row: any) => `${row.rate_index}#${row.product_key}`);
    act(() => input.props.onFocus());
    act(() => list.props.onScroll({ nativeEvent: { contentOffset: { y: 420 } } }));
    act(() => tree.root.findByProps({ word: 'Compare' }).props.onPress());
    const cards = tree.root.findAllByType('ProductCard' as any).slice(0, 2);
    act(() => cards[0].props.onPress());
    expect(tree.root.findAllByProps({ testID: 'rates-compare-dock' })).toHaveLength(0);
    act(() => cards[1].props.onPress());

    const dock = tree.root.findByProps({ testID: 'rates-compare-dock' });
    const button = dock.findByType('TouchTarget' as any);
    const screen = tree.root.findByType('Screen' as any);
    const children = React.Children.toArray(screen.props.children) as React.ReactElement<any>[];
    const listBodyIndex = children.findIndex(child => child.props.style?.flex === 1);
    expect(listBodyIndex).toBeGreaterThanOrEqual(0);
    expect(children[listBodyIndex + 1].type).toBe(dock.parent.type);
    expect(dock.props.style).toMatchObject({ flexShrink: 0, paddingVertical: 8 });
    expect(dock.props.style.position).toBeUndefined();
    expect(dock.props.style.bottom).toBeUndefined();
    expect(dock.props.style.paddingBottom).toBeUndefined();
    const buttonStyle = button.props.style({ pressed: false });
    expect(buttonStyle.minHeight).toBeGreaterThanOrEqual(56);
    expect(buttonStyle.position).toBeUndefined();
    expect(buttonStyle.height).toBeUndefined();
    expect(button.props.fill).toBe(true);
    expect(button.props.accessibilityLabel).toBe('Compare 2');
    expect(list.props.contentContainerStyle.paddingBottom).toBe(24);
    expect(list.props.keyboardShouldPersistTaps).toBe('handled');
    expect(list.props.keyboardDismissMode).toBe('on-drag');

    act(() => button.props.onPress());
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/compare', params: { keys: JSON.stringify(tokens) } });
    expect(cards.map((card: any) => card.props.selected)).toEqual([true, true]);
    expect(useRatesSession.getState().sections.TD.scrollOffset).toBe(420);
    expect(tree.root.findByType('FlashList' as any)).toBe(list);
    expect(tree.root.findByType('SearchBar' as any)).toBe(input);
    expect(input.props.focused).toBe(true);
    expect(mockListMount).toHaveBeenCalledTimes(1);
    expect(mockSearchMount).toHaveBeenCalledTimes(1);
    act(() => cards[0].props.onPress());
    expect(tree.root.findAllByProps({ testID: 'rates-compare-dock' })).toHaveLength(0);
    expect(cards[1].props.selected).toBe(true);
    expect(mockListUnmount).not.toHaveBeenCalled();
    expect(mockSearchUnmount).not.toHaveBeenCalled();
  } finally { act(() => tree.unmount()); }
});

test('changing result scopes keeps the focused input and exact rate rows mounted', () => {
  mockState.prefs.includeNonStandard = true;
  let tree: any; act(() => { tree = TestRenderer.create(<Search />); });
  try {
    const input = tree.root.findByType('SearchBar' as any);
    const list = tree.root.findByType('FlashList' as any);
    const viewability = list.props.onViewableItemsChanged;
    const exactRows = mockState.core.sections.TD.rates;
    act(() => input.props.onFocus());
    for (const value of ['Macquarie', 'No matching bank', 'Macquarie']) {
      act(() => input.props.onChangeText(value));
      expect(tree.root.findByType('SearchBar' as any)).toBe(input);
      expect(input.props.focused).toBe(true);
      expect(input.props.value).toBe(value);
      expect(tree.root.findByType('FlashList' as any)).toBe(list);
      expect(list.props.onViewableItemsChanged).toBe(viewability);
    }
    expect(list.props.data).toHaveLength(exactRows.length);
    for (const row of list.props.data) expect(exactRows).toContain(row);
    act(() => tree.root.findByProps({ word: 'Bank' }).props.onPress());
    expect(useRatesSession.getState().sections.TD.sort).toBe('bank');
    expect(tree.root.findByType('SearchBar' as any)).toBe(input);
    expect(input.props.focused).toBe(true);
    act(() => tree.root.findByProps({ word: 'Filter' }).props.onPress());
    const sheet = () => tree.root.findByType('FilterSheet' as any);
    act(() => sheet().props.onDraftChange({ ...sheet().props.controlledDraft, providers: ['Macquarie'] }));
    act(() => sheet().props.onApply(sheet().props.controlledDraft));
    expect(useRatesSession.getState().sections.TD.filters.providers).toEqual(['Macquarie']);
    expect(tree.root.findByType('SearchBar' as any)).toBe(input);
    expect(input.props.focused).toBe(true);
    expect(mockListMount).toHaveBeenCalledTimes(1);
    expect(mockListUnmount).not.toHaveBeenCalled();
    expect(mockSearchMount).toHaveBeenCalledTimes(1);
    expect(mockSearchUnmount).not.toHaveBeenCalled();
  } finally { act(() => tree.unmount()); }
});

test('one visible tap commits the common sort preset, while advanced Cancel/Back preserves the committed scope', () => {
  mockState.prefs.includeNonStandard = true;
  let tree: any; act(() => { tree = TestRenderer.create(<Search />); });
  try {
    const list = tree.root.findByType('FlashList' as any);
    act(() => tree.root.findByProps({ word: 'Bank' }).props.onPress());
    expect(useRatesSession.getState().sections.TD.sort).toBe('bank');
    expect(tree.root.findAllByType('SheetSurface' as any).filter((node: any) => node.props.visible)).toHaveLength(0);
    act(() => list.props.onScroll({ nativeEvent: { contentOffset: { y: 312 } } }));
    const before = captureRatesSession();
    const sortSheet = () => tree.root.findAllByType('SheetSurface' as any).find((node: any) => node.props.title === 'Sort');
    for (const close of ['button', 'back']) {
      act(() => tree.root.findByProps({ word: 'Sort' }).props.onPress());
      expect(sortSheet().props.visible).toBe(true);
      act(() => close === 'button' ? sortSheet().findByProps({ title: 'Cancel' }).props.onPress() : sortSheet().props.onClose());
      expect(sortSheet().props.visible).toBe(false);
      expect(captureRatesSession()).toEqual(before);
    }
    act(() => tree.root.findByProps({ word: 'Sort' }).props.onPress());
    const commits = jest.fn(), stop = useRatesSession.subscribe(commits);
    act(() => sortSheet().findByProps({ title: 'Advertised rate' }).props.onPress());
    stop();
    expect(commits).toHaveBeenCalledTimes(1);
    expect(sortSheet().props.visible).toBe(false);
    expect(useRatesSession.getState().sections.TD.sort).toBe('rate');
    expect(useRatesSession.getState().sections.TD.scrollOffset).toBe(0);
    expect(mockScrollToOffset).toHaveBeenLastCalledWith({ offset: 0, animated: false });
    act(() => tree.root.findByProps({ word: 'Bank' }).props.onPress());
    act(() => tree.root.findByProps({ word: 'Bank' }).props.onPress());
    expect(useRatesSession.getState().sections.TD.sort).toBe('rate');
    expect(sortSheet().props.visible).toBe(false);
  } finally { act(() => tree.unmount()); }
});

test('family changes and a detail/back remount restore that family offset without remounting the live header', () => {
  mockState.prefs.includeNonStandard = true; mockParams = {};
  initializeRatesSession(mockState.prefs, 'TD');
  updateRatesSection('TD', { query: 'Macquarie', sort: 'bank' }); recordRatesScroll('TD', 420);
  updateRatesSection('Mortgage', { query: 'Loan', scrollOffset: 80 });
  let tree: any; act(() => { tree = TestRenderer.create(<Search />); });
  try {
    const input = tree.root.findByType('SearchBar' as any);
    const list = tree.root.findByType('FlashList' as any);
    expect(mockScrollToOffset).toHaveBeenLastCalledWith({ offset: 420, animated: false });
    const familyControl = () => tree.root.findByProps({ testID: 'rates-task-controls' }).findAllByType('SegmentedControl' as any).find((node: any) => node.props.options.some((option: any) => option.value === 'Mortgage'));
    act(() => familyControl().props.onChange('Mortgage'));
    expect(input.props.value).toBe('Loan');
    expect(mockScrollToOffset).toHaveBeenLastCalledWith({ offset: 80, animated: false });
    act(() => familyControl().props.onChange('TD'));
    expect(input.props.value).toBe('Macquarie');
    expect(useRatesSession.getState().sections.TD.sort).toBe('bank');
    expect(mockScrollToOffset).toHaveBeenLastCalledWith({ offset: 420, animated: false });
    expect(mockSearchMount).toHaveBeenCalledTimes(1);
    act(() => list.props.onScroll({ nativeEvent: { contentOffset: { y: 460 } } }));
    act(() => tree.unmount());
    act(() => { tree = TestRenderer.create(<Search />); });
    expect(tree.root.findByType('SearchBar' as any).props.value).toBe('Macquarie');
    expect(mockScrollToOffset).toHaveBeenLastCalledWith({ offset: 460, animated: false });
  } finally { act(() => tree.unmount()); }
});

test('early zero scroll and a queued old restore cannot erase or replace the current query offset', () => {
  mockState.prefs.includeNonStandard = true; mockParams = {};
  initializeRatesSession(mockState.prefs, 'TD'); recordRatesScroll('TD', 420);
  const frames: FrameRequestCallback[] = [];
  jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
  let tree: any; act(() => { tree = TestRenderer.create(<Search />); });
  try {
    const list = tree.root.findByType('FlashList' as any);
    act(() => list.props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } }));
    expect(useRatesSession.getState().sections.TD.scrollOffset).toBe(420);
    act(() => tree.root.findByType('SearchBar' as any).props.onChangeText('No matching bank'));
    act(() => frames.forEach(callback => callback(0)));
    expect(mockScrollToOffset).toHaveBeenCalledTimes(1);
    expect(mockScrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: false });
    expect(useRatesSession.getState().sections.TD.scrollOffset).toBe(0);
    expect(mockListMount).toHaveBeenCalledTimes(1);
  } finally { act(() => tree.unmount()); }
});

test('a data swap rejects prior-row visibility and a header-only viewport stays unverified', () => {
  mockState.prefs.includeNonStandard = true;
  const savings = { provider: 'Controlled Bank', product_key: 'controlled-savings', product_name: 'Controlled savings', rate_index: 1, rate: '0.03', rate_type: 'VARIABLE', account_class: 'standard' };
  mockState.core.sections.Savings.rates = [savings];
  let tree: any; act(() => { tree = TestRenderer.create(<Search />); });
  try {
    const list = tree.root.findByType('FlashList' as any), previous = list.props.data[0];
    const probe = () => mockSurfaces.get('rates.results').probes.find((item: any) => item.id === 'search.list');
    mockSuppressViewability = true;
    const family = tree.root.findByProps({ testID: 'rates-task-controls' }).findAllByType('SegmentedControl' as any).find((node: any) => node.props.options.some((option: any) => option.value === 'Savings'));
    act(() => family.props.onChange('Savings'));
    expect(probe().status).toBe('pending');
    act(() => list.props.onViewableItemsChanged({ viewableItems: [{ isViewable: true, item: previous }] }));
    expect(probe().visibleCount).toBeNull();
    expect(probe().status).toBe('pending');
    act(() => list.props.onViewableItemsChanged({ viewableItems: [] }));
    expect(probe().visibleCount).toBe(0);
    expect(probe().status).toBe('pending');
    act(() => list.props.onViewableItemsChanged({ viewableItems: [{ isViewable: true, item: savings }] }));
    expect(probe().visibleCount).toBe(1);
    expect(probe().status).toBe('ready');
  } finally { act(() => tree.unmount()); }
});

test('a measurement before the restore reaches a frame cannot establish list readiness', () => {
  mockState.prefs.includeNonStandard = true;
  const frames: FrameRequestCallback[] = [];
  jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
  let tree: any; act(() => { tree = TestRenderer.create(<Search />); });
  try {
    const list = tree.root.findByType('FlashList' as any);
    const probe = () => mockSurfaces.get('rates.results').probes.find((item: any) => item.id === 'search.list');
    act(() => frames[0](0));
    expect(mockScrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: false });
    act(() => list.props.onViewableItemsChanged({ viewableItems: [{ isViewable: true, item: list.props.data[0] }] }));
    expect(probe().visibleCount).toBeNull();
    expect(probe().status).toBe('pending');
    act(() => frames[1](16));
    expect(probe().visibleCount).toBeGreaterThan(0);
    expect(probe().status).toBe('ready');
  } finally { act(() => tree.unmount()); }
});
