import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Animated, AppState, Modal, View } from 'react-native';
import { ICON_WORDS, useWordBubble, type IconWord } from '../src/components/WordBubble';
import { AppText } from '../src/components/ui';

let mockReducedMotion: boolean | null = false;
let mockDimensions = { width: 360, height: 800, scale: 3, fontScale: 1 };
jest.mock('../src/hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReducedMotion }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ default: () => mockDimensions }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => jest.requireActual('../src/theme/theme').lightTheme }));
type Tree = ReactTestRenderer & { root: { findByType: (type: unknown) => { props: Record<string, any> }; findAllByType: (type: unknown) => unknown[];
  findByProps: (props: Record<string, unknown>) => { props: Record<string, any> } } };
type Measure = (x: number, y: number, width: number, height: number) => void;
let mockOriginMeasure: jest.Mock<void, [Measure]>;
let controller!: ReturnType<typeof useWordBubble>;
function Host({ word = 'History' }: { word?: IconWord }) { controller = useWordBubble(word); return controller.overlay; }
beforeEach(() => {
  jest.useFakeTimers();
  mockDimensions = { width: 360, height: 800, scale: 3, fontScale: 1 };
  mockOriginMeasure = jest.fn(done => done(0, 0, 360, 800));
  jest.spyOn(View.prototype, 'measureInWindow').mockImplementation(done => mockOriginMeasure(done));
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); mockReducedMotion = false; });
function createHost(word: IconWord = 'History') {
  return TestRenderer.create(<Host word={word} />) as Tree;
}
function attachAnchor(rect: [number, number, number, number] = [320, 8, 48, 48]) {
  controller.anchorRef.current = { measureInWindow: (done: Measure) => done(...rect) } as unknown as View;
}
function measureOrigin(tree: Tree) {
  act(() => tree.root.findByProps({ testID: 'word-bubble-origin' }).props.onLayout());
}

test('bubble vocabulary contains single-word labels only and arbitrary descriptions are refused', () => {
  expect(new Set(ICON_WORDS).size).toBe(ICON_WORDS.length);
  for (const word of ICON_WORDS) expect(word).toMatch(/^[A-Za-z]+$/);
  let tree!: Tree;
  act(() => { tree = createHost('Explain how this works' as IconWord); });
  try { attachAnchor(); act(() => controller.show()); expect(tree.root.findAllByType(Modal)).toHaveLength(0); }
  finally { act(() => tree.unmount()); }
});

test('a measured bubble gently fades, auto-dismisses, and Back dismisses without an app action', () => {
  const timing = jest.spyOn(Animated, 'timing').mockImplementation(((_value, options) => ({ start: (done?: (result: { finished: boolean }) => void) => { if (options.toValue === 0) done?.({ finished: true }); }, stop: jest.fn(), reset: jest.fn() })) as typeof Animated.timing);
  let tree!: Tree;
  act(() => { tree = createHost(); });
  try {
    attachAnchor(); act(() => controller.show());
    expect(tree.root.findAllByType(Modal)).toHaveLength(1);
    expect(tree.root.findAllByType(AppText)).toHaveLength(0);
    expect(timing).not.toHaveBeenCalled();
    measureOrigin(tree);
    expect(timing.mock.calls.at(-1)?.[1]).toMatchObject({ toValue: 1, duration: 100, useNativeDriver: true });
    act(() => jest.advanceTimersByTime(1400));
    expect(timing.mock.calls.at(-1)?.[1]).toMatchObject({ toValue: 0, duration: 140, useNativeDriver: true });
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
    act(() => controller.show());
    act(() => tree.root.findByType(Modal).props.onRequestClose());
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  } finally { act(() => tree.unmount()); }
});

test('per-hold words stay inside the finite vocabulary after the actual Modal origin resolves', () => {
  mockReducedMotion = true;
  let tree!: Tree;
  act(() => { tree = createHost(); });
  try {
    attachAnchor();
    act(() => controller.show('Comparison'));
    measureOrigin(tree);
    expect(tree.root.findByType(AppText).props.children).toBe('Comparison');
    expect(tree.root.findByType(Modal).props).toMatchObject({
      transparent: true, statusBarTranslucent: false, navigationBarTranslucent: false,
    });
    act(() => controller.dismiss());
    act(() => controller.show('Explain the comparison calculation' as IconWord));
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
    act(() => controller.show());
    measureOrigin(tree);
    expect(tree.root.findByType(AppText).props.children).toBe('History');
  } finally { act(() => tree.unmount()); }
});

