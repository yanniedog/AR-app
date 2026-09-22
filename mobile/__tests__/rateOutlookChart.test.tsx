import React, { useState } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import { LedgerText } from '../src/components/ledger';
import {
  outlookMonth,
  outlookRateDomain,
  RateOutlookChart,
} from '../src/components/rba/RateOutlookChart';
import type { EconomicPoint } from '../src/data/economicOutlook';

type TestNode = {
  props: Record<string, unknown>;
  findAll: (predicate: (node: TestNode) => boolean) => TestNode[];
  findAllByType: (type: React.ElementType) => TestNode[];
  findByType: (type: React.ElementType) => TestNode;
};
type InspectableRenderer = ReactTestRenderer & { root: TestNode };

const points: EconomicPoint[] = [
  { date: '2026-08-31', value: 4.35 },
  { date: '2026-11-30', value: 4.57 },
  { date: '2027-02-28', value: 4.67 },
  { date: '2027-05-31', value: 4.68 },
  { date: '2027-08-31', value: 4.65 },
];

function render(element: React.ReactElement): InspectableRenderer {
  let tree!: InspectableRenderer;
  act(() => { tree = TestRenderer.create(element) as InspectableRenderer; });
  return tree;
}

function plot(tree: InspectableRenderer): TestNode {
  return tree.root.findAll((node) => node.props.accessibilityRole === 'image'
    && typeof node.props.onLayout === 'function')[0];
}

function buttons(tree: InspectableRenderer): TestNode[] {
  const unique = new Map<string, TestNode>();
  for (const node of tree.root.findAll((item) => item.props.accessibilityRole === 'button'
    && typeof item.props.onPress === 'function')) {
    const label = String(node.props.accessibilityLabel);
    if (!unique.has(label)) unique.set(label, node);
  }
  return [...unique.values()];
}

function layout(tree: InspectableRenderer, width: number) {
  act(() => {
    (plot(tree).props.onLayout as (event: { nativeEvent: { layout: { width: number } } }) => void)({
      nativeEvent: { layout: { width } },
    });
  });
}

const content = (node: TestNode) => Array.isArray(node.props.children)
  ? node.props.children.join('') : String(node.props.children);

test('rate domain excludes non-finite data and includes a finite current-cash reference', () => {
  expect(outlookRateDomain([], null)).toEqual([0, 1]);
  expect(outlookRateDomain([{ date: '2026-08-31', value: NaN }], Infinity)).toEqual([0, 1]);
  const [minimum, maximum] = outlookRateDomain([...points, { date: '2026-09-01', value: Infinity }], 3);
  expect(Number.isFinite(minimum) && Number.isFinite(maximum)).toBe(true);
  expect(minimum).toBeLessThan(3);
  expect(maximum).toBeGreaterThan(4.68);
});

test('flat and tiny rate changes retain a readable nonzero axis instead of exaggerating the move', () => {
  for (const values of [[4.35], [4.35, 4.351], [-0.1, 0]]) {
    const sample = values.map((value, index) => ({ date: `2026-0${index + 1}-01`, value }));
    const [minimum, maximum] = outlookRateDomain(sample, null);
    expect(maximum - minimum).toBeGreaterThanOrEqual(0.25);
    expect(minimum).toBeLessThanOrEqual(Math.min(...values));
    expect(maximum).toBeGreaterThanOrEqual(Math.max(...values));
  }
});

test('render-ready requires enough measured width to draw the SVG', () => {
  const onReady = jest.fn();
  const tree = render(<RateOutlookChart label="Bond-market outlook" points={points} cashRate={4.35}
    selectedIndex={0} onSelect={jest.fn()} onReady={onReady} />);
  try {
    expect(onReady).not.toHaveBeenCalled();
    expect(tree.root.findAllByType(Svg)).toHaveLength(0);
    for (const width of [0, 40, 76]) {
      layout(tree, width);
      expect(onReady).not.toHaveBeenCalled();
      expect(tree.root.findAllByType(Svg)).toHaveLength(0);
    }
    layout(tree, 320);
    expect(tree.root.findAllByType(Svg)).toHaveLength(1);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledWith(expect.stringContaining('2026-11-30:4.57'));
    const path = String(tree.root.findByType(Path).props.d);
    expect(path).not.toMatch(/NaN|Infinity/);
  } finally {
    act(() => tree.unmount());
  }
});

test('render-ready does not loop when its parent updates state and recreates the callback', () => {
  let observedReadyCount = 0;
  function Harness() {
    const [readyCount, setReadyCount] = useState(0);
    observedReadyCount = readyCount;
    return <RateOutlookChart label="Bond-market outlook" points={points} cashRate={4.35}
      selectedIndex={0} onSelect={jest.fn()} onReady={() => {
        // Bound a regression so the test reports repeated readiness without an infinite render loop.
        if (readyCount < 3) setReadyCount((count) => count + 1);
      }} />;
  }
  const tree = render(<Harness />);
  try {
    layout(tree, 320);
    expect(observedReadyCount).toBe(1);
  } finally {
    act(() => tree.unmount());
  }
});

