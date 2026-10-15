import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Animated, AppState, BackHandler, Modal, View, type AppStateStatus } from 'react-native';
import { ICON_WORDS, WordBubbleProvider, useWordBubble, type IconWord } from '../src/components/WordBubble';
import { AppText } from '../src/components/ui';

let mockReducedMotion: boolean | null = false;
let mockDimensions = { width: 360, height: 800, scale: 3, fontScale: 1 };
jest.mock('../src/hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReducedMotion }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ default: () => mockDimensions }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => jest.requireActual('../src/theme/theme').lightTheme }));
type Measure = (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void;
type Rect = [number, number, number, number];
type Controller = ReturnType<typeof useWordBubble>;
interface TestNode { props: Record<string, any>; parent: TestNode | null; instance: unknown }
type Tree = ReactTestRenderer & { root: {
  findByProps(props: Record<string, unknown>): TestNode; findAllByProps(props: Record<string, unknown>): TestNode[];
  findByType(type: unknown): TestNode; findAllByType(type: unknown): TestNode[];
}; toJSON(): unknown };
let controller!: Controller;
let mockHostMeasure: jest.Mock<void, [Measure]>;
let backHandlers: (() => boolean)[];
let removedBack: jest.Mock;
function Client({ word = 'History', id = 'main', controllers }: { word?: IconWord; id?: string; controllers?: Record<string, Controller> }) {
  const current = useWordBubble(word);
  if (controllers) controllers[id] = current;
  else controller = current;
  return <View testID={`client-${id}`}>{current.overlay}</View>;
}
function Fixture({ word = 'History', scopeKey = 'Rates' }: { word?: IconWord; scopeKey?: string }) {
  return <WordBubbleProvider scopeKey={scopeKey}><Client word={word} /></WordBubbleProvider>;
}
function createHost(word: IconWord = 'History') { return TestRenderer.create(<Fixture word={word} />) as Tree; }
function hostLayout(tree: Tree, width = 360, height = 800) {
  act(() => tree.root.findByProps({ testID: 'word-bubble-host' }).props.onLayout({ nativeEvent: { layout: { width, height } } }));
}
function attachAnchor(target = controller, rect: Rect = [100, 328, 48, 48]) {
  const [x, y, width, height] = rect;
  const anchor = {
    measureLayout: jest.fn((_host: View, done: (x: number, y: number, width: number, height: number) => void, _fail?: () => void) => done(x, y, width, height)),
    measure: jest.fn((done: Measure) => done(0, 0, width, height, x, y)),
  };
  target.anchorRef.current = anchor as unknown as View;
  return anchor;
}
function content(tree: Tree) { return tree.root.findByProps({ testID: 'word-bubble-content' }); }
function measureBubble(tree: Tree, height = 37) {
  const node = content(tree);
  act(() => node.props.onLayout({ nativeEvent: { layout: { width: node.props.style.width, height } } }));
}
function expectClosed(tree: Tree) {
  expect(tree.root.findAllByProps({ testID: 'word-bubble-content' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'word-bubble-dismiss' })).toHaveLength(0);
}
beforeEach(() => {
  jest.useFakeTimers();
  mockDimensions = { width: 360, height: 800, scale: 3, fontScale: 1 };
  mockHostMeasure = jest.fn(done => done(0, 0, 360, 800, 0, 0));
  jest.spyOn(View.prototype, 'measure').mockImplementation(done => mockHostMeasure(done));
  backHandlers = []; removedBack = jest.fn();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_name, handler) => {
    backHandlers.push(() => handler() === true); return { remove: removedBack };
  }) as typeof BackHandler.addEventListener);
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); mockReducedMotion = false; });

test('finite words and the existing hook API cannot emit arbitrary descriptions or a native Modal', () => {
  expect(new Set(ICON_WORDS).size).toBe(ICON_WORDS.length);
  for (const word of ICON_WORDS) expect(word).toMatch(/^[A-Za-z]+$/);
  let tree!: Tree;
  act(() => { tree = createHost('Explain how this works' as IconWord); });
  try {
    hostLayout(tree); attachAnchor(); act(() => controller.show()); expectClosed(tree);
    expect(controller.overlay).toBeNull();
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
    expect(backHandlers).toHaveLength(0);
  } finally { act(() => tree.unmount()); }
});

