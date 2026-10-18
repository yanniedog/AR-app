import React from 'react';
import { View } from 'react-native';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import Svg from 'react-native-svg';

import RbaRates from '../app/rba';
import { RateOutlookChart } from '../src/components/rba/RateOutlookChart';
import type { RbaMarketOutlook } from '../src/data/rbaMarketOutlookTypes';
import { PerformanceAuditReadinessProvider } from '../src/hooks/usePerformanceAuditReadiness';
import { PerformanceAuditReadinessRegistry } from '../src/lib/performanceAuditReadiness';

type TestNode = {
  props: Record<string, unknown>;
  findAll: (predicate: (node: TestNode) => boolean) => TestNode[];
  findAllByType: (type: React.ElementType | string) => TestNode[];
};
type Renderer = ReactTestRenderer & { root: TestNode };
const mockLoad = jest.fn();
const mockState = {
  core: { run_date: '2026-09-22', rba: [{ date: '2026-08-12', rate: 4.35 }] },
  rbaCalendar: null,
  manifest: null,
  ensureRbaCalendar: jest.fn(async () => undefined),
};
let mockCacheReset: () => void;
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../src/data/store', () => ({ useStore: (select: (state: typeof mockState) => unknown) => select(mockState) }));
jest.mock('../src/data/rbaMarketOutlook', () => ({
  loadRbaMarketOutlook: (...args: unknown[]) => mockLoad(...args),
  subscribeRbaMarketOutlookCacheReset: (listener: () => void) => { mockCacheReset = listener; return jest.fn(); },
  RBA_F17_FORWARD_URL: 'https://www.rba.gov.au/statistics/tables/csv/f17-forward-rates.csv',
  RBA_J1_FORECAST_URL: 'https://www.rba.gov.au/statistics/tables/csv/j1-cash-rate.csv',
}));
jest.mock('../src/lib/yieldToUi', () => ({ yieldToPaintFrames: async () => undefined }));
jest.mock('../src/hooks/useAuditExternalLinks', () => ({ useAuditExternalLinks: jest.fn() }));
jest.mock('../src/components/ExternalLinkConfirmation', () => ({ useTrustedExternalUrl: () => ({ requestExternalUrl: jest.fn() }) }));
jest.mock('../src/components/charts', () => ({ RbaChart: 'RbaChart' }));
jest.mock('../src/components/Screen', () => ({ ScreenScrollView: 'ScreenScrollView' }));
jest.mock('../src/components/ledger', () => ({ LedgerAction: 'LedgerAction', LedgerText: 'LedgerText', LedgerSection: 'LedgerSection' }));
jest.mock('../src/components/ui', () => ({ Disclosure: 'Disclosure' }));
jest.mock('../src/components/settings/settingsUi', () => ({ InfoRow: 'InfoRow' }));

