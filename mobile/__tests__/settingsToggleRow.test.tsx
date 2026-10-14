import React, { useState } from 'react';
import mockReact from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { ToggleRow } from '../src/components/settings/settingsUi';

jest.mock('../src/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => jest.requireActual('../src/theme/theme').lightTheme }));
jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => mockReact.createElement('Pressable', props,
    typeof children === 'function' ? children({ pressed: false }) : children),
}));

type Node = {
  props: Record<string, any>;
  findByType: (type: unknown) => Node;
  findAllByType: (type: unknown) => Node[];
};
type Renderer = ReactTestRenderer & { root: Node };

test.each([false, true])('the whole row is the sole accessible switch with checked=%s', value => {
  const onChange = jest.fn();
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(<ToggleRow icon="notifications-outline" label="Rate-change alerts" value={value} onChange={onChange} />) as Renderer; });
  try {
    const target = tree.root.findByType(Pressable);
    const bounds = StyleSheet.flatten(target.props.style({ pressed: false }));
    expect(bounds).toMatchObject({ width: '100%', minHeight: 48, minWidth: 48 });
    expect(bounds.transform).toBeUndefined();
    expect(target.props).toMatchObject({ accessible: true, accessibilityRole: 'switch',
      accessibilityLabel: 'Rate-change alerts', accessibilityState: { checked: value, disabled: false } });
    const visual = tree.root.findByType(Switch);
    expect(visual.props).toMatchObject({ value, accessible: false, focusable: false });
    expect(visual.props.onValueChange).toBeUndefined();
    const visualContainer = tree.root.findAllByType(View).find(node => node.props.importantForAccessibility === 'no-hide-descendants');
    expect(visualContainer).toBeDefined();
    expect(visualContainer!.props.pointerEvents).toBe('none');
    expect(visualContainer!.findByType(Switch)).toBe(visual);
    act(() => target.props.onPress());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(!value);
    expect(tree.root.findByType(Switch).props.value).toBe(value);
  } finally { act(() => tree.unmount()); }
});

test('disabled rows neither invoke a change nor expose an enabled native control', () => {
  const onChange = jest.fn();
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(<ToggleRow icon="finger-print" label="App lock" value onChange={onChange} disabled />) as Renderer; });
  try {
    const target = tree.root.findByType(Pressable);
    expect(target.props.disabled).toBe(true);
    expect(target.props.accessibilityState).toEqual({ checked: true, disabled: true });
    expect(tree.root.findByType(Switch).props.disabled).toBe(true);
    act(() => target.props.onPress());
    expect(onChange).not.toHaveBeenCalled();
  } finally { act(() => tree.unmount()); }
});

test.each([false, true])('pending confirmation remains controlled and applies only the confirmed value (%s)', async granted => {
  let finish!: (granted: boolean) => void;
  const confirm = jest.fn(() => new Promise<boolean>(resolve => { finish = resolve; }));
  function ConfirmedToggle() {
    const [value, setValue] = useState(false);
    const [pending, setPending] = useState(false);
    const onChange = async (next: boolean) => {
      setPending(true);
      try { if (await confirm()) setValue(next); }
      finally { setPending(false); }
    };
    return <ToggleRow icon="notifications-outline" label="Rate-change alerts" value={value} onChange={onChange} disabled={pending} />;
  }
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(<ConfirmedToggle />) as Renderer; });
  try {
    act(() => tree.root.findByType(Pressable).props.onPress());
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(tree.root.findByType(Switch).props.value).toBe(false);
    expect(tree.root.findByType(Pressable).props.accessibilityState).toEqual({ checked: false, disabled: true });
    act(() => tree.root.findByType(Pressable).props.onPress());
    expect(confirm).toHaveBeenCalledTimes(1);
    await act(async () => finish(granted));
    expect(tree.root.findByType(Switch).props.value).toBe(granted);
    expect(tree.root.findByType(Pressable).props.accessibilityState).toEqual({ checked: granted, disabled: false });
  } finally { act(() => tree.unmount()); }
});