test('waits for actual same-root anchor and bubble height before paint, animation and lifetime', () => {
  const pending: Measure[] = [];
  mockHostMeasure.mockImplementation(done => { pending.push(done); });
  const timing = jest.spyOn(Animated, 'timing');
  const scheduled = jest.spyOn(global, 'setTimeout');
  let tree!: Tree;
  act(() => { tree = createHost(); });
  try {
    hostLayout(tree); const anchor = attachAnchor();
    act(() => controller.show('Comparison'));
    expect(anchor.measureLayout).toHaveBeenCalledTimes(1); expectClosed(tree);
    expect(timing).not.toHaveBeenCalled();
    act(() => pending[0](0, 0, 360, 800, 0, 0));
    expect(content(tree).props.importantForAccessibility).toBe('no-hide-descendants');
    expect(content(tree).props.style.opacity.__getValue()).toBe(0);
    expect(tree.root.findAllByProps({ testID: 'word-bubble-dismiss' })).toHaveLength(0);
    act(() => jest.advanceTimersByTime(500));
    expect(timing).not.toHaveBeenCalled();
    expect(scheduled.mock.calls.filter(call => call[1] === 1400)).toHaveLength(0);
    measureBubble(tree, 61);
    expect(content(tree).props.style.top).toBe(328 - 61 - 8);
    expect(content(tree).props.importantForAccessibility).toBe('auto');
    expect(tree.root.findByType(AppText).props.children).toBe('Comparison');
    expect(timing.mock.calls.at(-1)?.[1]).toMatchObject({ toValue: 1, duration: 100, useNativeDriver: true });
    expect(scheduled.mock.calls.filter(call => call[1] === 1400)).toHaveLength(1);
  } finally { act(() => tree.unmount()); }
});

test.each([[0, 0], [12, 24], [-12, -24]])('same-root page origin %s/%s cancels without a window inset assumption', (hostX, hostY) => {
  mockReducedMotion = true;
  mockHostMeasure.mockImplementation(done => done(0, 0, 360, 800, hostX, hostY));
  let tree!: Tree;
  act(() => { tree = createHost(); });
  try {
    hostLayout(tree); attachAnchor(controller, [hostX + 100, hostY + 328, 48, 48]);
    act(() => controller.show('Comparison')); measureBubble(tree, 43);
    const style = content(tree).props.style;
    expect(style.start).toBeCloseTo(124 - style.width / 2);
    expect(style.top + 43 + 8).toBe(328);
    expect(style.left).toBeUndefined();
    expect(content(tree).parent?.props.style.direction).toBe('ltr');
  } finally { act(() => tree.unmount()); }
});

test('uses transformed same-root page measurements instead of untransformed ancestry coordinates', () => {
  mockReducedMotion = true;
  let tree!: Tree;
  act(() => { tree = createHost(); });
  try {
    hostLayout(tree); const anchor = attachAnchor();
    anchor.measureLayout.mockImplementation((_host, done) => done(100, 328, 48, 48));
    anchor.measure.mockImplementation(done => done(0, 0, 48, 48, 80, 288));
    act(() => controller.show('History')); measureBubble(tree);
    const style = content(tree).props.style;
    expect(style.start).toBeCloseTo(104 - style.width / 2);
    expect(style.top + 37 + 8).toBe(288);
  } finally { act(() => tree.unmount()); }
});

test('places near-top anchors below and clamps only to measured host bounds', () => {
  mockReducedMotion = true;
  let tree!: Tree;
  act(() => { tree = createHost(); });
  try {
    hostLayout(tree, 300, 500); attachAnchor(controller, [320, 8, 48, 48]);
    act(() => controller.show()); measureBubble(tree, 42);
    let style = content(tree).props.style;
    expect(style.top).toBe(8 + 48 + 8); expect(style.start + style.width).toBe(284);
    attachAnchor(controller, [100, 750, 48, 48]);
    act(() => controller.show()); measureBubble(tree, 42);
    style = content(tree).props.style;
    expect(style.top + 42).toBe(492);
  } finally { act(() => tree.unmount()); }
});

