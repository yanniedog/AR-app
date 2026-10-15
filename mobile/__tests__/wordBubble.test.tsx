import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Animated, AppState, Modal, View } from 'react-native';
import { ICON_WORDS, useWordBubble, type IconWord } from '../src/components/WordBubble';

let mockReducedMotion: boolean | null = false;
jest.mock('../src/hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReducedMotion }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => jest.requireActual('../src/theme/theme').lightTheme }));
type Tree = ReactTestRenderer & { root: { findByType: (type: unknown) => { props: Record<string, any> }; findAllByType: (type: unknown) => unknown[] } };
let controller!: ReturnType<typeof useWordBubble>;
function Host({ word = 'History' }: { word?: IconWord }) { controller = useWordBubble(word); return controller.overlay; }
beforeEach(() => jest.useFakeTimers());
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); mockReducedMotion = false; });
function attachAnchor() {
  controller.anchorRef.current = { measureInWindow: (done: (x: number, y: number, width: number, height: number) => void) => done(320, 8, 48, 48) } as unknown as View;
}

test('bubble vocabulary contains single-word labels only and arbitrary descriptions are refused', () => {
  expect(new Set(ICON_WORDS).size).toBe(ICON_WORDS.length);
  for (const word of ICON_WORDS) expect(word).toMatch(/^[A-Za-z]+$/);
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<Host word={'Explain how this works' as IconWord} />) as Tree; });
  try { attachAnchor(); act(() => controller.show()); expect(tree.root.findAllByType(Modal)).toHaveLength(0); }
  finally { act(() => tree.unmount()); }
});

test('a measured bubble gently fades, auto-dismisses, and Back dismisses without an app action', () => {
  const timing = jest.spyOn(Animated, 'timing').mockImplementation(((_value, options) => ({ start: (done?: (result: { finished: boolean }) => void) => { if (options.toValue === 0) done?.({ finished: true }); }, stop: jest.fn(), reset: jest.fn() })) as typeof Animated.timing);
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<Host />) as Tree; });
  try {
    attachAnchor(); act(() => controller.show());
    expect(tree.root.findAllByType(Modal)).toHaveLength(1);
    expect(timing.mock.calls.at(-1)?.[1]).toMatchObject({ toValue: 1, duration: 100, useNativeDriver: true });
    act(() => jest.advanceTimersByTime(1400));
    expect(timing.mock.calls.at(-1)?.[1]).toMatchObject({ toValue: 0, duration: 140, useNativeDriver: true });
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
    act(() => controller.show());
    act(() => tree.root.findByType(Modal).props.onRequestClose());
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  } finally { act(() => tree.unmount()); }
});

test.each([true, null])('reduced or unresolved motion %s uses immediate feedback; background and unmount clean up', preference => {
  mockReducedMotion = preference;
  let changed!: (state: string) => void;
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_event: string, next: (state: string) => void) => { changed = next; return { remove }; }) as typeof AppState.addEventListener);
  const timing = jest.spyOn(Animated, 'timing');
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<Host />) as Tree; });
  const scheduled = jest.spyOn(global, 'setTimeout');
  const cleared = jest.spyOn(global, 'clearTimeout');
  attachAnchor(); act(() => controller.show());
  expect(timing).not.toHaveBeenCalled();
  act(() => changed('background'));
  expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  act(() => controller.show());
  const ownTimerIndex = scheduled.mock.calls.map(call => call[1]).lastIndexOf(1400);
  const ownTimer = scheduled.mock.results[ownTimerIndex].value;
  act(() => tree.unmount());
  expect(remove).toHaveBeenCalledTimes(1);
  expect(cleared).toHaveBeenCalledWith(ownTimer);
});