const outlook: RbaMarketOutlook = {
  schema_version: 1, fetchedAt: '2026-09-22T00:00:00Z', checkedAt: '2026-09-22T00:00:00Z', refreshStatus: 'current',
  economists: { surveyDate: '2026-08-01', publicationDate: '2026-08-28', points: [
    { date: '2026-12-01', value: 4.35 }, { date: '2027-06-01', value: 4.10 },
  ] },
  bondForwards: { observationDate: '2026-08-31', publicationDate: '2026-09-04', points: [
    { date: '2026-08-31', value: 4.35, horizonMonths: 0 }, { date: '2026-11-30', value: 4.57, horizonMonths: 3 },
  ] },
};
let tree: Renderer | undefined;
let registry: PerformanceAuditReadinessRegistry;
const event = (width = 360, height = 220) => ({ nativeEvent: { layout: { width, height } } });
const graphics = () => registry.snapshot(['rba.dashboard'], undefined, ['graphic']);
const probe = (kind: 'forecast' | 'bonds') => graphics().surfaces[0].probes.find((item) => item.id === `rba.${kind}.chart`)!;
const chart = (kind: 'forecast' | 'bonds') => tree!.root.findAllByType(RateOutlookChart)[kind === 'forecast' ? 0 : 1];
function nativeLayout(node: TestNode, width = 360, height = 220) {
  act(() => (node.props.onLayout as (value: ReturnType<typeof event>) => void)(event(width, height)));
}
function measureChart(kind: 'forecast' | 'bonds') {
  nativeLayout(chart(kind).findAll((node) => node.props.accessibilityRole === 'image' && typeof node.props.onLayout === 'function')[0]);
  nativeLayout(chart(kind).findAllByType(Svg)[0]);
}
function measureEmpty(label: 'Loading' | 'Forecast unavailable' | 'Bond data unavailable', width = 360) {
  for (const node of tree!.root.findAllByType('LedgerText').filter((item) => item.props.children === label)) nativeLayout(node, width);
}
async function mount() {
  registry = new PerformanceAuditReadinessRegistry();
  registry.beginCapture('rba-real-chart-layout');
  await act(async () => {
    tree = TestRenderer.create(<PerformanceAuditReadinessProvider registry={registry}><RbaRates /></PerformanceAuditReadinessProvider>) as Renderer;
  });
  nativeLayout(tree!.root.findAllByType(View).find((node) => (node.props.style as { gap?: number })?.gap === 28)!);
}
async function action(name: 'rba.open' | 'rba.forecast.next' | 'rba.bonds.next') {
  let result: unknown;
  await act(async () => { result = await registry.invokeAction('rba.dashboard', name); });
  return result;
}
async function refresh() {
  await act(async () => {
    const button = tree!.root.findAllByType('LedgerAction').find((node) => node.props.label === 'Refresh outlook')!;
    (button.props.onPress as () => void)();
  });
}
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(Date.parse('2026-09-22T12:00:00Z'));
  jest.clearAllMocks();
  mockLoad.mockResolvedValue(outlook);
});
afterEach(() => {
  if (tree) act(() => tree!.unmount());
  tree = undefined;
  jest.useRealTimers();
});

test('single-point charts provide real SVG evidence without fabricating an unavailable cycling action', async () => {
  mockLoad.mockResolvedValue({ ...outlook,
    economists: { ...outlook.economists!, points: outlook.economists!.points.slice(0, 1) },
    bondForwards: { ...outlook.bondForwards!, points: outlook.bondForwards!.points.slice(0, 1) },
  });
  await mount();
  await action('rba.open');
  expect(graphics().ready).toBe(false);
  expect(registry.snapshot(['rba.dashboard']).ready).toBe(false);
  measureChart('forecast');
  measureChart('bonds');
  expect(graphics().ready).toBe(true);
  expect(registry.snapshot(['rba.dashboard']).ready).toBe(true);
  for (const kind of ['forecast', 'bonds'] as const) {
    expect(probe(kind)).toMatchObject({ status: 'ready', expectedCount: 1, actualCount: 1, layoutMeasured: true, accessibleSummary: true, emptyStateRendered: false });
  }
  expect(await action('rba.forecast.next')).toEqual({ unavailableReason: expect.stringContaining('two cached economist') });
  expect(await action('rba.bonds.next')).toEqual({ unavailableReason: expect.stringContaining('two cached bond') });
  expect(graphics().surfaces[0].lastCompletedAction).toBe('rba.open');
  expect(graphics().ready).toBe(true);
});

test('switching real multipoint charts requires current SVG layout and rejects old native callbacks', async () => {
  await mount();
  measureChart('forecast');
  measureChart('bonds');
  const oldForecastLayout = chart('forecast').findAllByType(Svg)[0].props.onLayout as (value: ReturnType<typeof event>) => void;
  expect(graphics().ready).toBe(true);
  await action('rba.forecast.next');
  expect(chart('forecast').props.selectedIndex).toBe(1);
  expect(probe('forecast').status).toBe('pending');
  act(() => oldForecastLayout(event()));
  expect(probe('forecast').status).toBe('pending');
  expect(probe('bonds').status).toBe('ready');
  measureChart('forecast');
  act(() => oldForecastLayout(event(0, 0)));
  expect(graphics().ready).toBe(true);
  await action('rba.bonds.next');
  expect(chart('bonds').props.selectedIndex).toBe(0);
  expect(probe('bonds').status).toBe('pending');
  expect(probe('forecast').status).toBe('ready');
  measureChart('bonds');
  await action('rba.open');
  expect(graphics().ready).toBe(true);
  // Returning to the same selected point is still a new native chart instance.
  await action('rba.forecast.next');
  expect(chart('forecast').props.selectedIndex).toBe(0);
  act(() => oldForecastLayout(event()));
  expect(probe('forecast').status).toBe('pending');
  measureChart('forecast');
  expect(graphics().ready).toBe(true);
});