test('dismissal or a later hold invalidates delayed native measurement callbacks', () => {
  mockReducedMotion = true;
  const pending: ((x: number, y: number, width: number, height: number) => void)[] = [];
  let tree!: Tree;
  act(() => { tree = createHost(); });
  try {
    controller.anchorRef.current = { measureInWindow: (done: typeof pending[number]) => pending.push(done) } as unknown as View;
    act(() => controller.show('Comparison'));
    act(() => controller.dismiss());
    act(() => pending[0](320, 100, 48, 48));
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
    act(() => { controller.show('Advertised'); controller.show('LVR'); });
    act(() => pending[1](320, 100, 48, 48));
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
    act(() => pending[2](320, 100, 48, 48));
    measureOrigin(tree);
    expect(tree.root.findByType(AppText).props.children).toBe('LVR');
  } finally { act(() => tree.unmount()); }
});

test.each([true, null])('reduced or unresolved motion %s uses immediate feedback; background and unmount clean up', preference => {
  mockReducedMotion = preference;
  let changed!: (state: string) => void;
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_event: string, next: (state: string) => void) => { changed = next; return { remove }; }) as typeof AppState.addEventListener);
  const timing = jest.spyOn(Animated, 'timing');
  let tree!: Tree;
  act(() => { tree = createHost(); });
  const scheduled = jest.spyOn(global, 'setTimeout');
  const cleared = jest.spyOn(global, 'clearTimeout');
  attachAnchor(); act(() => controller.show());
  measureOrigin(tree);
  expect(timing).not.toHaveBeenCalled();
  act(() => changed('background'));
  expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  act(() => controller.show());
  measureOrigin(tree);
  const ownTimerIndex = scheduled.mock.calls.map(call => call[1]).lastIndexOf(1400);
  const ownTimer = scheduled.mock.results[ownTimerIndex].value;
  act(() => tree.unmount());
  expect(remove).toHaveBeenCalledTimes(1);
  expect(cleared).toHaveBeenCalledWith(ownTimer);
});

test('never paints, animates or starts its lifetime before the current native origin callback', () => {
  const pending: Measure[] = [];
  mockOriginMeasure.mockImplementation(done => { pending.push(done); });
  const timing = jest.spyOn(Animated, 'timing');
  const scheduled = jest.spyOn(global, 'setTimeout');
  let tree!: Tree;
  act(() => { tree = createHost(); });
  try {
    attachAnchor(); act(() => controller.show('Comparison'));
    expect(tree.root.findByProps({ testID: 'word-bubble-origin' }).props.collapsable).toBe(false);
    expect(tree.root.findAllByType(AppText)).toHaveLength(0);
    expect(timing).not.toHaveBeenCalled();
    measureOrigin(tree);
    act(() => jest.advanceTimersByTime(2000));
    expect(tree.root.findAllByType(AppText)).toHaveLength(0);
    expect(timing).not.toHaveBeenCalled();
    expect(scheduled.mock.calls.filter(call => call[1] === 1400)).toHaveLength(0);
    act(() => pending[0](0, -24, 360, 800));
    expect(tree.root.findByType(AppText).props.children).toBe('Comparison');
    expect(timing.mock.calls.at(-1)?.[1]).toMatchObject({ toValue: 1, duration: 100 });
    expect(scheduled.mock.calls.filter(call => call[1] === 1400)).toHaveLength(1);
  } finally { act(() => tree.unmount()); }
});

test.each([[0, 0], [12, -24], [0, 24]])('subtracts both measured Modal origin coordinates %s/%s without an inset constant', (x, y) => {
  mockReducedMotion = true;
  mockOriginMeasure.mockImplementation(done => done(x, y, 360, 800));
  let tree!: Tree;
  act(() => { tree = createHost(); });
  try {
    attachAnchor([100, 328, 48, 48]); act(() => controller.show('Comparison'));
    measureOrigin(tree);
    const style = tree.root.findByProps({ testID: 'word-bubble-content' }).props.style;
    expect(style.left).toBeCloseTo(124 - x - style.width / 2);
    expect(style.top).toBe(328 - y - style.minHeight - 8);
  } finally { act(() => tree.unmount()); }
});

