import React from 'react';
import { Modal, StyleSheet, type ViewStyle } from 'react-native';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import {
  AppNavigationMenu,
  NavigationMenuButton,
  NavigationMenuProvider,
} from '../src/components/AppNavigationMenu';
import { AppText } from '../src/components/ui';

type TestNode = {
  props: Record<string, unknown>;
  findAll: (predicate: (node: TestNode) => boolean) => TestNode[];
  findByType: (type: React.ElementType) => TestNode;
  findAllByType: (type: React.ElementType) => TestNode[];
};
type InspectableRenderer = ReactTestRenderer & { root: TestNode };
type NavigationButton = TestNode & {
  props: {
    onPress: () => void;
    accessibilityState: { selected?: boolean };
    style: (state: { pressed: boolean }) => ViewStyle;
  };
};

const mockNavigate = jest.fn();
let mockPathname = '/rba';
jest.mock('expo-router', () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
  usePathname: () => mockPathname,
  useGlobalSearchParams: () => ({}),
}));
jest.mock('../src/data/store', () => ({
  useStore: (selector: (state: unknown) => unknown) => selector({
    activeSection: 'Savings',
    prefs: { onboarded: true, interests: ['Savings'] },
  }),
}));
jest.mock('../src/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

it('opens the app menu and closes it before navigating to RBA rates', () => {
  let nextFrame: Parameters<typeof requestAnimationFrame>[0] | undefined;
  const frame = jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
    nextFrame = callback;
    return 1;
  });
  let tree!: InspectableRenderer;
  mockNavigate.mockClear();
  mockPathname = '/rba';
  act(() => {
    tree = TestRenderer.create(
      <NavigationMenuProvider>
        <NavigationMenuButton />
        <AppNavigationMenu />
      </NavigationMenuProvider>,
    ) as InspectableRenderer;
  });
  const button = (label: string) => tree.root.findAll((node) =>
    node.props.accessibilityLabel === label && typeof node.props.onPress === 'function',
  )[0] as NavigationButton;
  try {
    act(() => { button('Open app menu').props.onPress(); });
    expect(tree.root.findByType(Modal).props.visible).toBe(true);
    expect(tree.root.findAllByType(AppText).some((node) => node.props.children === 'Menu')).toBe(true);
    const rba = button('RBA rates');
    expect(rba.props.accessibilityState.selected).toBe(true);
    expect(StyleSheet.flatten(rba.props.style({ pressed: false })).minHeight).toBeGreaterThanOrEqual(48);
    for (const label of ['Your profile', 'Settings', 'About']) {
      expect(button(label).props.accessibilityState.selected).toBe(false);
    }
    act(() => { rba.props.onPress(); });
    expect(tree.root.findByType(Modal).props.visible).toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
    act(() => { nextFrame!(0); });
    expect(mockNavigate).toHaveBeenCalledWith('/rba');
  } finally {
    act(() => { tree.unmount(); });
    frame.mockRestore();
  }
});
