import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import Svg from 'react-native-svg';
import sampleCore from '../assets/sample/core.json';
import { RbaChart } from '../src/components/charts';
import { ChartText } from '../src/components/charts/ChartText';
import { ChartSliceControls } from '../src/components/charts/ChartSliceControls';
import type { RbaEntry } from '../src/types';

jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Row: 'Row' }));
jest.mock('../src/components/icons/AppIcon', () => ({ __esModule: true, default: 'AppIcon' }));
jest.mock('../src/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: { border: '#ddd', rba: '#123', textFaint: '#666', surface: '#fff', text: '#222', surfaceAlt: '#eee' } }) }));

function plot(tree: any) { return tree.root.findByProps({ accessibilityRole: 'adjustable' }); }
function layout(tree: any) {
  act(() => plot(tree).props.onLayout({ nativeEvent: { layout: { width: 360, height: 160 } } }));
}
function text(tree: any) { return tree.root.findAllByType('AppText').map((node: any) => String(node.props.children)).join('\n'); }

test('actual published cash rates retain percent units on axes, selected slices, prior facts, hold markers and accessibility', () => {
  const data = sampleCore.rba.slice(-3), original = JSON.stringify(data), holds = ['2026-06-01'];
  expect(data.map(entry => entry.rate)).toEqual([3.85, 4.1, 4.35]);
  let tree: any;
  act(() => { tree = TestRenderer.create(<RbaChart data={data} holds={holds} />); });
  try {
    layout(tree);
    const axisAndSelection = () => tree.root.findAllByType(ChartText).map((node: any) => String(node.props.children));
    expect(axisAndSelection()).toEqual(['4.35%', '3.85%', '4.35%']);
    expect(plot(tree).props.accessibilityLabel).toContain('4.35% · Held');
    expect(text(tree)).toContain('4.35%'); expect(text(tree)).toContain('Held · No change');
    act(() => tree.root.findAllByProps({ accessibilityLabel: 'Previous date' }).find((node: any) => typeof node.props.onPress === 'function').props.onPress());
    expect(plot(tree).props.accessibilityLabel).toContain('4.35%');
    expect(text(tree)).toContain('Prior · 4.10% → 4.35%');
    act(() => plot(tree).props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }));
    expect(plot(tree).props.accessibilityLabel).toContain('4.10%');
    expect(tree.root.findByType(ChartSliceControls).props.valueLabel).toBe('4.10%');
    expect(text(tree)).toContain('Prior · 3.85% → 4.10%');
    expect(JSON.stringify(tree.toJSON())).not.toMatch(/435\.00%|410\.00%|385\.00%/);
    expect(JSON.stringify(data)).toBe(original);
  } finally { act(() => tree.unmount()); }
});

test('percent presentation keeps observed zero distinct from a missing observation', () => {
  const data: RbaEntry[] = [{ date: '2026-01-01', rate: 0 }, { date: '2026-02-01', rate: 0.1 }];
  let tree: any;
  act(() => { tree = TestRenderer.create(<RbaChart data={data} selectedDate={data[0].date} />); });
  try {
    layout(tree);
    expect(tree.root.findByType(ChartSliceControls).props.valueLabel).toBe('0.00%');
    expect(plot(tree).props.accessibilityLabel).toContain('0.00%');
    expect(tree.root.findAllByType(ChartText).map((node: any) => node.props.children)).toEqual(['0.10%', '0.00%', '0.00%']);
    act(() => tree.update(<RbaChart data={[{ date: 'invalid', rate: 0 }]} />));
    expect(tree.root.findByType(ChartSliceControls).props.valueLabel).toBe('Unknown');
    expect(plot(tree).props.accessibilityLabel).toContain('Unknown');
  } finally { act(() => tree.unmount()); }
});

test('percent-label correction retains genuine measured SVG render readiness', () => {
  jest.useFakeTimers();
  const onGraphicReady = jest.fn(), data: RbaEntry[] = [{ date: '2026-01-01', rate: 4.1 }, { date: '2026-02-01', rate: 4.35 }];
  let tree: any;
  try {
    act(() => { tree = TestRenderer.create(<RbaChart data={data} onGraphicReady={onGraphicReady} />); });
    act(() => jest.runOnlyPendingTimers()); expect(onGraphicReady).not.toHaveBeenCalled();
    layout(tree); act(() => jest.runOnlyPendingTimers()); expect(onGraphicReady).not.toHaveBeenCalled();
    act(() => tree.root.findByType(Svg).props.onLayout({ nativeEvent: { layout: { width: 360, height: 160 } } }));
    act(() => jest.runOnlyPendingTimers());
    expect(onGraphicReady).toHaveBeenLastCalledWith(expect.objectContaining({ expectedCount: 2, pointCount: 2, accessibleSummary: true, layoutMeasured: true, emptyStateRendered: false }));
    expect(plot(tree).props.accessibilityLabel).toContain('4.35%');
  } finally { if (tree) act(() => tree.unmount()); jest.useRealTimers(); }
});
