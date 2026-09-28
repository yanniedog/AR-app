import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Path } from 'react-native-svg';

import { BankHistoryChart } from '../src/components/BankHistoryChart';
import type { BankHistoryPoint } from '../src/types';

type TestNode = {
  props: Record<string, any>;
  findByProps: (props: Record<string, unknown>) => TestNode;
  findAllByProps: (props: Record<string, unknown>) => TestNode[];
  findAllByType: (type: React.ElementType | string) => TestNode[];
};
type Renderer = ReactTestRenderer & { root: TestNode };

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { createAnimatedComponent: (component: unknown) => component },
  useAnimatedProps: (build: () => unknown) => build(),
}));
jest.mock('../src/hooks/useFirstMountDrawIn', () => ({ useFirstMountDrawIn: () => ({ value: 1 }) }));
jest.mock('../src/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Chip: 'Chip', Row: 'Row' }));
jest.mock('../src/components/charts/ChartSliceControls', () => ({ ChartSliceControls: 'ChartSliceControls' }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ dark: false, colors: {
  primary: '#2563eb', border: '#cccccc', textFaint: '#666666', rateLoan: '#0000aa',
  rateDeposit: '#008800', rba: '#888888', warning: '#ffaa00', surface: '#ffffff',
} }) }));

const dates = ['2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28'];
const emptyMarket: BankHistoryPoint[] = dates.map(date => ({
  date, min: null, max: null, mean: null, median: null, count: 0,
}));
const highlightSeries = {
  label: 'Selected product',
  values: { '2026-09-25': 0.045, '2026-09-26': 0.046, '2026-09-27': null, '2026-09-28': 0.05 },
};

test('product-only observations render after layout and retain gaps without inventing market statistics', () => {
  const onGraphicReady = jest.fn();
  let tree!: Renderer;
  act(() => {
    tree = TestRenderer.create(<BankHistoryChart
      section="Savings" dates={dates} points={emptyMarket} allDates={dates}
      highlightSeries={highlightSeries} contentRevision="product-history" onGraphicReady={onGraphicReady}
    />) as Renderer;
  });
  try {
    const chart = tree.root.findByProps({ accessibilityRole: 'image' });
    expect(chart.props.accessibilityLabel).toContain('Selected product 5.00%');
    expect(chart.props.accessibilityLabel).not.toMatch(/range|mean|median/);
    expect(onGraphicReady).not.toHaveBeenCalled();
    act(() => chart.props.onLayout({ nativeEvent: { layout: { width: 320 } } }));
    expect(onGraphicReady).toHaveBeenCalledTimes(1);
    expect(onGraphicReady).toHaveBeenLastCalledWith(expect.objectContaining({
      contentRevision: 'product-history', availability: 'rendered', pointCount: 4, accessibleSummary: true,
    }));

    const paths = tree.root.findAllByType(Path);
    expect(paths).toHaveLength(1);
    expect(String(paths[0].props.d).match(/[ML]/g)).toEqual(['M', 'L', 'M']);
    expect(String(paths[0].props.d)).not.toMatch(/NaN|Infinity/);
    let controls = tree.root.findAllByType('ChartSliceControls')[0];
    expect(controls.props.valueLabel).toBe('5.00%');
    expect(controls.props.detail).toBeNull();
    act(() => controls.props.onChangeIndex(2));
    controls = tree.root.findAllByType('ChartSliceControls')[0];
    expect(controls.props.valueLabel).toBe('—');
    expect(controls.props.detail).toBeNull();
    expect(tree.root.findByProps({ accessibilityRole: 'image' }).props.accessibilityLabel)
      .not.toMatch(/Selected product|range|mean|median/);
    act(() => controls.props.onChangeIndex(0));
    expect(tree.root.findAllByType('ChartSliceControls')[0].props.valueLabel).toBe('4.50%');
  } finally { act(() => tree.unmount()); }
});

test('nonfinite product values cannot turn an empty market into an available chart', () => {
  const onGraphicReady = jest.fn();
  let tree!: Renderer;
  act(() => {
    tree = TestRenderer.create(<BankHistoryChart
      section="Savings" dates={dates} points={emptyMarket}
      highlightSeries={{ label: 'Invalid product', values: { '2026-09-25': NaN, '2026-09-28': Infinity } }}
      onGraphicReady={onGraphicReady}
    />) as Renderer;
  });
  try {
    expect(tree.root.findAllByProps({ accessibilityRole: 'image' })).toHaveLength(0);
    expect(onGraphicReady).toHaveBeenLastCalledWith(expect.objectContaining({
      availability: 'unavailable', pointCount: 0, accessibleSummary: false,
    }));
  } finally { act(() => tree.unmount()); }
});