test('clamps the bubble to actual Modal content dimensions rather than the app window', () => {
  mockReducedMotion = true;
  mockOriginMeasure.mockImplementation(done => done(0, 0, 300, 500));
  let tree!: Tree;
  act(() => { tree = createHost(); });
  try {
    attachAnchor([320, 750, 48, 48]); act(() => controller.show());
    measureOrigin(tree);
    const style = tree.root.findByProps({ testID: 'word-bubble-content' }).props.style;
    expect(style.left + style.width).toBe(284);
    expect(style.top + style.minHeight).toBe(492);
  } finally { act(() => tree.unmount()); }
});

test('dismissed, superseded and older same-request origin reads cannot paint or start a timer', () => {
  mockReducedMotion = true;
  const pending: Measure[] = [];
  mockOriginMeasure.mockImplementation(done => { pending.push(done); });
  const scheduled = jest.spyOn(global, 'setTimeout');
  let tree!: Tree;
  act(() => { tree = createHost(); });
  try {
    attachAnchor(); act(() => controller.show('Comparison'));
    const oldLayout = tree.root.findByProps({ testID: 'word-bubble-origin' }).props.onLayout;
    measureOrigin(tree);
    act(() => controller.dismiss());
    act(() => pending[0](0, -24, 360, 800));
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
    act(() => controller.show('Advertised'));
    act(() => oldLayout());
    expect(pending).toHaveLength(1);
    measureOrigin(tree);
    act(() => controller.show('LVR'));
    measureOrigin(tree);
    act(() => pending[1](0, -24, 360, 800));
    expect(tree.root.findAllByType(AppText)).toHaveLength(0);
    measureOrigin(tree);
    act(() => pending[2](0, -24, 360, 800));
    expect(tree.root.findAllByType(AppText)).toHaveLength(0);
    expect(scheduled.mock.calls.filter(call => call[1] === 1400)).toHaveLength(0);
    act(() => pending[3](0, -24, 360, 800));
    expect(tree.root.findByType(AppText).props.children).toBe('LVR');
    expect(scheduled.mock.calls.filter(call => call[1] === 1400)).toHaveLength(1);
  } finally { act(() => tree.unmount()); }
});

test('font changes and unmount reject pending native origin and anchor callbacks', () => {
  mockReducedMotion = true;
  const pending: Measure[] = [], anchors: Measure[] = [];
  mockOriginMeasure.mockImplementation(done => { pending.push(done); });
  let tree!: Tree;
  act(() => { tree = createHost(); });
  attachAnchor(); act(() => controller.show('Comparison'));
  measureOrigin(tree);
  mockDimensions = { ...mockDimensions, fontScale: 2 };
  act(() => tree.update(<Host />));
  act(() => pending[0](0, -24, 360, 800));
  expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  controller.anchorRef.current = { measureInWindow: (done: Measure) => anchors.push(done) } as unknown as View;
  act(() => controller.show('Advertised'));
  mockDimensions = { ...mockDimensions, fontScale: 1 };
  act(() => tree.update(<Host />));
  act(() => anchors[0](100, 328, 48, 48));
  expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  attachAnchor(); act(() => controller.show('LVR'));
  measureOrigin(tree);
  act(() => tree.unmount());
  expect(() => act(() => pending[1](0, -24, 360, 800))).not.toThrow();
});

test.each([[NaN, 0, 360, 800], [0, Infinity, 360, 800], [0, 0, 0, 800], [0, 0, 360, 0]])('invalid measured Modal geometry %j dismisses without a visible bubble', (x, y, width, height) => {
  mockOriginMeasure.mockImplementation(done => done(x, y, width, height));
  const timing = jest.spyOn(Animated, 'timing');
  let tree!: Tree;
  act(() => { tree = createHost(); });
  try {
    attachAnchor(); act(() => controller.show());
    measureOrigin(tree);
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
    expect(timing).not.toHaveBeenCalled();
  } finally { act(() => tree.unmount()); }
});
