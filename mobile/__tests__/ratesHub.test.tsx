import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import Rates from '../app/(tabs)/browse';
import { EMPTY_PROFILE as mockEmptyProfile } from '../src/data/profile';

type HubRenderer = ReturnType<typeof TestRenderer.create> & { root: {
  findAllByProps: (props: Record<string, unknown>) => unknown[];
  findByProps: (props: Record<string, unknown>) => { props: { onPress: () => void } };
} };

const mockPush = jest.fn();
const mockSetParams = jest.fn();
const mockOpenSearch = jest.fn();
const mockOpenBrowse = jest.fn();
let mockParams: Record<string, string | string[]> = {};
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), setParams: (...args: unknown[]) => mockSetParams(...args) },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('../src/lib/nav', () => ({
  openSearch: (...args: unknown[]) => mockOpenSearch(...args),
  openBrowse: (...args: unknown[]) => mockOpenBrowse(...args),
}));
jest.mock('../src/data/store', () => ({
  useStore: (selector: (state: unknown) => unknown) => selector({
    activeSection: 'Mortgage', prefs: { interests: ['Savings', 'TD'], profileFilters: mockEmptyProfile },
  }),
}));
jest.mock('../src/components/NavigationHub', () => ({ NavigationHub: 'NavigationHub', DestinationRow: 'DestinationRow' }));
jest.mock('../src/components/ledger', () => ({ LedgerAction: 'LedgerAction', LedgerSection: 'LedgerSection', LedgerText: 'LedgerText' }));

beforeEach(() => { mockParams = {}; jest.clearAllMocks(); });

it('takes the user directly to results for a selected product type and omits excluded types', () => {
  let tree!: HubRenderer;
  act(() => { tree = TestRenderer.create(<Rates />) as HubRenderer; });
  try {
    expect(tree.root.findAllByProps({ title: 'Home loans' })).toHaveLength(0);
    act(() => { tree.root.findByProps({ title: 'Savings accounts' }).props.onPress(); });
    expect(mockOpenSearch).toHaveBeenCalledWith('Savings');
    act(() => { tree.root.findByProps({ title: 'Term deposits' }).props.onPress(); });
    expect(mockOpenSearch).toHaveBeenLastCalledWith('TD');
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
