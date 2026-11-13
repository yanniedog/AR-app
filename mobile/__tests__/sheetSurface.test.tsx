import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import * as ReactNative from 'react-native';
import { Animated, Dimensions, Keyboard, Modal, Platform, StyleSheet, Text } from 'react-native';

import { SheetSurface, sheetBottomPadding } from '../src/components/SheetSurface';

let mockReducedMotion: boolean | null = false;
let mockBottomInset = 0;
jest.mock('../src/hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReducedMotion }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ ledger: { scrim: '#00000066', raised: '#fff' }, radius: { lg: 24 } }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: mockBottomInset, left: 0, right: 0 }) }));
jest.mock('../src/components/ledger/LedgerText', () => ({ LedgerText: 'LedgerText' }));
jest.mock('../src/components/TouchTarget', () => ({ TouchTarget: 'TouchTarget' }));
jest.mock('../src/components/icons/LedgerIcon', () => ({ LedgerIcon: 'LedgerIcon' }));
type Renderer = ReactTestRenderer & { root: {
  findByType: (type: unknown) => { props: Record<string, any> };
  findAllByProps: (props: Record<string, unknown>) => { props: Record<string, any> }[];
} };

const originalOS = Platform.OS;
afterEach(() => {
  jest.restoreAllMocks();
  mockReducedMotion = false;
  mockBottomInset = 0;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
});

test('Android footer retains physical-pixel clearance above the captured navigation boundary', () => {
  mockReducedMotion = true;
  mockBottomInset = 48;
  const scale = 420 / 160;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
    ...Dimensions.get('window'), scale,
  });
  let tree!: Renderer;
  act(() => {
    tree = TestRenderer.create(<SheetSurface visible title="Filters" onClose={() => undefined}
      footer={<Text>Show 9 rates</Text>}><Text>Lenders</Text></SheetSurface>) as Renderer;
  });
  try {
    const surface = tree.root.findAllByProps({ accessibilityViewIsModal: true })[0];
    const padding = StyleSheet.flatten(surface.props.style).paddingBottom as number;
    // The retained 411 dp capture has a 2275 px action bottom and a 2274 px
    // navigation boundary. Keep the entire 126 px target above that boundary.
    const observedBottom = 2275;
    const navigationTop = 2274;
    const extraPaddingPx = Math.round((padding - mockBottomInset) * scale);
    expect(navigationTop - (observedBottom - extraPaddingPx)).toBeGreaterThanOrEqual(1);
  } finally { act(() => tree.unmount()); }
});

test.each([1, 1.25, 1.5, 1.75, 2, 2.625, 2.75, 3, 3.5, 4])(
  'Android footer clears native inset rounding at density %s within three extra pixels',
  (scale) => {
    for (const insetPx of [0, 1, 24, 63, 126]) {
      // Safe-area-context converts native pixels to a float dp value before
      // crossing the bridge; exercise both exact and float-rounded variants.
      for (const inset of [insetPx / scale, Math.fround(insetPx / scale)]) {
        const padding = sheetBottomPadding(inset, scale, 'android');
        const paddingPx = padding * scale;
        expect(paddingPx).toBeCloseTo(Math.round(paddingPx), 8);
        expect(paddingPx).toBeLessThanOrEqual(Math.max(insetPx, 12 * scale) + 3.00001);
        for (const pixelPhase of [-0.99, -0.5, 0, 0.49, 0.5, 0.99]) {
          const nativeNavigationTop = 2400 - insetPx;
          const roundedFooterBottom = Math.round(2400 + pixelPhase - paddingPx);
          expect(nativeNavigationTop - roundedFooterBottom).toBeGreaterThanOrEqual(1);
        }
      }
    }
  },
);

test.each(['ios', 'web'] as const)('preserves existing %s sheet spacing', (platform) => {
  expect(sheetBottomPadding(0, 2.625, platform)).toBe(12);
  expect(sheetBottomPadding(34.5, 2.625, platform)).toBe(34.5);
});

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


test('the opening render exposes the native Modal before passive animation effects', () => {
  let tree!: Renderer;
  const measured: boolean[] = [];
  function Observed({ visible }: { visible: boolean }) {
    React.useLayoutEffect(() => { measured.push(tree.root.findByType(Modal).props.visible); }, [visible]);
    return <SheetSurface visible={visible} title="Sort" onClose={() => undefined}><Text>Rate</Text></SheetSurface>;
  }
  act(() => { tree = TestRenderer.create(<Observed visible={false} />) as Renderer; });
  try {
    act(() => tree.update(<Observed visible />));
    expect(measured).toEqual([false, true]);
  } finally { act(() => tree.unmount()); }
});

