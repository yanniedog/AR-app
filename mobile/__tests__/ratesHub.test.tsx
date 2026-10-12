import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import Rates from '../app/(tabs)/browse';

type HubRenderer = ReturnType<typeof TestRenderer.create> & { root: {
  findAllByProps: (props: Record<string, unknown>) => unknown[];
  findAllByType: (type: unknown) => { props: Record<string, unknown> }[];
  findByProps: (props: Record<string, unknown>) => { props: { onPress: () => void } };
} };

const mockPush = jest.fn();
const mockSetParams = jest.fn();
const mockOpenSearch = jest.fn();
const mockOpenBrowse = jest.fn();
const mockOpenProduct = jest.fn();
let mockParams: Record<string, string | string[]> = {};
// Two eligible, ranked savings products so the hub renders its results, not just the fallback.
const rankedRows = [
  { product_key: 'savings-a', rate_index: 1, provider: 'Bank A', product_name: 'Saver A' },
  { product_key: 'savings-b', rate_index: 2, provider: 'Bank B', product_name: 'Saver B' },
];
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), setParams: (...args: unknown[]) => mockSetParams(...args) },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('../src/lib/nav', () => ({
  openSearch: (...args: unknown[]) => mockOpenSearch(...args),
  openBrowse: (...args: unknown[]) => mockOpenBrowse(...args),
  openProduct: (...args: unknown[]) => mockOpenProduct(...args),
}));
jest.mock('../src/hooks/useSuitabilityRevision', () => ({ useSuitabilityRevision: () => 0 }));
jest.mock('../src/data/taxonomy', () => ({ rowsForSearchScope: (rows: unknown) => rows }));
jest.mock('../src/data/profile', () => ({
  EMPTY_PROFILE: {},
  profileToFilters: () => ({}),
  profileSelectionCount: () => 0,
}));
jest.mock('../src/data/selectors', () => ({ EMPTY_FILTERS: {}, queryAndSort: () => rankedRows }));
jest.mock('../src/data/store', () => ({
  useStore: (selector: (state: unknown) => unknown) => selector({
    activeSection: 'Savings',
    setActiveSection: jest.fn(),
    core: { sections: { Savings: { rates: [{ product_key: 'savings-a' }] } } },
    details: { products: {} },
    prefs: {
      interests: ['Savings', 'TD'],
      profileFilters: {},
      includeNonStandard: false,
      depositRankMetric: 'base',
      mortgageRateMetric: 'comparison',
    },
  }),
}));
jest.mock('../src/components/NavigationHub', () => ({ NavigationHub: 'NavigationHub', DestinationRow: 'DestinationRow' }));
jest.mock('../src/components/ledger', () => ({ LedgerAction: 'LedgerAction', LedgerSection: 'LedgerSection', LedgerText: 'LedgerText' }));
jest.mock('../src/components/ProductCard', () => ({ ProductCard: 'ProductCard' }));
jest.mock('../src/components/controls', () => ({ SegmentedControl: 'SegmentedControl' }));

beforeEach(() => { mockParams = {}; jest.clearAllMocks(); });

it('opens on ranked results with a product-type switch, not a directory of product types', () => {
  let tree!: HubRenderer;
  act(() => { tree = TestRenderer.create(<Rates />) as HubRenderer; });
  try {
    // The per-type directory rows are gone, replaced by the type switch.
    expect(tree.root.findAllByProps({ title: 'Home loans' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ title: 'Savings accounts' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ title: 'Term deposits' })).toHaveLength(0);
    expect(tree.root.findAllByType('SegmentedControl' as never)).toHaveLength(1);
    // The ranked products render, and tapping one opens that exact product.
    const cards = tree.root.findAllByType('ProductCard' as never);
    expect(cards).toHaveLength(rankedRows.length);
    expect(cards[0].props.row).toEqual(rankedRows[0]);
    act(() => (cards[0].props.onPress as () => void)());
    expect(mockOpenProduct).toHaveBeenCalledWith('savings-a', 1);
    // "See all N" opens the full, filterable list for the active type.
    act(() => { tree.root.findByProps({ label: 'See all 2 savings accounts' }).props.onPress(); });
    expect(mockOpenSearch).toHaveBeenCalledWith('Savings');
    // Product categories remain reachable as a secondary way to browse.
    act(() => { tree.root.findByProps({ title: 'Product categories' }).props.onPress(); });
    expect(mockOpenBrowse).toHaveBeenCalledWith('Savings');
  } finally { act(() => tree.unmount()); }
});

it('clears a legacy tab drill before opening categories and does not re-open it on return', () => {
  mockParams = { section: ['savings'], path: 'BONUS', request: 'old-link' };
  let tree!: ReturnType<typeof TestRenderer.create>;
  act(() => { tree = TestRenderer.create(<Rates />); });
  try {
    expect(mockSetParams).toHaveBeenCalledWith({ section: undefined, path: undefined, request: undefined });
    expect(mockSetParams.mock.invocationCallOrder[0]).toBeLessThan(mockPush.mock.invocationCallOrder[0]);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/categories', params: { section: ['savings'], path: 'BONUS', request: 'old-link' } });
    mockParams = {};
    act(() => { tree.update(<Rates />); });
    expect(mockPush).toHaveBeenCalledTimes(1);
  } finally { act(() => tree.unmount()); }
});
