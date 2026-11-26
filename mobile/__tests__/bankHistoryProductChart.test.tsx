import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { BankHistoryChart } from '../src/components/BankHistoryChart';
import { ChartSliceControls } from '../src/components/charts/ChartSliceControls';

type TestNode = {
  props: Record<string, unknown>;
  findAllByProps: (props: Record<string, unknown>) => TestNode[];
  findByType: (type: typeof ChartSliceControls) => { props: React.ComponentProps<typeof ChartSliceControls> };
  findAllByType: (type: string) => TestNode[];
  findAll: (predicate: (node: TestNode) => boolean) => TestNode[];
};

jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Chip: 'Chip', Row: 'Row' }));
jest.mock('../src/components/icons/AppIcon', () => ({ __esModule: true, default: 'AppIcon' }));
jest.mock('../src/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../src/theme/ThemeProvider', () => {
  const { DARK, LEDGER_DARK } = jest.requireActual('../src/theme/colors');
  return { useTheme: () => ({ dark: true, colors: DARK, ledger: LEDGER_DARK }) };
});

test('savings product chart shows market facts and cash rate across a missing product date', () => {
  const dates = ['2026-11-16', '2026-11-17'];
  const points = dates.map((date) => ({ date, min: 0.01, max: 0.055, mean: 0.025, median: 0.02, count: 4 }));
  let tree!: ReactTestRenderer & { root: TestNode };
  act(() => {
    tree = TestRenderer.create(
      <BankHistoryChart
        dates={dates}
        points={points}
        section="Savings"
        productHistory
        rba={[{ date: '2026-11-16', rate: 4.1 }, { date: '2026-11-17', rate: 4.35 }]}
        highlightSeries={{
          label: 'Product',
          valueScope: 'All tiers',
          values: { [dates[0]]: 0.065, [dates[1]]: null },
        }}
      />,
    ) as typeof tree;
  });
  try {
    const plot = () => tree.root.findAllByProps({ accessibilityRole: 'image' })[0];
    act(() => (plot().props.onLayout as (event: unknown) => void)({ nativeEvent: { layout: { width: 320 } } }));
    const slice = () => tree.root.findByType(ChartSliceControls).props;
    // Benchmarks are on by default; the toggle hides and restores them.
    const benchmarks = tree.root.findAllByProps({ label: 'Benchmarks' })[0];
    act(() => (benchmarks.props.onPress as () => void)());
    expect(slice().valueLabel).toBe('Unknown');
    expect(slice().facts).toBeUndefined();
    expect(plot().props.accessibilityLabel).not.toContain('RBA cash rate');
    act(() => (benchmarks.props.onPress as () => void)());
    expect(slice().valueLabel).toBe('Unknown');
    expect(slice().facts).toEqual([
      { label: 'Market rate range', value: '1.00% – 5.50%' },
      { label: 'Market median', value: '2.00%' },
      { label: 'Market mean', value: '2.50%' },
      { label: 'RBA cash rate', value: '4.35%' },
    ]);
    expect(plot().props.accessibilityLabel).toContain('RBA cash rate 4.35%');
    const labels = tree.root.findAllByType('AppText').map(node => node.props.children);
    expect(labels).toEqual(expect.arrayContaining(['Product rate', 'Market rate range', 'Market median', 'Market mean', 'RBA cash rate']));
    expect(tree.root.findAll(node => node.props.strokeDasharray === '8 4' && typeof node.props.d === 'string').length).toBeGreaterThan(0);

    act(() => slice().onChangeIndex(0));
    expect(slice().valueLabel).toBe('6.50% · All tiers');
    expect(slice().facts).toContainEqual({ label: 'RBA cash rate', value: '4.10%' });
    act(() => (benchmarks.props.onPress as () => void)());
    expect(slice().valueLabel).toBe('6.50% · All tiers');
    expect(slice().facts).toBeUndefined();
  } finally {
    act(() => tree.unmount());
  }
});

test('product history can change its window or show benchmarks with no product observations', () => {
  // The first observation is 123 days old: visible on the 1-year default, not on 90 or 30 days.
  const dates = ['2026-07-17', '2026-11-17'];
  const points = dates.map((date) => ({ date, min: 0.04, max: 0.07, mean: 0.05, median: 0.05, count: 4 }));
  let tree!: ReactTestRenderer & { root: TestNode };
  act(() => {
    tree = TestRenderer.create(
      <BankHistoryChart dates={dates} points={points} section="Mortgage" productHistory
        highlightSeries={{ label: 'Product', values: { [dates[0]]: 0.06 } }} />,
    ) as typeof tree;
  });
  try {
    const press = (label: string) => act(() => {
      const control = tree.root.findAllByProps({ label })[0];
      (control.props.onPress as () => void)();
    });
    const slice = () => tree.root.findByType(ChartSliceControls).props;
    // Opens on a year with benchmarks shown, so the July observation is in range.
    expect(slice().facts).toContainEqual({ label: 'Market median', value: '5.00%' });
    act(() => slice().onChangeIndex(0));
    expect(slice().valueLabel).toBe('6.00%');
    press('Benchmarks');
    press('30 days');
    expect(tree.root.findAllByType('AppText').some(node => node.props.children === 'No observations')).toBe(true);
    press('Benchmarks');
    expect(slice().valueLabel).toBe('Unknown');
    expect(slice().facts).toContainEqual({ label: 'Market median', value: '5.00%' });
  } finally {
    act(() => tree.unmount());
  }
});
