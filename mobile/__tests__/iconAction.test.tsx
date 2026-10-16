import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { IconAction } from '../src/components/IconAction';
import { PressFeedback } from '../src/components/PressFeedback';

const mockShow = jest.fn(), mockDismiss = jest.fn();
jest.mock('../src/components/WordBubble', () => ({ useWordBubble: () => ({ anchorRef: { current: null }, show: mockShow, dismiss: mockDismiss, overlay: null }) }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => jest.requireActual('../src/theme/theme').lightTheme }));
jest.mock('../src/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
type Tree = ReactTestRenderer & { root: { findByType: (type: unknown) => { props: Record<string, any> } } };
afterEach(() => jest.clearAllMocks());

test('a held icon names itself without performing or duplicating its exact action', () => {
  const save = jest.fn();
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<IconAction word="Save" icon="star-outline" onPress={save} accessibilityState={{ selected: false }} testID="exact-tier" />) as Tree; });
  try {
    const target = tree.root.findByType(PressFeedback);
    act(() => { target.props.onPressIn(); target.props.onLongPress(); target.props.onPress(); });
    expect(mockShow).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
    act(() => { target.props.onPressIn(); target.props.onPress(); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(target.props).toMatchObject({ testID: 'exact-tier', accessibilityLabel: 'Save', accessibilityState: { selected: false, disabled: false } });
  } finally { act(() => tree.unmount()); }
});

test('dense callers cannot reduce hit targets and disabled actions remain inert', () => {
  const action = jest.fn();
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<IconAction word="Compare" icon="git-compare" onPress={action} disabled style={{ width: 20, minWidth: 20, minHeight: 20 }} />) as Tree; });
  try {
    const target = tree.root.findByType(PressFeedback);
    expect(target.props.style).toMatchObject({ minWidth: 48, minHeight: 48 });
    act(() => target.props.onPress());
    expect(action).not.toHaveBeenCalled();
    expect(target.props.accessibilityState.disabled).toBe(true);
  } finally { act(() => tree.unmount()); }
});