test('loading cannot certify an empty chart; an actual unavailable placeholder requires positive native layout', async () => {
  let resolve!: (value: RbaMarketOutlook) => void;
  mockLoad.mockReturnValueOnce(new Promise<RbaMarketOutlook>((accept) => { resolve = accept; }));
  await mount();
  measureEmpty('Loading');
  expect(graphics().ready).toBe(false);
  expect(probe('forecast')).toMatchObject({ status: 'pending', layoutMeasured: false, emptyStateRendered: false });
  await act(async () => { resolve({ ...outlook, economists: null, bondForwards: null }); });
  expect(graphics().ready).toBe(false);
  measureEmpty('Forecast unavailable', 0);
  measureEmpty('Bond data unavailable', 0);
  expect(graphics().ready).toBe(false);
  measureEmpty('Forecast unavailable');
  measureEmpty('Bond data unavailable');
  expect(graphics().ready).toBe(true);
  for (const kind of ['forecast', 'bonds'] as const) {
    expect(probe(kind)).toMatchObject({ status: 'ready', actualCount: 0, expectedCount: 0, emptyStateRendered: true, accessibleSummary: false });
  }
  expect(await action('rba.forecast.next')).toEqual({ unavailableReason: expect.any(String) });
  expect(await action('rba.bonds.next')).toEqual({ unavailableReason: expect.any(String) });
});

test('failed uncached source remains unavailable while its genuinely rendered empty states are measurable', async () => {
  mockLoad.mockRejectedValueOnce(new Error('offline without cache'));
  await mount();
  expect(tree!.root.findAllByType(RateOutlookChart)).toHaveLength(0);
  expect(graphics().ready).toBe(false);
  measureEmpty('Forecast unavailable');
  measureEmpty('Bond data unavailable');
  expect(graphics().ready).toBe(true);
  expect(await action('rba.forecast.next')).toEqual({ unavailableReason: expect.any(String) });
  expect(probe('forecast').actualCount).toBe(0);
});

test('unchanged cached charts retain actual SVG proof across refresh without borrowing proof for new content', async () => {
  await mount();
  measureChart('forecast');
  measureChart('bonds');
  const oldLayout = chart('forecast').findAllByType(Svg)[0].props.onLayout as (value: ReturnType<typeof event>) => void;
  mockLoad.mockResolvedValueOnce({ ...outlook, checkedAt: '2026-09-22T13:00:00Z' });
  await refresh();
  expect(graphics().ready).toBe(true);
  mockLoad.mockResolvedValueOnce({ ...outlook, checkedAt: '2026-09-22T14:00:00Z',
    economists: { ...outlook.economists!, points: [{ date: '2027-01-01', value: 4.25 }] },
  });
  await refresh();
  expect(probe('forecast').status).toBe('pending');
  act(() => oldLayout(event()));
  expect(probe('forecast').status).toBe('pending');
  measureChart('forecast');
  expect(graphics().ready).toBe(true);
  expect(probe('forecast')).toMatchObject({ expectedCount: 1, actualCount: 1 });
});

test('clearing cached charts invalidates old callbacks and requires newly rendered absent-state evidence', async () => {
  await mount();
  measureChart('forecast');
  measureChart('bonds');
  const oldLayout = chart('forecast').findAllByType(Svg)[0].props.onLayout as (value: ReturnType<typeof event>) => void;
  act(() => mockCacheReset());
  act(() => oldLayout(event()));
  expect(probe('forecast')).toMatchObject({ status: 'pending', actualCount: 0, expectedCount: 0 });
  measureEmpty('Forecast unavailable');
  measureEmpty('Bond data unavailable');
  expect(graphics().ready).toBe(true);
  expect(await action('rba.forecast.next')).toEqual({ unavailableReason: expect.any(String) });
});

test('invalid expected source points cannot be certified by the chart’s no-observations state', async () => {
  mockLoad.mockResolvedValueOnce({ ...outlook, economists: { ...outlook.economists!, points: [{ date: '2026-12-01', value: NaN }] } });
  await mount();
  const empty = chart('forecast').findAllByType('LedgerText').find((node) => node.props.children === 'No observations')!;
  nativeLayout(empty);
  measureChart('bonds');
  expect(probe('forecast')).toMatchObject({ status: 'pending', expectedCount: 1, actualCount: 0 });
  expect(graphics().ready).toBe(false);
});
