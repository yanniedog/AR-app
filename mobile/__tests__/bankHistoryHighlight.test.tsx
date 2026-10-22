import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import Svg, { Path } from 'react-native-svg';

import { uiProductName } from '../src/lib/uiCopy';
import { BankHistoryChart } from '../src/components/BankHistoryChart';
import type { BankHistoryPoint } from '../src/types';
import captured from './fixtures/public_rates/broken-hill-history-20261022.json';

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
  label: uiProductName({ product_name: 'Selected product' }),
  values: { '2026-09-25': 0.045, '2026-09-26': 0.046, '2026-09-27': null, '2026-09-28': 0.05 },
};

test('keeps the SVG mounted through unchanged parent commits while chart date controls still update', () => {
  const props = { section: 'Savings' as const, dates, points: emptyMarket, allDates: dates, highlightSeries };
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(<BankHistoryChart {...props} />) as Renderer; });
  try {
    const chart = tree.root.findByProps({ accessibilityRole: 'image' });
    act(() => chart.props.onLayout({ nativeEvent: { layout: { width: 320 } } }));
    const controls = tree.root.findAllByType('ChartSliceControls')[0];
    const callback = controls.props.onChangeIndex;
    act(() => tree.update(<BankHistoryChart {...props} />));
    expect(tree.root.findAllByType('ChartSliceControls')[0].props.onChangeIndex).toBe(callback);
    act(() => callback(0));
    expect(tree.root.findAllByType('ChartSliceControls')[0].props.valueLabel).toBe('4.50%');
    act(() => tree.update(<BankHistoryChart {...props} highlightSeries={{ ...highlightSeries,
      values: { ...highlightSeries.values, '2026-09-25': 0.06 } }} />));
    expect(tree.root.findAllByType('ChartSliceControls')[0].props.valueLabel).toBe('6.00%');
  } finally { act(() => tree.unmount()); }
});

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
    expect(onGraphicReady).not.toHaveBeenCalled();
    act(() => tree.root.findAllByType(Svg)[0].props.onLayout({ nativeEvent: { layout: { width: 320, height: 180 } } }));
    expect(onGraphicReady).toHaveBeenCalledTimes(1);
    expect(onGraphicReady).toHaveBeenLastCalledWith(expect.objectContaining({
      contentRevision: 'product-history', availability: 'rendered', expectedCount: 3, pointCount: 3, accessibleSummary: true, layoutMeasured: true,
    }));

    const paths = tree.root.findAllByType(Path);
    expect(paths).toHaveLength(1);
    expect(String(paths[0].props.d).match(/[ML]/g)).toEqual(['M', 'L', 'M']);
    expect(String(paths[0].props.d)).not.toMatch(/NaN|Infinity/);
    let controls = tree.root.findAllByType('ChartSliceControls')[0];
    expect(controls.props.valueLabel).toBe('5.00%');
    expect(controls.props.facts).toBeUndefined();
    act(() => controls.props.onChangeIndex(2));
    controls = tree.root.findAllByType('ChartSliceControls')[0];
    expect(controls.props.valueLabel).toBe('Unknown');
    expect(controls.props.facts).toBeUndefined();
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
      highlightSeries={{ label: uiProductName({ product_name: 'Invalid product' }), values: { '2026-09-25': NaN, '2026-09-28': Infinity } }}
      onGraphicReady={onGraphicReady}
    />) as Renderer;
  });
  try {
    expect(tree.root.findAllByProps({ accessibilityRole: 'image' })).toHaveLength(0);
    expect(onGraphicReady).not.toHaveBeenCalled();
    act(() => tree.root.findAllByType('AppText')[0].props.onLayout({ nativeEvent: { layout: { width: 320, height: 24 } } }));
    expect(onGraphicReady).toHaveBeenLastCalledWith(expect.objectContaining({
      expectedCount: 2, layoutMeasured: true, emptyStateRendered: true, availability: 'unavailable', pointCount: 0, accessibleSummary: false,
    }));
  } finally { act(() => tree.unmount()); }
});

test('captured lender observations and Unknown counts follow the selected window', () => {
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(<BankHistoryChart {...captured.lender} section="Mortgage" />) as Renderer; });
  try {
    const chart = () => tree.root.findByProps({ accessibilityRole: 'image' });
    const facts = () => tree.root.findAllByType('AppText').map(node => node.props.children);
    expect(chart().props.accessibilityLabel).toContain('27 Observed');
    expect(facts()).toContain('Missing observations: 4 · Unknown');
    const all = tree.root.findAllByType('Chip').find(node => node.props.label === 'All')!;
    act(() => all.props.onPress());
    expect(chart().props.accessibilityLabel).toContain('126 Observed');
    expect(facts()).toContain('Missing observations: 37 · Unknown');
  } finally { act(() => tree.unmount()); }
});

test('product observations exclude Unknown dates even when cash-rate context is available', () => {
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(<BankHistoryChart section="Mortgage" dates={dates} points={emptyMarket}
    highlightSeries={highlightSeries} rba={[{ date: dates[0], rate: 0.04 }]} />) as Renderer; });
  try {
    const chart = tree.root.findByProps({ accessibilityRole: 'image' });
    expect(chart.props.accessibilityLabel).toContain('3 Observed');
    expect(tree.root.findAllByType('AppText').map(node => node.props.children)).toContain('Missing observations: 1 · Unknown');
    const controls = tree.root.findAllByType('ChartSliceControls')[0];
    act(() => controls.props.onChangeIndex(2));
    expect(tree.root.findAllByType('ChartSliceControls')[0].props.valueLabel).toBe('Unknown');
    expect(tree.root.findAllByType('ChartSliceControls')[0].props.facts).toBeUndefined();
  } finally { act(() => tree.unmount()); }
});

test('captured fallback-only gaps recover when the verified archive replaces the same-date projection', () => {
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(<BankHistoryChart {...captured.fallbackLender} section="Mortgage" contentRevision="fallback" />) as Renderer; });
  try {
    const chart = () => tree.root.findByProps({ accessibilityRole: 'image' });
    const facts = () => tree.root.findAllByType('AppText').map(node => node.props.children);
    expect(captured.fallbackGlobalMissing).toHaveLength(28);
    expect(chart().props.accessibilityLabel).toContain('5 Observed');
    expect(facts()).toContain('Missing observations: 26 · Unknown');
    act(() => tree.root.findAllByType('ChartSliceControls')[0].props.onChangeIndex(29));
    expect(tree.root.findAllByType('ChartSliceControls')[0].props.valueLabel).toBe('Unknown');
    act(() => tree.update(<BankHistoryChart {...captured.lender} section="Mortgage" contentRevision="verified-archive" />));
    expect(chart().props.accessibilityLabel).toContain('27 Observed');
    expect(facts()).toContain('Missing observations: 4 · Unknown');
    act(() => tree.root.findAllByType('ChartSliceControls')[0].props.onChangeIndex(29));
    expect(tree.root.findAllByType('ChartSliceControls')[0].props.valueLabel).toBe('5.94% – 13.75%');
  } finally { act(() => tree.unmount()); }
});