test('accessible plot summary contains each date and value, excluding unusable observations', () => {
  const tree = render(<RateOutlookChart label="Bond-market outlook"
    points={[...points, { date: 'not-a-date', value: 5 }, { date: '2028-01-01', value: NaN }]}
    cashRate={4.35} selectedIndex={0} onSelect={jest.fn()} />);
  try {
    const summary = String(plot(tree).props.accessibilityLabel);
    expect(summary).toContain('Bond-market outlook');
    for (const point of points) expect(summary).toContain(`${outlookMonth(point.date)}: ${point.value.toFixed(2)} percent`);
    expect(summary).not.toMatch(/NaN|not-a-date|Jan 28/);
    expect(buttons(tree)).toHaveLength(points.length);
  } finally {
    act(() => tree.unmount());
  }
});

test('selecting a month updates the displayed rate, highlight and accessible selection state', () => {
  const onSelect = jest.fn();
  function Harness() {
    const [selected, setSelected] = useState(0);
    return <RateOutlookChart label="Bond-market outlook" points={points} cashRate={4.35}
      selectedIndex={selected} onSelect={(index) => { onSelect(index); setSelected(index); }} />;
  }
  const tree = render(<Harness />);
  try {
    layout(tree, 320);
    const initial = buttons(tree);
    expect(initial[2].props.accessibilityLabel).toBe('Bond-market outlook, Feb 27, 4.67 percent');
    const target = StyleSheet.flatten(initial[2].props.style as ViewStyle);
    expect(target.minHeight).toBeGreaterThanOrEqual(48);
    act(() => { (initial[2].props.onPress as () => void)(); });
    expect(onSelect).toHaveBeenCalledWith(2);
    const next = buttons(tree);
    expect(next[2].props.accessibilityState).toEqual({ selected: true });
    expect(next[0].props.accessibilityState).toEqual({ selected: false });
    expect(tree.root.findAllByType(LedgerText).find((node) => node.props.variant === 'rateLarge')?.props.children).toEqual(['4.67', '%']);
    const dots = tree.root.findAllByType(Circle);
    expect(dots[2].props.r).toBeGreaterThan(dots[0].props.r as number);
  } finally {
    act(() => tree.unmount());
  }
});

test('an out-of-range selection remains usable after the source shortens', () => {
  const tree = render(<RateOutlookChart label="Survey" points={points.slice(0, 1)} cashRate={null}
    selectedIndex={9} onSelect={jest.fn()} />);
  try {
    layout(tree, 320);
    expect(buttons(tree)[0].props.accessibilityState).toEqual({ selected: true });
    const circle = tree.root.findByType(Circle);
    expect(Number.isFinite(circle.props.cx)).toBe(true);
    expect(Number.isFinite(circle.props.cy)).toBe(true);
    expect(tree.root.findAllByType(LedgerText).some((node) => content(node).includes('Dashed line'))).toBe(false);
  } finally {
    act(() => tree.unmount());
  }
});

test('a dense monthly series keeps sparse axis labels while all points stay accessible', () => {
  const monthly = Array.from({ length: 12 }, (_, index) => ({ date: `2027-${String(index + 1).padStart(2, '0')}-01`, value: 4 + index * 0.05 }));
  const tree = render(<RateOutlookChart label="Monthly outlook" points={monthly} cashRate={4.35}
    selectedIndex={0} onSelect={jest.fn()} />);
  try {
    layout(tree, 320);
    const labels = tree.root.findAllByType(SvgText).map(content).filter((label) => !label.endsWith('%'));
    expect(labels).toEqual(['Jan 27', 'Jun 27', 'Dec 27']);
    expect(buttons(tree)).toHaveLength(12);
    expect(plot(tree).props.accessibilityLabel).toEqual(expect.stringContaining('Nov 27: 4.50 percent'));
  } finally {
    act(() => tree.unmount());
  }
});

test('empty or entirely invalid input has an explicit empty state and never reports chart readiness', () => {
  const onReady = jest.fn();
  const tree = render(<RateOutlookChart label="Survey" points={[{ date: 'invalid', value: NaN }]}
    cashRate={4.35} selectedIndex={0} onSelect={jest.fn()} onReady={onReady} />);
  try {
    expect(tree.root.findAllByType(LedgerText).map(content)).toContain('No forecast observations published.');
    expect(tree.root.findAllByType(Svg)).toHaveLength(0);
    expect(buttons(tree)).toHaveLength(0);
    expect(onReady).not.toHaveBeenCalled();
  } finally {
    act(() => tree.unmount());
  }
});

test('an unavailable non-finite cash reference never appears as a numeric comparison or legend', () => {
  const tree = render(<RateOutlookChart label="Survey" points={points} cashRate={NaN}
    selectedIndex={0} onSelect={jest.fn()} />);
  try {
    layout(tree, 320);
    const text = tree.root.findAllByType(LedgerText).map(content).join(' ');
    expect(text).not.toMatch(/NaN|Infinity|Dashed line/);
  } finally {
    act(() => tree.unmount());
  }
});
