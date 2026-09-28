import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { AppBreadcrumbBar } from '../src/components/AppBreadcrumbBar';

const mockNavigate = jest.fn();
let mockPathname = '/browse';
let mockParams: Record<string, string> = {};
let mockBanner = false;
let mockAllowed = true;
const mockRow = { product_key: 'private-key', product_name: 'Protected name', taxonomy_path: 'HOME_LOAN.OO' };
const mockState = {
  activeSection: 'Mortgage',
  core: { sections: {} },
  prefs: { onboarded: true, interests: ['Mortgage', 'Savings', 'TD'] },
};
jest.mock('expo-router', () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
  usePathname: () => mockPathname,
  useGlobalSearchParams: () => mockParams,
}));
jest.mock('../src/data/store', () => ({ useStore: (selector: (state: unknown) => unknown) => selector(mockState) }));
jest.mock('../src/data/selectors', () => ({ findEligibleByKey: () => ({ section: 'Mortgage', row: mockRow, siblings: [mockRow] }) }));
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