test('native Back and outside dismissal leave the actual button accessible without a modal accessibility trap', () => {
  mockReducedMotion = true;
  let tree!: Tree;
  act(() => { tree = createHost(); });
  try {
    hostLayout(tree); attachAnchor(); act(() => controller.show()); measureBubble(tree);
    expect(tree.root.findAllByType(View).some(node => node.props.importantForAccessibility === 'no-hide-descendants')).toBe(false);
    expect(tree.root.findAllByType(View).some(node => node.props.accessibilityViewIsModal)).toBe(false);
    expect(tree.root.findByType(AppText).props.accessibilityLiveRegion).toBe('polite');
    let consumed = false; act(() => { consumed = backHandlers.at(-1)!(); });
    expect(consumed).toBe(true); expectClosed(tree);
    expect(backHandlers.at(-1)!()).toBe(false);
    act(() => controller.show()); measureBubble(tree);
    act(() => tree.root.findByProps({ testID: 'word-bubble-dismiss' }).props.onPress());
    expectClosed(tree); expect(removedBack).toHaveBeenCalled();
  } finally { act(() => tree.unmount()); }
});

test('fade and lifetime start once per request and retain the existing durations', () => {
  const timing = jest.spyOn(Animated, 'timing').mockImplementation(((_value, options) => ({ start: (done?: (result: { finished: boolean }) => void) => { if (options.toValue === 0) done?.({ finished: true }); }, stop: jest.fn(), reset: jest.fn() })) as typeof Animated.timing);
  const scheduled = jest.spyOn(global, 'setTimeout');
  let tree!: Tree;
  act(() => { tree = createHost(); });
  try {
    hostLayout(tree); attachAnchor(); act(() => controller.show());
    const onLayout = content(tree).props.onLayout;
    act(() => { onLayout({ nativeEvent: { layout: { width: 100, height: 37 } } }); onLayout({ nativeEvent: { layout: { width: 100, height: 37 } } }); });
    expect(scheduled.mock.calls.filter(call => call[1] === 1400)).toHaveLength(1);
    expect(timing.mock.calls.at(-1)?.[1]).toMatchObject({ toValue: 1, duration: 100 });
    act(() => jest.advanceTimersByTime(1400));
    expect(timing.mock.calls.at(-1)?.[1]).toMatchObject({ toValue: 0, duration: 140 }); expectClosed(tree);
  } finally { act(() => tree.unmount()); }
});

test.each([true, null])('reduced/unresolved motion %s stays immediate and background/unmount cancels pending work', preference => {
  mockReducedMotion = preference;
  let changed!: (state: AppStateStatus) => void;
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_event, next) => { changed = next; return { remove: jest.fn() }; }) as typeof AppState.addEventListener);
  const timing = jest.spyOn(Animated, 'timing'), cleared = jest.spyOn(global, 'clearTimeout');
  let tree!: Tree;
  act(() => { tree = createHost(); });
  hostLayout(tree); attachAnchor(); act(() => controller.show()); measureBubble(tree);
  expect(timing).not.toHaveBeenCalled();
  expect(content(tree).props.style.opacity.__getValue()).toBe(1);
  act(() => changed('background')); expectClosed(tree);
  act(() => controller.show()); measureBubble(tree);
  act(() => tree.unmount()); expect(cleared).toHaveBeenCalled();
});

