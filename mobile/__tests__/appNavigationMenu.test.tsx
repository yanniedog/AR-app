import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Keyboard, Modal } from 'react-native';
import { SheetSurface } from '../src/components/SheetSurface';
import { AppNavigationMenu, NavigationMenuButton, NavigationMenuProvider } from '../src/components/AppNavigationMenu';
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ router: { navigate: (...args: unknown[]) => mockNavigate(...args) }, usePathname: () => '/settings' }));
jest.mock('../src/data/store', () => ({ useStore: (selector: any) => selector({ hydrated: true }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }) }));
jest.mock('../src/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
it('opens one Account sheet with three destinations, closes before navigation and handles Cancel', () => {
  let nextFrame: FrameRequestCallback | undefined;
  const frame = jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => { nextFrame = callback; return 1; });
  const keyboard = jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
  let tree: any;
  act(() => { tree = TestRenderer.create(<NavigationMenuProvider><NavigationMenuButton /><AppNavigationMenu /></NavigationMenuProvider>); });
  const control = (label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
  try {
    act(() => control('Account').props.onPress());
    const sheet = tree.root.findByType(SheetSurface); expect(sheet.props.visible).toBe(true);
    expect(tree.root.findByType(Modal).props).toMatchObject({ visible: true, animationType: 'none' });
    expect(['Profile', 'Settings', 'About'].map(label => Boolean(control(label)))).toEqual([true, true, true]);
    expect(control('Settings').props.accessibilityState.selected).toBe(true);
    act(() => control('Profile').props.onPress());
    expect(tree.root.findByType(SheetSurface).props.visible).toBe(false); expect(mockNavigate).not.toHaveBeenCalled();
    act(() => nextFrame!(0)); expect(mockNavigate).toHaveBeenCalledWith('/profile');
    act(() => control('Account').props.onPress()); act(() => tree.root.findByType(Modal).props.onRequestClose());
    expect(tree.root.findByType(SheetSurface).props.visible).toBe(false);
    expect(tree.root.findByType(Modal).props.visible).toBe(false);
  } finally { act(() => tree.unmount()); frame.mockRestore(); keyboard.mockRestore(); }
});
