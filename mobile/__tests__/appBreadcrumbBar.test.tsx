import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { AppBreadcrumbBar } from '../src/components/AppBreadcrumbBar';
import { useScenarioSection } from '../src/hooks/useScenarioSection';
import { rateConditionFixture } from '../testUtils/rateConditions';
import type { SectionKey } from '../src/types';

const mockNavigate = jest.fn();
let mockPathname = '/categories';
let mockParams: Record<string, string> = {};
let mockBanner = false;
let mockAllowed = true;
let mockFound = true;
let mockDimensions = { width: 390, height: 844, scale: 1, fontScale: 1 };
let mockRow = { product_key: 'private-key', product_name: 'Protected name', taxonomy_path: 'HOME_LOAN.OO', rate_index: 1 };
let mockState = {
  ...rateConditionFixture(),
  activeSection: 'Mortgage' as SectionKey,
  prefs: { onboarded: true, interests: ['Mortgage', 'Savings', 'TD'] },
};
jest.mock('expo-router', () => ({
  router: {
    navigate: (...args: unknown[]) => mockNavigate(...args),
    dismissTo: (...args: unknown[]) => mockNavigate(...args),
    setParams: (params: Record<string, string>) => { mockParams = { ...mockParams, ...params }; },
  },
  usePathname: () => mockPathname,
  useGlobalSearchParams: () => mockParams,
  useLocalSearchParams: () => mockParams,
}));
jest.mock('../src/data/store', () => ({ useStore: (selector: (state: unknown) => unknown) => selector(mockState) }));
jest.mock('../src/data/selectors', () => ({ findEligibleByKey: () => mockFound ? { section: 'Mortgage', row: mockRow, siblings: [mockRow] } : null }));
jest.mock('../src/data/eligibilityGate', () => ({ isMandatoryEligibilityReady: () => mockAllowed, mandatoryProductAllowed: () => mockAllowed }));
jest.mock('../src/hooks/useSuitabilityRevision', () => ({ useSuitabilityRevision: () => mockAllowed ? 1 : 2 }));
jest.mock('../src/components/AppUpdateBanner', () => ({ useAppUpdateBannerVisible: () => mockBanner }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ default: () => mockDimensions }));

type TestNode = {
  props: { accessibilityLabel?: string; onPress?: () => void; onRequestClose?: () => void; disabled?: boolean; horizontal?: boolean; children?: unknown; style?: { paddingTop: number } };
  findAll: (predicate: (node: TestNode) => boolean) => TestNode[];
  findByProps: (props: Record<string, unknown>) => TestNode;
};
let tree: ReactTestRenderer & { root: TestNode };
beforeEach(() => {
  mockNavigate.mockClear();
  mockPathname = '/categories';
  mockParams = { section: 'home-loans', path: 'OO.PI.VARIABLE' };
  mockBanner = false;
  mockAllowed = true;
  mockFound = true;
  mockRow = { product_key: 'private-key', product_name: 'Protected name', taxonomy_path: 'HOME_LOAN.OO', rate_index: 1 };
  mockDimensions = { width: 390, height: 844, scale: 1, fontScale: 1 };
  mockState = { ...rateConditionFixture(), activeSection: 'Mortgage', prefs: { onboarded: true, interests: ['Mortgage', 'Savings', 'TD'] } };
  jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 1);
});
afterEach(() => {
  act(() => tree?.unmount());
  jest.restoreAllMocks();
});

const mount = () => act(() => { tree = TestRenderer.create(<AppBreadcrumbBar />) as typeof tree; });
const button = (label: string) => tree.root.findAll((node) => node.props.accessibilityLabel === label)[0];
const jump = (label: string) => {
  if (!button(label)) act(() => button('Show parent sections').props.onPress!());
  act(() => button(label).props.onPress!());
};

it('jumps to a middle category, clears the drill at the root, and goes Home', () => {
  mount();
  expect(button('Go to Owner-occupied')).toBeUndefined();
  jump('Go to Owner-occupied');
  expect(mockNavigate).toHaveBeenLastCalledWith({ pathname: '/categories', params: expect.objectContaining({ section: 'home-loans', path: 'OO', request: expect.any(String) }) });
  expect(button('Go to Owner-occupied')).toBeUndefined();
  jump('Go to Home loans');
  expect(mockNavigate).toHaveBeenLastCalledWith({ pathname: '/categories', params: expect.objectContaining({ section: 'home-loans', path: '' }) });
  expect(button('Variable rate, current location').props.disabled).toBe(true);
  act(() => button('Home').props.onPress!());
  expect(mockNavigate).toHaveBeenLastCalledWith('/(tabs)');
});

