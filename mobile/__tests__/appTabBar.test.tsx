import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { AppTabBar } from '../src/components/AppTabBar';
import { getTabBarLayout } from '../src/lib/androidChrome';

const mockNavigate = jest.fn();
const mockDismissTo = jest.fn();
const mockHaptic = jest.fn();
let mockPathname = '/product/a';
let mockOnboarded = true;
let mockFontScale = 1;

jest.mock('expo-router', () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args), dismissTo: (...args: unknown[]) => mockDismissTo(...args) },
  usePathname: () => mockPathname,
}));
jest.mock('../src/data/store', () => ({
  useStore: (selector: (state: unknown) => unknown) => selector({ prefs: { onboarded: mockOnboarded } }),
}));
jest.mock('../src/lib/haptics', () => ({ hapticSelection: () => mockHaptic() }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 7, bottom: 16, left: 3 }),
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  default: () => ({ width: 320, height: 640, scale: 1, fontScale: mockFontScale }),
}));

type TestNode = {
  props: {
    accessibilityLabel?: string;
    accessibilityRole?: string;
    accessibilityState?: { selected: boolean };
    onPress?: () => void;
    style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => ViewStyle);
    numberOfLines?: number;
  };
  findAll: (predicate: (node: TestNode) => boolean) => TestNode[];
  findAllByType: (type: React.ElementType) => TestNode[];
};
let tree: ReactTestRenderer & { root: TestNode; toJSON: () => unknown };
beforeEach(() => {
  mockPathname = '/product/a';
  mockOnboarded = true;
  mockFontScale = 1;
  mockNavigate.mockClear();
  mockDismissTo.mockClear();
  mockHaptic.mockClear();
});
afterEach(() => act(() => tree?.unmount()));
const mount = () => act(() => { tree = TestRenderer.create(<AppTabBar />) as typeof tree; });
const styleOf = (node: TestNode) => StyleSheet.flatten(typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style);
const controls = () => [...new Map(tree.root.findAll((node) => node.props.accessibilityRole === 'tab' && typeof node.props.onPress === 'function' && node.props.style != null).map((node) => [node.props.accessibilityLabel, node])).values()];

it('keeps all five sections visible on product details and returns to a clean Rates hub', () => {
  mount();
  const tabs = controls();
  expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual(['Home', 'Rates', 'Saved', 'Market', 'Tools']);
  expect(tabs.map((tab) => tab.props.accessibilityState?.selected)).toEqual([false, true, false, false, false]);
  act(() => tabs[1].props.onPress!());
  expect(mockDismissTo).toHaveBeenCalledWith({
    pathname: '/(tabs)/browse', params: { section: undefined, path: undefined, request: undefined },
  });
});

it('can leave a calculator directly for Market without unwinding stack history', () => {
  mockPathname = '/calculator';
  mount();
  const tabs = controls();
  expect(tabs[4].props.accessibilityState?.selected).toBe(true);
  act(() => tabs[3].props.onPress!());
  expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)/market');
});

it('does not append duplicate navigation when reselecting the current root', () => {
  mockPathname = '/market';
  mount();
  act(() => controls()[3].props.onPress!());
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockHaptic).toHaveBeenCalledTimes(1);
});

it.each(['/onboarding', '/compare'])('hides primary navigation during %s', (path) => {
  mockPathname = path;
  mount();
  expect(tree.toJSON()).toBeNull();
});

it('reserves large-text label height and all bottom/side safe-area insets', () => {
  mockFontScale = 2;
  mount();
  const bar = tree.root.findAllByType(View).find((view) => view.props.accessibilityRole === 'tablist')!;
  expect(styleOf(bar)?.height).toBe(getTabBarLayout(2).contentHeight + 16);
  expect(styleOf(bar)).toMatchObject({ paddingBottom: 16, paddingLeft: 3, paddingRight: 7 });
  expect(controls()).toHaveLength(5);
  for (const label of tree.root.findAllByType(Text)) expect(label.props.numberOfLines).toBe(2);
  for (const tab of controls()) expect(styleOf(tab)?.minHeight).toBeGreaterThanOrEqual(48);
});