test('late ancestry, anchor and bubble-layout callbacks cannot replace a newer word or recreate a dismissed bubble', () => {
  mockReducedMotion = true;
  const pending: Measure[] = [];
  let tree!: Tree;
  act(() => { tree = createHost(); });
  try {
    hostLayout(tree); const anchor = attachAnchor();
    anchor.measure.mockImplementation(done => { pending.push(done); });
    act(() => controller.show('Comparison'));
    act(() => controller.show('Advertised'));
    act(() => pending[0](0, 0, 48, 48, 100, 328)); expectClosed(tree);
    act(() => pending[1](0, 0, 48, 48, 100, 328));
    const oldLayout = content(tree).props.onLayout;
    act(() => controller.dismiss());
    act(() => oldLayout({ nativeEvent: { layout: { width: 100, height: 37 } } })); expectClosed(tree);
    act(() => controller.show('LVR'));
    act(() => tree.unmount());
    expect(() => act(() => pending[2](0, 0, 48, 48, 100, 328))).not.toThrow();
  } finally { if (tree.toJSON()) act(() => tree.unmount()); }
});

test.each(['font', 'route', 'word', 'host'] as const)('%s changes invalidate pending anchor measurements', change => {
  mockReducedMotion = true;
  const pending: Measure[] = [];
  let tree!: Tree;
  act(() => { tree = createHost(); });
  try {
    hostLayout(tree); const anchor = attachAnchor(); anchor.measure.mockImplementation(done => { pending.push(done); });
    act(() => controller.show('Comparison'));
    if (change === 'font') mockDimensions = { ...mockDimensions, fontScale: 2 };
    if (change === 'host') hostLayout(tree, 320, 600);
    else act(() => tree.update(<Fixture word={change === 'word' ? 'Save' : 'History'} scopeKey={change === 'route' ? 'Saved' : 'Rates'} />));
    act(() => pending[0](0, 0, 48, 48, 100, 328)); expectClosed(tree);
  } finally { act(() => tree.unmount()); }
});

test('failed ancestry and malformed native measurements never paint a bubble or retain Back ownership', () => {
  mockReducedMotion = true;
  let tree!: Tree;
  act(() => { tree = createHost(); });
  try {
    hostLayout(tree); let anchor = attachAnchor();
    anchor.measureLayout.mockImplementation((_host, _done, fail) => fail?.());
    act(() => controller.show()); expectClosed(tree); expect(removedBack).toHaveBeenCalled();
    anchor = attachAnchor(); anchor.measure.mockImplementation(done => done(0, 0, 0, 48, 100, 328));
    act(() => controller.show()); expectClosed(tree);
    anchor = attachAnchor(); mockHostMeasure.mockImplementation(done => done(0, 0, 360, 800, NaN, 0));
    act(() => controller.show()); expectClosed(tree);
  } finally { act(() => tree.unmount()); }
});

test('a native Modal can scope its own nearest provider and measurements never use the outer host', () => {
  mockReducedMotion = true;
  const controllers: Record<string, Controller> = {};
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<WordBubbleProvider><Client id="outer" controllers={controllers} />
    <Modal><WordBubbleProvider><Client id="inner" controllers={controllers} /></WordBubbleProvider></Modal>
  </WordBubbleProvider>) as Tree; });
  try {
    const hosts = tree.root.findAllByType(View).filter(node => node.props.testID === 'word-bubble-host');
    expect(hosts).toHaveLength(2);
    act(() => hosts.forEach(node => node.props.onLayout({ nativeEvent: { layout: { width: 360, height: 800 } } })));
    const anchor = attachAnchor(controllers.inner);
    act(() => controllers.inner.show('Save')); measureBubble(tree);
    expect(anchor.measureLayout.mock.calls[0][0]).toBe(hosts[1].instance);
    expect(anchor.measureLayout.mock.calls[0][0]).not.toBe(hosts[0].instance);
    expect(tree.root.findByType(AppText).props.children).toBe('Save');
  } finally { act(() => tree.unmount()); }
});

test.each(['native', 'layout'] as const)('a missing %s callback releases invisible Back ownership after the bounded measurement window', missing => {
  let tree!: Tree;
  act(() => { tree = createHost(); });
  try {
    hostLayout(tree); const anchor = attachAnchor();
    if (missing === 'native') anchor.measureLayout.mockImplementation(() => {});
    act(() => controller.show());
    act(() => jest.advanceTimersByTime(1000));
    expectClosed(tree);
    expect(backHandlers.at(-1)!()).toBe(false);
    expect(removedBack).toHaveBeenCalled();
  } finally { act(() => tree.unmount()); }
});
