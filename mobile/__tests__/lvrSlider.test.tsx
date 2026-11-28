import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { LvrSlider, snapLvr } from '../src/components/LvrSlider';

jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button' }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: { border: '#ccc', primary: '#00f', textMuted: '#888', surface: '#fff' } }) }));

test('snapLvr snaps to half points inside 10-100', () => {
  expect(snapLvr(80.2)).toBe(80);
  expect(snapLvr(80.3)).toBe(80.5);
  expect(snapLvr(2)).toBe(10);
  expect(snapLvr(140)).toBe(100);
});

test('unset slider shows the fallback LVR and no Clear; explicit value steps and clears', () => {
  const onChange = jest.fn(), onClear = jest.fn();
  let tree: any;
  act(() => { tree = TestRenderer.create(<LvrSlider value={null} fallback={72.5} onChange={onChange} onClear={onClear} />); });
  try {
    expect(tree.root.findAllByType('Button')).toHaveLength(0);
    expect(tree.root.findByProps({ accessibilityRole: 'adjustable' }).props.accessibilityValue.now).toBe(72.5);
    act(() => tree.update(<LvrSlider value={85} fallback={72.5} onChange={onChange} onClear={onClear} />));
    const slider = tree.root.findByProps({ accessibilityRole: 'adjustable' });
    expect(slider.props.accessibilityValue.now).toBe(85);
    act(() => slider.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
    expect(onChange).toHaveBeenCalledWith(86);
    act(() => slider.props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }));
    expect(onChange).toHaveBeenLastCalledWith(84);
    act(() => tree.root.findByType('Button').props.onPress());
    expect(onClear).toHaveBeenCalled();
  } finally { act(() => tree.unmount()); }
});
