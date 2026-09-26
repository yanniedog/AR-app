import React, { useState } from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Circle, Path } from 'react-native-svg';
import { BankRateChart } from '../src/components/passthrough/BankRateChart';
import type { BankRateChartModel } from '../src/data/bankRateOverview';

type TestNode = {
  props: Record<string, unknown>;
  findAll: (predicate: (node: TestNode) => boolean) => TestNode[];
  findByType: (type: React.ElementType) => TestNode;
  findAllByType: (type: React.ElementType) => TestNode[];
};
type Renderer = ReactTestRenderer & { root: TestNode; toJSON: () => unknown };

jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: {
  primary: '#90c9b4', textFaint: '#8c9993', textMuted: '#aeb9b3', text: '#ffffff', border: '#3b4a43',
} }) }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Card: 'Card', Row: 'Row' }));
jest.mock('../src/components/BankAvatar', () => ({ BankAvatar: 'BankAvatar' }));
jest.mock('../src/components/icons/AppIcon', () => ({ __esModule: true, default: 'AppIcon' }));

function fixture(bankCount = 2, dayCount = 4): BankRateChartModel {
  const dates = Array.from({ length: dayCount }, (_, index) => new Date(Date.UTC(2026, 4, 13 + index)).toISOString().slice(0, 10));
  return { dates, decisions: [], min: 0, max: 10, lines: Array.from({ length: bankCount }, (_, bank) => ({
    provider: `Bank ${bank}`, points: dates.map((date, index) => ({ date, value: 4 + bank / 100 + index / 1000, count: 2 })),
  })) };
}

function mount(model: BankRateChartModel): Renderer {
  function Selection() {
    const [provider, setProvider] = useState('Bank 0');
    return <BankRateChart model={model} provider={provider} onProviderChange={setProvider} label="Mean" gap={false} />;
  }
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(<Selection />) as Renderer; });
  return tree;
}
function path(tree: Renderer, id: string): TestNode {
  return tree.root.findAllByType(Path).find(node => node.props.testID === id)!;
}

test('a full 73-bank, 137-day history uses three data paths and retains every observation', () => {
  const model = fixture(73, 137);
  const tree = mount(model);
  try {
    expect(tree.root.findAllByType(Path)).toHaveLength(3);
    expect(tree.root.findAllByType(Circle)).toHaveLength(0);
    expect(String(path(tree, 'bank-rate-background').props.d).match(/[ML]/g)).toHaveLength(73 * 137);
    expect(String(path(tree, 'bank-rate-selected-line').props.d).match(/[ML]/g)).toHaveLength(137);
    expect(String(path(tree, 'bank-rate-selected-observations').props.d).match(/Z/g)).toHaveLength(137);
    expect(JSON.stringify(tree.toJSON())).toContain('137 observed days');
  } finally { act(() => tree.unmount()); }
});

test('bank switching reuses the model and prepared context without recalculating other history', () => {
  const model = fixture(3, 137);
  let historicalReads = 0;
  const point = model.lines[0].points[1], value = point.value;
  Object.defineProperty(point, 'value', { get: () => { historicalReads++; return value; } });
  const tree = mount(model);
  try {
    const background = path(tree, 'bank-rate-background').props;
    const firstLine = path(tree, 'bank-rate-selected-line').props.d;
    const firstMarkers = path(tree, 'bank-rate-selected-observations').props.d;
    const reads = historicalReads;
    expect(reads).toBeGreaterThan(0);
    const next = tree.root.findAll(node => node.props.accessibilityLabel === 'Next bank alphabetically' && typeof node.props.onPress === 'function')[0];
    act(() => { (next.props.onPress as () => void)(); });
    expect(tree.root.findByType(BankRateChart).props.model).toBe(model);
    expect(path(tree, 'bank-rate-background').props).toBe(background);
    expect(path(tree, 'bank-rate-selected-line').props.d).not.toBe(firstLine);
    expect(path(tree, 'bank-rate-selected-observations').props.d).not.toBe(firstMarkers);
    expect(historicalReads).toBe(reads);
    expect(tree.root.findAllByType(Path)).toHaveLength(3);
    expect(JSON.stringify(tree.toJSON())).toContain('Bank 1. Mean');
    const previous = tree.root.findAll(node => node.props.accessibilityLabel === 'Previous bank alphabetically' && typeof node.props.onPress === 'function')[0];
    act(() => { (previous.props.onPress as () => void)(); });
    expect(path(tree, 'bank-rate-selected-line').props.d).toBe(firstLine);
    expect(path(tree, 'bank-rate-selected-observations').props.d).toBe(firstMarkers);
    expect(historicalReads).toBe(reads);
  } finally { act(() => tree.unmount()); }
});

test.each(['bank', 'whole catalogue'])('missing %s observations break the line while isolated days retain visible markers', missing => {
  const model = fixture(1);
  model.lines[0].points.splice(2, 1);
  if (missing === 'whole catalogue') model.dates.splice(2, 1);
  const tree = mount(model);
  try {
    expect(String(path(tree, 'bank-rate-selected-line').props.d).match(/[ML]/g)).toEqual(['M', 'L', 'M']);
    expect(String(path(tree, 'bank-rate-selected-observations').props.d).match(/Z/g)).toHaveLength(3);
    expect(JSON.stringify(tree.toJSON())).toContain('3 observed days');
    expect(JSON.stringify(tree.toJSON())).not.toMatch(/NaN|Infinity/);
  } finally { act(() => tree.unmount()); }
});

test('a single-date fallback explicitly reports that earlier matching observations are unavailable', () => {
  const tree = mount(fixture(1, 1));
  try {
    expect(String(path(tree, 'bank-rate-selected-line').props.d).match(/[ML]/g)).toEqual(['M']);
    expect(String(path(tree, 'bank-rate-selected-observations').props.d).match(/Z/g)).toHaveLength(1);
    expect(JSON.stringify(tree.toJSON())).toContain('1 observed day');
    expect(JSON.stringify(tree.toJSON())).toContain('Earlier matching observations unavailable.');
    expect(JSON.stringify(tree.toJSON())).not.toMatch(/NaN|Infinity/);
  } finally { act(() => tree.unmount()); }
});