it('keeps large-text paths short with no horizontal scroller and opens full parent names on demand', () => {
  mockDimensions = { ...mockDimensions, width: 320, fontScale: 2.5 };
  mount();
  expect(button('Go to Principal & interest')).toBeUndefined();
  expect(button('Variable rate, current location')).toBeDefined();
  expect(tree.root.findAll((node) => node.props.horizontal === true)).toHaveLength(0);
  act(() => button('Show parent sections').props.onPress!());
  expect(button('Go to Principal & interest')).toBeDefined();
  act(() => button('Close parent sections').props.onPress!());
  expect(button('Go to Principal & interest')).toBeUndefined();
});

it('dismisses parent sections on backdrop, native back and route changes', () => {
  mount();
  act(() => button('Show parent sections').props.onPress!());
  act(() => button('Dismiss parent sections').props.onPress!());
  expect(button('Go to Owner-occupied')).toBeUndefined();
  act(() => button('Show parent sections').props.onPress!());
  act(() => tree.root.findAll((node) => Boolean(node.props.onRequestClose))[0].props.onRequestClose!());
  expect(button('Go to Owner-occupied')).toBeUndefined();
  act(() => button('Show parent sections').props.onPress!());
  mockParams = { section: 'home-loans', path: 'OO.PI.FIXED' };
  act(() => tree.update(<AppBreadcrumbBar />));
  expect(button('Close parent sections')).toBeUndefined();
  expect(button('Fixed rate, current location')).toBeDefined();
});

it('removes a protected product name from an open ancestor menu when eligibility closes', () => {
  mockPathname = '/rate-receipt';
  mockParams = { key: 'private-key', ri: '1' };
  mockDimensions = { ...mockDimensions, width: 320, fontScale: 2.5 };
  mount();
  act(() => button('Show parent sections').props.onPress!());
  expect(button('Go to Protected name')).toBeDefined();
  mockAllowed = false;
  act(() => tree.update(<AppBreadcrumbBar />));
  expect(button('Go to Protected name')).toBeUndefined();
  expect(button('Close parent sections')).toBeUndefined();
});

it('does not reopen a dismissed overflow menu after rotating back to a narrow screen', () => {
  mockPathname = '/catalogue';
  mockDimensions = { ...mockDimensions, width: 200 };
  mount();
  act(() => button('Show parent sections').props.onPress!());
  expect(button('Close parent sections')).toBeDefined();
  mockDimensions = { ...mockDimensions, width: 800 };
  act(() => tree.update(<AppBreadcrumbBar />));
  expect(button('Close parent sections')).toBeUndefined();
  mockDimensions = { ...mockDimensions, width: 200 };
  act(() => tree.update(<AppBreadcrumbBar />));
  expect(button('Close parent sections')).toBeUndefined();
});

it.each(['product', 'rate'])('dismisses the menu when the %s changes but breadcrumb labels stay the same', (change) => {
  mockPathname = '/product/private-key';
  mockParams = { key: 'private-key', ri: '1' };
  mount();
  act(() => button('Show parent sections').props.onPress!());
  expect(button('Close parent sections')).toBeDefined();
  if (change === 'product') {
    mockRow = { ...mockRow, product_key: 'another-key' };
    mockPathname = '/product/another-key';
    mockParams = { key: 'another-key', ri: '1' };
  } else {
    mockRow = { ...mockRow, rate_index: 2 };
    mockParams = { key: 'private-key', ri: '2' };
  }
  act(() => tree.update(<AppBreadcrumbBar />));
  expect(button('Protected name, current location')).toBeDefined();
  expect(button('Close parent sections')).toBeUndefined();
});