test('duplicate native close events deliver one close and a reopened intent can close again', () => {
  mockReducedMotion = true;
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
  const onClose = jest.fn();
  const sheet = (visible: boolean) => <SheetSurface visible={visible} title="Sort" onClose={onClose}><Text>Rate</Text></SheetSurface>;
  let tree!: Renderer; act(() => { tree = TestRenderer.create(sheet(true)) as Renderer; });
  try {
    const close = tree.root.findByType(Modal).props.onRequestClose;
    act(() => { close(); close(); }); expect(onClose).toHaveBeenCalledTimes(1);
    act(() => tree.update(sheet(false))); act(() => tree.update(sheet(true)));
    act(() => tree.root.findByType(Modal).props.onRequestClose());
    expect(onClose).toHaveBeenCalledTimes(2);
  } finally { act(() => tree.unmount()); }
});

test('audit requires native presentation and measured sheet layout, and keeps closing occlusion until removal frames', () => {
  jest.useFakeTimers();
  const callbacks: ((result: { finished: boolean }) => void)[] = [];
  jest.spyOn(Animated, 'timing').mockImplementation(() => ({ start: callback => { if (callback) callbacks.push(callback); }, stop: jest.fn(), reset: jest.fn() }));
  const evidence = jest.fn();
  const sheet = (visible: boolean) => <SheetSurface visible={visible} onAuditStateChange={evidence} title="Sort" onClose={() => {}}><Text>Rate</Text></SheetSurface>;
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(sheet(true)) as Renderer; });
  try {
    act(() => callbacks.at(-1)!({ finished: true }));
    expect(evidence.mock.calls.at(-1)?.[0]).toBe('opening');
    act(() => tree.root.findByType(Modal).props.onShow());
    expect(evidence.mock.calls.at(-1)?.[0]).toBe('opening');
    act(() => tree.root.findAllByProps({ accessibilityViewIsModal: true })[0].props.onLayout({ nativeEvent: { layout: { width: 400, height: 500 } } }));
    expect(evidence.mock.calls.at(-1)?.[0]).toBe('presented');
    act(() => tree.update(sheet(false)));
    expect(evidence.mock.calls.at(-1)?.[0]).toBe('closing');
    expect(tree.root.findByType(Modal).props.visible).toBe(true);
    act(() => callbacks.at(-1)!({ finished: true }));
    expect(tree.root.findByType(Modal).props.visible).toBe(false);
    expect(evidence.mock.calls.at(-1)?.[0]).toBe('closing');
    act(() => { jest.runOnlyPendingTimers(); });
    expect(evidence.mock.calls.at(-1)?.[0]).toBe('closing');
    act(() => { jest.runOnlyPendingTimers(); });
    expect(evidence.mock.calls.at(-1)?.[0]).toBe('hidden');
  } finally { act(() => tree.unmount()); jest.useRealTimers(); }
});

test('reopening a still-mounted audit sheet reuses actual native presentation without requiring duplicate native events', () => {
  const callbacks: ((result: { finished: boolean }) => void)[] = [];
  jest.spyOn(Animated, 'timing').mockImplementation(() => ({ start: callback => { if (callback) callbacks.push(callback); }, stop: jest.fn(), reset: jest.fn() }));
  const evidence = jest.fn();
  const sheet = (visible: boolean) => <SheetSurface visible={visible} onAuditStateChange={evidence} title="Sort" onClose={() => {}}><Text>Rate</Text></SheetSurface>;
  let tree!: Renderer; act(() => { tree = TestRenderer.create(sheet(true)) as Renderer; });
  try {
    act(() => { tree.root.findByType(Modal).props.onShow(); tree.root.findAllByProps({ accessibilityViewIsModal: true })[0].props.onLayout({ nativeEvent: { layout: { width: 400, height: 500 } } }); callbacks.at(-1)!({ finished: true }); });
    expect(evidence.mock.calls.at(-1)?.[0]).toBe('presented');
    act(() => tree.update(sheet(false))); const oldClose = callbacks.at(-1)!;
    act(() => tree.update(sheet(true)));
    act(() => { oldClose({ finished: true }); callbacks.at(-1)!({ finished: true }); });
    expect(evidence.mock.calls.at(-1)?.[0]).toBe('presented');
    expect(tree.root.findByType(Modal).props.visible).toBe(true);
  } finally { act(() => tree.unmount()); }
});
