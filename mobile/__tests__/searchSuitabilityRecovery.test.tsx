import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import Search from '../src/components/rates/RatesWorkspace';
import { captureRatesSession, restoreRatesSession, initializeRatesSession, recordRatesScroll, useRatesSession } from '../src/data/ratesSession';
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
let mockVisibleCount: number | null = null;
let mockSuppressViewability = false;
let mockNavigationReady = true;
let mockDimensions = { width: 411, height: 914, scale: 1, fontScale: 1 };
const mockNavigationListeners = { ready: new Set<() => void>(), state: new Set<() => void>() };
const mockNavigation = {
  isReady: () => mockNavigationReady,
  addListener: (event: 'ready' | 'state', listener: () => void) => {
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
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ default: () => mockDimensions }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => jest.requireActual('../src/theme/theme').lightTheme,
}));
jest.mock('../src/lib/yieldToUi', () => ({ scheduleAfterInteractions: () => () => undefined }));
jest.mock('../src/hooks/usePerformanceAuditReadiness', () => ({
  usePerformanceAuditSurface: (surface: any) => mockSurfaces.set(surface.id, surface),
}));
jest.mock('../src/hooks/useLogoReadiness', () => ({ useLogoReadiness: () => ({ ready: true }) }));
jest.mock('../src/hooks/useDebouncedValue', () => ({ useDebouncedValue: (value: string) => value }));
jest.mock('../src/hooks/useSearchFilterOptions', () => ({
  useSearchFilterOptions: () => ({ ready: true, options: {} }),
}));
jest.mock('@shopify/flash-list', () => {
  const React = jest.requireActual('react');
  return { FlashList: React.forwardRef(function MockFlashList(props: any, ref: any) {
    const measure = () => {
      if (!mockSuppressViewability) props.onViewableItemsChanged({ viewableItems:
        props.data.slice(0, mockVisibleCount ?? 3).map(() => ({ isViewable: true })) });
    };
    const measureRef = React.useRef(measure);
    measureRef.current = measure;
    const { extraData, onCommitLayoutEffect } = props;
    React.useImperativeHandle(ref, () => ({ scrollToOffset: (...args: unknown[]) => mockScrollToOffset(...args), recomputeViewableItems: () => {
      mockRecomputeViewableItems(); measureRef.current();
    } }), []);
    React.useEffect(() => {
      mockListMount();
      measureRef.current();
      return () => mockListUnmount();
    }, []);
    React.useEffect(() => { onCommitLayoutEffect(); }, [extraData, onCommitLayoutEffect]);
    return React.createElement('FlashList', props,
      props.data.length ? props.data.map((item: any, index: number) =>
        React.createElement('Rate', { key: index }, props.renderItem({ item })))
        : props.ListEmptyComponent);
  }) };
});
jest.mock('../src/components/SearchReportExport', () => ({ SearchReportExport: 'SearchReportExport' }));
jest.mock('../src/components/FilterSheet', () => ({ FilterSheet: 'FilterSheet' }));
jest.mock('../src/components/ProductCard', () => ({ ProductCard: 'ProductCard' }));
jest.mock('../src/components/Screen', () => ({ Screen: 'Screen', screenEdgeStyle: () => ({}), screenScrollContentStyle: () => ({}) }));
jest.mock('../src/components/ToolbarIconButton', () => ({ ToolbarIconButton: 'ToolbarIconButton' }));
jest.mock('../src/components/controls', () => ({ SearchBar: 'SearchBar', SegmentedControl: 'SegmentedControl' }));
jest.mock('../src/components/feedback', () => ({
  EmptyState: 'EmptyState', IndeterminateProgressBar: 'IndeterminateProgressBar', LoadingRows: 'LoadingRows', ScreenSkeleton: 'ScreenSkeleton',
}));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Card: 'Card', Chip: 'Chip', Row: 'Row' }));
jest.mock('../src/components/SheetSurface', () => ({ SheetSurface: 'SheetSurface' }), { virtual: true });
jest.mock('../src/components/TouchTarget', () => ({ TouchTarget: 'TouchTarget' }));

beforeEach(() => {
  mockDimensions = { width: 411, height: 914, scale: 1, fontScale: 1 };
  mockNavigationReady = true; mockNavigationListeners.ready.clear(); mockNavigationListeners.state.clear();
  (router.setParams as jest.Mock).mockClear();
  restoreRatesSession(originalRatesSession); mockParams = { section: 'TD' };
  mockEnsureDetails.mockClear(); mockSurfaces.clear();
  mockListMount.mockClear(); mockListUnmount.mockClear();
  mockRecomputeViewableItems.mockClear(); mockScrollToOffset.mockClear(); mockVisibleCount = null; mockSuppressViewability = false;
  const fixture = rateConditionFixture();
  mockState = { ...fixture, prefs: { ...DEFAULT_PREFS, enableDeepSearch: false }, subscriptions: [], hydrated: true, activeSection: 'TD', setActiveSection: jest.fn(),
    detailsLoading: false, ensureDetails: mockEnsureDetails, searchIndexStatus: 'idle' };
  setSuitabilityAllowed(new Set(), { rebuildClosed: true });
  installMandatoryEligibility({ active: false, loading: false, rows: new WeakSet(), productKeys: new Set() });
});
afterEach(() => {
  setSuitabilityAllowed(null);
  installMandatoryEligibility({ active: false, loading: false, rows: new WeakSet(), productKeys: new Set() });
});

