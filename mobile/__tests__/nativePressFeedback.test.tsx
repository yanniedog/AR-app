import React from 'react';
import mockReact from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';

import { PressFeedback } from '../src/components/PressFeedback';
import { Chip } from '../src/components/ui';

let mockReducedMotion: boolean | null = false;
jest.mock('../src/hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReducedMotion }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => jest.requireActual('../src/theme/theme').lightTheme }));
jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => ({ __esModule: true, default: ({ children, ...props }: any) => mockReact.createElement('Pressable', props, typeof children === 'function' ? children({ pressed: false }) : children) }));
type Node = { props: Record<string, any> };
type Renderer = ReactTestRenderer & { root: { findByType: (type: unknown) => Node; findAll: (predicate: (node: Node) => boolean) => Node[] } };

afterEach(() => { jest.restoreAllMocks(); mockReducedMotion = false; });

test('compresses contents with the native driver while target geometry and events stay intact', () => {
  const timing = jest.spyOn(Animated, 'timing').mockImplementation(() => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() }));
  const onPressIn = jest.fn();
  const onPressOut = jest.fn();
  const bounds = { minWidth: 48, minHeight: 48, padding: 12 };
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(<PressFeedback style={bounds} onPressIn={onPressIn} onPressOut={onPressOut}><Text>Save</Text></PressFeedback>) as Renderer; });
  try {
    const target = tree.root.findByType(Pressable);
    act(() => target.props.onPressIn({}));
    expect(timing.mock.calls.at(-1)?.[1]).toMatchObject({ duration: 80, toValue: 0.97, useNativeDriver: true });
    act(() => target.props.onPressOut({}));
    expect(timing.mock.calls.at(-1)?.[1]).toMatchObject({ duration: 160, toValue: 1, useNativeDriver: true });
    expect(target.props.style).toEqual(bounds);
    expect(target.props.style.transform).toBeUndefined();
    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
  } finally { act(() => tree.unmount()); }
});

test.each([null, true])('suppresses press travel when reduced motion is %s', (preference) => {
  mockReducedMotion = preference;
  const timing = jest.spyOn(Animated, 'timing');
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(<PressFeedback><Text>Save</Text></PressFeedback>) as Renderer; });
  try {
    const target = tree.root.findByType(Pressable);
    act(() => { target.props.onPressIn({}); target.props.onPressOut({}); });
    expect(timing).not.toHaveBeenCalled();
  } finally { act(() => tree.unmount()); }
});

test('a chip keeps intrinsic width instead of expanding its contents across the available row', () => {
  mockReducedMotion = true;
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(<Chip label="Comparison rate" selected onPress={() => {}} />) as Renderer; });
  try {
    const layers = tree.root.findAll(node => Array.isArray(node.props.style)
      && StyleSheet.flatten(node.props.style)?.transform !== undefined);
    expect(layers.length).toBeGreaterThan(0);
    expect(StyleSheet.flatten(layers[0].props.style)).toMatchObject({ flexGrow: 0, flexShrink: 1 });
    const target = tree.root.findByType(Pressable);
    expect(typeof target.props.style).toBe('function');
    const bounds = StyleSheet.flatten(target.props.style({ pressed: false }));
    expect(bounds.minWidth).toBe(48);
    expect(bounds.width).toBeUndefined();
  } finally { act(() => tree.unmount()); }
});
