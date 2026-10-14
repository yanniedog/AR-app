import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Animated, Keyboard, Modal, Text } from 'react-native';

import { SheetSurface } from '../src/components/SheetSurface';

let mockReducedMotion: boolean | null = false;
jest.mock('../src/hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReducedMotion }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ ledger: { scrim: '#00000066', raised: '#fff' }, radius: { lg: 24 } }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../src/components/ledger/LedgerText', () => ({ LedgerText: 'LedgerText' }));
jest.mock('../src/components/TouchTarget', () => ({ TouchTarget: 'TouchTarget' }));
jest.mock('../src/components/icons/LedgerIcon', () => ({ LedgerIcon: 'LedgerIcon' }));
type Renderer = ReactTestRenderer & { root: { findByType: (type: unknown) => { props: Record<string, any> } } };

afterEach(() => { jest.restoreAllMocks(); mockReducedMotion = false; });

test('interrupting a close with reopening cannot hide the reopened sheet', () => {
  const callbacks: ((result: { finished: boolean }) => void)[] = [];
  const stop = jest.fn();
  const timing = jest.spyOn(Animated, 'timing').mockImplementation(() => ({ start: (callback) => { if (callback) callbacks.push(callback); }, stop, reset: jest.fn() }));
  const onClose = jest.fn();
  const sheet = (visible: boolean) => <SheetSurface visible={visible} title="Filters" onClose={onClose}><Text>Lenders</Text></SheetSurface>;
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(sheet(true)) as Renderer; });
  try {
    expect(timing.mock.calls.at(-1)?.[1]).toMatchObject({ duration: 240, toValue: 1, useNativeDriver: true });
    act(() => tree.update(sheet(false)));
    const closing = callbacks.at(-1)!;
    act(() => tree.update(sheet(true)));
    act(() => closing({ finished: true }));
    expect(tree.root.findByType(Modal).props.visible).toBe(true);
    expect(stop).toHaveBeenCalled();
    act(() => tree.update(sheet(false)));
    act(() => callbacks.at(-1)!({ finished: true }));
    expect(tree.root.findByType(Modal).props.visible).toBe(false);
  } finally { act(() => tree.unmount()); }
});

test('native Back dismisses the keyboard before closing a reduced-motion sheet', () => {
  mockReducedMotion = true;
  const isVisible = jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
  const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
  const onClose = jest.fn();
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(<SheetSurface visible title="Filters" onClose={onClose}><Text>Lenders</Text></SheetSurface>) as Renderer; });
  try {
    act(() => tree.root.findByType(Modal).props.onRequestClose());
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    isVisible.mockReturnValue(false);
    act(() => tree.root.findByType(Modal).props.onRequestClose());
    expect(onClose).toHaveBeenCalledTimes(1);
  } finally { act(() => tree.unmount()); }
});