test('a closed suitability gate offers recovery instead of claiming no products match', () => {
  let tree: any;
  act(() => { tree = TestRenderer.create(<Search />); });
  try {
    expect(tree.root.findByType('EmptyState' as any).props.title).toBe('Could not prepare rates');
    expect(tree.root.findAllByProps({ title: 'Clear filters' })).toHaveLength(0);
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
    expect(tree.root.findAllByProps({ title: 'Clear filters' })).toHaveLength(1);
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
    expect(tree.root.findByType('EmptyState' as any).props.title).toBe('Could not prepare rates');
    expect(tree.root.findByType('SearchReportExport' as any).props.disabled).toBe(true);
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
      .toEqual({ unavailableReason: 'The selected exact rate is not in the current filtered search results' });
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
      expect(tree.root.findByType('FlashList' as any).props.extraData).toBe(revision);
      expect(listProbe().visibleCount).toBe(measuredCount);
      expect(mockRecomputeViewableItems).toHaveBeenCalledTimes(++measurements);
      previousRevision = revision;
    }
    expect(tree.root.findAllByType('ProductCard' as any)[0].props.selected).toBe(true);
    // A real applied result change remounts, rejecting stale layout/viewability.
    act(() => mockSurfaces.get('rates.results').actions['search.filters.open']());
    act(() => mockSurfaces.get('rates.results').actions['search.filter.provider.first']({ provider: 'Missing Bank' }));
    act(() => mockSurfaces.get('rates.results').actions['search.filters.apply']());
    expect(mockListMount).toHaveBeenCalledTimes(2);
    expect(mockListUnmount).toHaveBeenCalledTimes(1);
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
      viewableItems: [{ isViewable: true }],
    }));
    expect(listProbe().visibleCount).toBe(1);
    expect(listProbe().status).toBe('ready');
  } finally { act(() => tree.unmount()); }
});


test('filter Cancel discards the real draft and preserves query/type/sort/offset', () => {
  mockState.prefs.includeNonStandard = true;
  let tree: any; act(() => { tree = TestRenderer.create(<Search />); });
  try {
    const initialRows = tree.root.findByType('FlashList' as any).props.data;
    act(() => mockSurfaces.get('rates.results').actions['search.filters.open']());
    act(() => mockSurfaces.get('rates.results').actions['search.filter.provider.first']({ provider: 'Missing Bank' }));
    expect(tree.root.findByType('FlashList' as any).props.data).toBe(initialRows);
    act(() => mockSurfaces.get('rates.results').actions['search.filters.cancel']());
    expect(tree.root.findByType('FlashList' as any).props.data).toBe(initialRows);
    expect(tree.root.findByType('FilterSheet' as any).props.visible).toBe(false);
  } finally { act(() => tree.unmount()); }
});
test('the canonical list has no five-row preview gate and product taps preserve the exact rate', () => {
  mockState.prefs.includeNonStandard = true;
  const sample = mockState.core.sections.TD.rates[0];
  mockState.core.sections.TD.rates = Array.from({ length: 24 }, (_, index) => ({ ...sample, product_key: 'p-' + index, rate_index: index, rate: '0.045' }));
  let tree: any; act(() => { tree = TestRenderer.create(<Search />); });
  try {
    const list = tree.root.findByType('FlashList' as any); expect(list.props.data).toHaveLength(24);
    const card = tree.root.findAllByType('ProductCard' as any)[0]; act(() => card.props.onPress());
    expect(router.push).toHaveBeenCalledWith({ pathname: '/product/[key]', params: { key: card.props.row.product_key, ri: String(card.props.row.rate_index) } });
    expect(mockSurfaces.get('rates.results').routeKey).toBe('/browse');
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
    expect(mockScrollToOffset).not.toHaveBeenCalled();
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
  [411, 1, 3],
  [360, 1.3, 2],
  [320, 2, 1],
])('Rates actions retain usable columns at %s dp and font scale %s', (width, fontScale, columns) => {
  mockDimensions = { ...mockDimensions, width, fontScale };
  mockState.prefs.includeNonStandard = true;
  let tree: any; act(() => { tree = TestRenderer.create(<Search />); });
  try {
    const controls = ['Filter', 'Sort', 'Compare'].map(title =>
      tree.root.findAllByType('Button' as any).find((node: any) => node.props.title === title));
    const toolbar = controls[0].parent;
    expect(controls.every(control => control.parent === toolbar)).toBe(true);
    expect(toolbar.props.style.flexWrap).toBe('wrap');
    const contentWidth = width - 32;
    for (const control of controls) {
      expect(control.props.style.minWidth).toBeGreaterThanOrEqual(48);
      expect(control.props.style.minWidth).toBeLessThanOrEqual(contentWidth);
      expect(control.props.style.flexShrink).toBe(0);
      expect(Math.floor((contentWidth + 8) / (control.props.style.flexBasis + 8))).toBe(columns);
    }
    const actions = tree.root.findByProps({ accessibilityLabel: 'Search actions' });
    expect(actions.parent).not.toBe(toolbar);
    expect(actions.parent.findAllByType('AppText' as any).map((node: any) =>
      React.Children.toArray(node.props.children).join(''))).toEqual([
        tree.root.findByType('FlashList' as any).props.data.length + ' results', 'Advertised rate',
      ]);
    expect(tree.root.findByType('FlashList' as any).props.contentContainerStyle.paddingTop).toBe(0);
    act(() => controls[1].props.onPress());
    expect(tree.root.findAllByType('SheetSurface' as any).some((node: any) => node.props.visible && node.props.title === 'Sort')).toBe(true);
    act(() => controls[2].props.onPress());
    expect(tree.root.findAllByProps({ title: 'Done' })).toHaveLength(1);
    act(() => actions.props.onPress());
    expect(tree.root.findAllByType('SheetSurface' as any).some((node: any) => node.props.visible && node.props.title === 'Search')).toBe(true);
  } finally { act(() => tree.unmount()); }
});
