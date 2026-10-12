import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import Rates from '../app/(tabs)/browse';
import { EMPTY_PROFILE as mockEmptyProfile } from '../src/data/profile';

type HubRenderer = ReturnType<typeof TestRenderer.create> & { root: {
  findAllByProps: (props: Record<string, unknown>) => unknown[];
  findAllByType: (type: unknown) => unknown[];
  findByProps: (props: Record<string, unknown>) => { props: { onPress: () => void } };
} };

const mockPush = jest.fn();
const mockSetParams = jest.fn();
const mockOpenSearch = jest.fn();
const mockOpenBrowse = jest.fn();
const mockOpenProduct = jest.fn();
let mockParams: Record<string, string | string[]> = {};
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
// Mock active section so the store has no product data: the hub then shows its
// search entry (the full list) rather than a preview, which is enough to pin
// the "opens on results" wiring without a core fixture.
jest.mock('../src/data/store', () => ({
  useStore: (selector: (state: unknown) => unknown) => selector({
    activeSection: 'Savings',
    setActiveSection: jest.fn(),
    core: undefined,
    details: undefined,
    prefs: {
      interests: ['Savings', 'TD'],
      profileFilters: mockEmptyProfile,
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

it('opens on results with a product-type switch, not a directory of product types', () => {
  let tree!: HubRenderer;
  act(() => { tree = TestRenderer.create(<Rates />) as HubRenderer; });
  try {
    // The per-type directory rows are gone, replaced by the type switch.
    expect(tree.root.findAllByProps({ title: 'Home loans' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ title: 'Savings accounts' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ title: 'Term deposits' })).toHaveLength(0);
    expect(tree.root.findAllByType('SegmentedControl' as never)).toHaveLength(1);
    // The search entry leads to the full, filterable list for the active type.
    act(() => { tree.root.findByProps({ label: 'Search savings accounts' }).props.onPress(); });
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
