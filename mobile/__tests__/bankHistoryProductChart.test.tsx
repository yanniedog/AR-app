import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { BankHistoryChart } from '../src/components/BankHistoryChart';
import { ChartSliceControls } from '../src/components/charts/ChartSliceControls';

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
  let tree!: TestRenderer.ReactTestRenderer;
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
    );
  });
  try {
    const plot = () => tree.root.findAllByProps({ accessibilityRole: 'image' })[0];
    act(() => plot().props.onLayout({ nativeEvent: { layout: { width: 320 } } }));
    const slice = () => tree.root.findByType(ChartSliceControls).props;
    expect(slice().valueLabel).toBe('Unknown');
    expect(slice().facts).toEqual([
      { label: 'Market rate range', value: '1.00% – 5.50%' },
      { label: 'Market median', value: '2.00%' },
      { label: 'Market mean', value: '2.50%' },
      { label: 'RBA cash rate', value: '4.35%' },
    ]);
    expect(plot().props.accessibilityLabel).toContain('RBA cash rate 4.35%');
    const labels = tree.root.findAllByType('AppText' as React.ElementType).map(node => node.props.children);
    expect(labels).toEqual(expect.arrayContaining(['All tiers', 'Market rate range', 'Market median', 'Market mean', 'RBA cash rate']));
    expect(tree.root.findAll(node => node.props.strokeDasharray === '8 4' && typeof node.props.d === 'string').length).toBeGreaterThan(0);

    act(() => slice().onChangeIndex(0));
    expect(slice().valueLabel).toBe('6.50% · All tiers');
    expect(slice().facts).toContainEqual({ label: 'RBA cash rate', value: '4.10%' });
  } finally {
    act(() => tree.unmount());
  }
});
