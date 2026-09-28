import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { AppBreadcrumbBar } from '../src/components/AppBreadcrumbBar';
import { useScenarioSection } from '../src/hooks/useScenarioSection';
import { rateConditionFixture } from '../testUtils/rateConditions';
import type { SectionKey } from '../src/types';

const mockNavigate = jest.fn();
let mockPathname = '/browse';
let mockParams: Record<string, string> = {};
let mockBanner = false;
let mockAllowed = true;
let mockFound = true;
const mockRow = { product_key: 'private-key', product_name: 'Protected name', taxonomy_path: 'HOME_LOAN.OO', rate_index: 1 };
let mockState = {
  ...rateConditionFixture(),
  activeSection: 'Mortgage' as SectionKey,
  prefs: { onboarded: true, interests: ['Mortgage', 'Savings', 'TD'] },
};
jest.mock('expo-router', () => ({
  router: {
    navigate: (...args: unknown[]) => mockNavigate(...args),
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

type TestNode = {
  props: { accessibilityLabel?: string; onPress?: () => void; disabled?: boolean; style?: { paddingTop: number } };
  findAll: (predicate: (node: TestNode) => boolean) => TestNode[];
  findByProps: (props: Record<string, unknown>) => TestNode;
};
let tree: ReactTestRenderer & { root: TestNode };
beforeEach(() => {
  mockNavigate.mockClear();
  mockPathname = '/browse';
  mockParams = { section: 'home-loans', path: 'OO.PI.VARIABLE' };
  mockBanner = false;
  mockAllowed = true;
  mockFound = true;
  mockState = { ...rateConditionFixture(), activeSection: 'Mortgage', prefs: { onboarded: true, interests: ['Mortgage', 'Savings', 'TD'] } };
  jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 1);
});
afterEach(() => {
  act(() => tree?.unmount());
  jest.restoreAllMocks();
});

const mount = () => act(() => { tree = TestRenderer.create(<AppBreadcrumbBar />) as typeof tree; });
const button = (label: string) => tree.root.findAll((node) => node.props.accessibilityLabel === label)[0];

it('jumps to a middle category, clears the drill at the root, and goes Home', () => {
  mount();
  act(() => button('Go to Owner-occupied').props.onPress!());
  expect(mockNavigate).toHaveBeenLastCalledWith({ pathname: '/(tabs)/browse', params: expect.objectContaining({ section: 'home-loans', path: 'OO', request: expect.any(String) }) });
  act(() => button('Go to Home loans').props.onPress!());
  expect(mockNavigate).toHaveBeenLastCalledWith({ pathname: '/(tabs)/browse', params: expect.objectContaining({ section: 'home-loans', path: '' }) });
  expect(button('Variable rate, current location').props.disabled).toBe(true);
  act(() => button('Home').props.onPress!());
  expect(mockNavigate).toHaveBeenLastCalledWith('/(tabs)');
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
  act(() => button('Go to Products without listed rates').props.onPress!());
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
  act(() => button('Go to Explore').props.onPress!());
  expect(mockNavigate).toHaveBeenLastCalledWith({ pathname: '/(tabs)/browse', params: expect.objectContaining({ section: 'savings' }) });
  if (pathname === '/projections') {
    act(() => button('Go to My scenario').props.onPress!());
    expect(mockNavigate).toHaveBeenLastCalledWith({ pathname: '/calculator', params: { section: 'Savings' } });
  }
  mockParams = { section: 'TD' };
  act(() => tree.update(<Scenario />));
  expect(current!).toBe('TD');
});