it('does not offer a dead product jump when exact-rate evidence is unavailable', () => {
  mockPathname = '/rate-receipt';
  mockParams = { key: 'private-key', ri: 'not-a-rate' };
  mockDimensions = { ...mockDimensions, width: 320, fontScale: 2.5 };
  mount();
  act(() => button('Show parent sections').props.onPress!());
  expect(button('Go to Product')).toBeUndefined();
  expect(button('Product').props.disabled).toBe(true);
});

it('consumes the top safe-area inset exactly once when the update banner toggles', () => {
  mount();
  const bar = () => tree.root.findByProps({ testID: 'app-breadcrumb-bar' });
  expect(bar().props.style?.paddingTop).toBe(24);
  mockBanner = true;
  act(() => tree.update(<AppBreadcrumbBar />));
  expect(bar().props.style?.paddingTop).toBe(0);
});

it('removes protected product labels as soon as eligibility closes', () => {
  mockPathname = '/product/private-key';
  mockParams = { key: 'private-key' };
  mount();
  expect(button('Protected name, current location')).toBeDefined();
  mockAllowed = false;
  act(() => tree.update(<AppBreadcrumbBar />));
  expect(button('Protected name, current location')).toBeUndefined();
  expect(button('Product, current location')).toBeDefined();
});

it.each(['1', '01', '1.0', ''])('keeps the displayed product identity for accepted rate parameter %s', (ri) => {
  mockPathname = '/product/private-key';
  mockParams = { key: 'private-key', ri };
  mount();
  expect(button('Protected name, current location')).toBeDefined();
});

it.each(['not-a-rate', '1.5', '2'])('keeps unavailable exact rate %s neutral', (ri) => {
  mockPathname = '/product/private-key';
  mockParams = { key: 'private-key', ri };
  mount();
  expect(button('Protected name, current location')).toBeUndefined();
  expect(button('Product, current location')).toBeDefined();
});

it('adds the verified details catalogue parent and removes identity on stale or ineligible evidence', () => {
  mockFound = false;
  mockPathname = '/product/details-only';
  mockParams = { key: 'details-only' };
  mockState.details.products['details-only'] = { displayIdentity: { name: 'Verified no-rate product' } };
  mount();
  expect(button('Verified no-rate product, current location')).toBeDefined();
  jump('Go to Products without listed rates');
  expect(mockNavigate).toHaveBeenLastCalledWith('/catalogue');
  const verified = mockState.details;
  mockState.details = { ...verified };
  act(() => tree.update(<AppBreadcrumbBar />));
  expect(button('Verified no-rate product, current location')).toBeUndefined();
  mockState.details = verified;
  mockAllowed = false;
  act(() => tree.update(<AppBreadcrumbBar />));
  expect(button('Verified no-rate product, current location')).toBeUndefined();
  expect(button('Go to Products without listed rates')).toBeUndefined();
});

it('does not replace an unavailable exact rate with details-only product identity', () => {
  mockFound = false;
  mockPathname = '/product/details-only';
  mockParams = { key: 'details-only', ri: '1' };
  mockState.details.products['details-only'] = { displayIdentity: { name: 'Verified no-rate product' } };
  mount();
  expect(button('Verified no-rate product, current location')).toBeUndefined();
});

it.each(['/calculator', '/projections'])('keeps %s category changes and ancestor links synchronized', (pathname) => {
  mockPathname = pathname;
  mockParams = { section: 'Mortgage' };
  mockState.prefs.interests = ['Mortgage'];
  let current: SectionKey;
  let select: (section: SectionKey) => void;
  function Scenario() {
    [current, select] = useScenarioSection('Mortgage');
    return <AppBreadcrumbBar />;
  }
  act(() => { tree = TestRenderer.create(<Scenario />) as typeof tree; });
  expect(current!).toBe('Mortgage');
  act(() => { select!('Savings'); tree.update(<Scenario />); });
  expect(current!).toBe('Savings');
  jump('Go to Tools');
  expect(mockNavigate).toHaveBeenLastCalledWith('/(tabs)/tools');
  if (pathname === '/projections') {
    jump('Go to Check my rate');
    expect(mockNavigate).toHaveBeenLastCalledWith({ pathname: '/calculator', params: { section: 'Savings' } });
  }
  mockParams = { section: 'TD' };
  act(() => tree.update(<Scenario />));
  expect(current!).toBe('TD');
});
