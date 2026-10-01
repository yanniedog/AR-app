import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import Search from '../app/search';
import { DEFAULT_PREFS } from '../src/data/storeTypes';
import { setSuitabilityAllowed } from '../src/data/suitabilityGate';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { rateConditionFixture } from '../testUtils/rateConditions';

let mockState: any;
const mockEnsureDetails = jest.fn(async () => undefined);
const mockSurfaces = new Map<string, any>();
jest.mock('../src/data/store', () => ({
  useStore: Object.assign((selector: any) => selector(mockState), { getState: () => mockState }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() }, Stack: { Screen: 'StackScreen' },
  useLocalSearchParams: () => ({ section: 'TD' }),
}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => jest.requireActual('../src/theme/theme').lightTheme,
}));
jest.mock('../src/lib/yieldToUi', () => ({ scheduleAfterInteractions: () => () => undefined }));
jest.mock('../src/hooks/usePerformanceAuditReadiness', () => ({
  usePerformanceAuditSurface: (surface: any) => mockSurfaces.set(surface.id, surface),
}));
jest.mock('../src/hooks/useLogoReadiness', () => ({ useLogoReadiness: () => ({ ready: true }) }));
jest.mock('../src/hooks/useVirtualizedListReadiness', () => ({
  useVirtualizedListReadiness: () => ({ ready: true, visiblyCommitted: true }),
}));
jest.mock('../src/hooks/useDebouncedValue', () => ({ useDebouncedValue: (value: string) => value }));
jest.mock('@shopify/flash-list', () => ({
  FlashList: (props: any) => jest.requireActual('react').createElement('FlashList', props,
    props.data.length ? props.data.map((item: any, index: number) =>
      jest.requireActual('react').createElement('Rate', { key: index }, props.renderItem({ item })))
      : props.ListEmptyComponent),
}));
jest.mock('../src/components/SearchReportExport', () => ({ SearchReportExport: 'SearchReportExport' }));
jest.mock('../src/components/FilterSheet', () => ({ FilterSheet: 'FilterSheet' }));
jest.mock('../src/components/ProductCard', () => ({ ProductCard: 'ProductCard' }));
jest.mock('../src/components/Screen', () => ({ Screen: 'Screen', screenEdgeStyle: () => ({}), screenScrollContentStyle: () => ({}) }));
jest.mock('../src/components/ToolbarIconButton', () => ({ ToolbarIconButton: 'ToolbarIconButton' }));
jest.mock('../src/components/controls', () => ({ SearchBar: 'SearchBar' }));
jest.mock('../src/components/feedback', () => ({
  EmptyState: 'EmptyState', IndeterminateProgressBar: 'IndeterminateProgressBar', LoadingRows: 'LoadingRows', ScreenSkeleton: 'ScreenSkeleton',
}));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Card: 'Card', Chip: 'Chip', Row: 'Row' }));
jest.mock('../src/components/ledger', () => ({ LedgerSheet: 'LedgerSheet' }));

beforeEach(() => {
  mockEnsureDetails.mockClear(); mockSurfaces.clear();
  const fixture = rateConditionFixture();
  mockState = { ...fixture, prefs: { ...DEFAULT_PREFS, enableDeepSearch: false }, subscriptions: [],
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
    expect(tree.root.findAllByProps({ title: 'Clear search and filters' })).toHaveLength(0);
    expect(tree.root.findByType('SearchReportExport' as any).props.disabled).toBe(true);
    expect(mockSurfaces.get('search.results').probes.find((probe: any) => probe.id === 'search.list').status).toBe('pending');
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
    expect(tree.root.findByType('IndeterminateProgressBar' as any).props.caption).toBe('Preparing rates and product details.');
    expect(tree.root.findAllByType('EmptyState' as any)).toHaveLength(0);
  } finally { act(() => tree.unmount()); }
});

test('a verified empty result still offers the normal filter controls', () => {
  setSuitabilityAllowed(new Set());
  let tree: any;
  act(() => { tree = TestRenderer.create(<Search />); });
  try {
    expect(tree.root.findByType('EmptyState' as any).props.title).toBe('No matching products');
    expect(tree.root.findAllByProps({ title: 'Clear search and filters' })).toHaveLength(1);
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
