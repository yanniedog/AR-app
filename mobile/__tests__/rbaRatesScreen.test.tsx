import React from 'react';
import { formatRunDate } from '../src/data/format';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import RbaRates from '../app/rba';
import type { RbaMarketOutlook } from '../src/data/rbaMarketOutlookTypes';
import type { PerformanceAuditSurfaceDefinition } from '../src/lib/performanceAuditReadiness';

type TestNode = {
  props: Record<string, unknown>;
  findByProps: (props: Record<string, unknown>) => TestNode;
  findAllByType: (type: string) => TestNode[];
};
type Renderer = ReactTestRenderer & { root: TestNode; toJSON: () => unknown };
const mockLoad = jest.fn();
const mockExternal = jest.fn();
const mockEnsureCalendar = jest.fn(async () => undefined);
let mockSurface: PerformanceAuditSurfaceDefinition;
const mockState: Record<string, unknown> = {};
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../src/data/store', () => ({ useStore: (select: (state: typeof mockState) => unknown) => select(mockState) }));
jest.mock('../src/data/rbaMarketOutlook', () => ({
  loadRbaMarketOutlook: (...args: unknown[]) => mockLoad(...args),
  RBA_F17_FORWARD_URL: 'https://www.rba.gov.au/statistics/tables/csv/f17-forward-rates.csv',
  RBA_J1_FORECAST_URL: 'https://www.rba.gov.au/statistics/tables/csv/j1-cash-rate.csv',
}));
jest.mock('../src/lib/yieldToUi', () => ({ yieldToPaintFrames: async () => undefined }));
jest.mock('../src/components/ExternalLinkConfirmation', () => ({ useTrustedExternalUrl: () => ({ requestExternalUrl: mockExternal }) }));
jest.mock('../src/components/charts', () => ({ RbaChart: 'RbaChart' }));
jest.mock('../src/components/rba/RateOutlookChart', () => ({ RateOutlookChart: 'RateOutlookChart' }));
jest.mock('../src/components/Screen', () => ({ ScreenScrollView: 'ScreenScrollView' }));
jest.mock('../src/components/ledger', () => ({ LedgerAction: 'LedgerAction', LedgerText: 'LedgerText', LedgerSection: 'LedgerSection' }));
jest.mock('../src/components/ui', () => ({ Disclosure: 'Disclosure' }));
jest.mock('../src/hooks/usePerformanceAuditReadiness', () => ({
  usePerformanceAuditSurface: (definition: PerformanceAuditSurfaceDefinition) => { mockSurface = definition; return {}; },
  usePerformanceAuditProbe: jest.fn(),
}));

// The public fixture's values are retained here to test presentation, never shipped as live data.
const outlook: RbaMarketOutlook = {
  schema_version: 1, fetchedAt: '2026-09-22T00:00:00Z', checkedAt: '2026-09-22T00:00:00Z', refreshStatus: 'current',
  economists: { surveyDate: '2026-08-01', publicationDate: '2026-08-28', points: [
    { date: '2026-06-01', value: 4.35 }, { date: '2026-12-01', value: 4.35 }, { date: '2027-06-01', value: 4.35 }, { date: '2027-12-01', value: 4.10 },
  ] },
  bondForwards: { observationDate: '2026-08-31', publicationDate: '2026-09-04', points: [
    { date: '2026-08-31', value: 4.35, horizonMonths: 0 }, { date: '2026-11-30', value: 4.57, horizonMonths: 3 },
  ] },
};
let tree: Renderer | undefined;
async function mount() {
  await act(async () => { tree = TestRenderer.create(<RbaRates />) as Renderer; });
  return tree!;
}
const text = () => JSON.stringify(tree!.toJSON());
const press = async (label: string) => act(async () => { (tree!.root.findByProps({ label }).props.onPress as () => void)(); });

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(Date.parse('2026-09-22T12:00:00Z'));
  jest.clearAllMocks();
  mockLoad.mockResolvedValue(outlook);
  Object.assign(mockState, {
    manifest: { files: { rba_calendar: { sha256: 'calendar-sha' } } },
    core: { run_date: '2026-09-22', rba: [{ date: '2026-08-12', rate: 4.35 }] },
    rbaCalendar: { timezone: 'Australia/Sydney', decisions: [{ date: '2026-08-11', effective: '2026-08-12', rate: 4.35, delta_bps: 25, outcome: 'hike' }], schedule: [{ date: '2026-09-29', announce_utc: '2026-09-29T04:30:00Z' }] },
    ensureRbaCalendar: mockEnsureCalendar,
  });
});
afterEach(() => { if (tree) act(() => tree!.unmount()); tree = undefined; jest.useRealTimers(); });

test('shows dated distinct sources, upcoming survey quarters and explicitly opens ASX outside the app', async () => {
  await mount();
  const graphs = tree!.root.findAllByType('RateOutlookChart');
  expect(graphs).toHaveLength(2);
  expect(graphs[0].props.points).toEqual(outlook.economists!.points.slice(1));
  expect(graphs[1].props.points).toEqual(outlook.bondForwards!.points);
  expect(graphs.every((graph) => graph.props.cashRate === 4.35)).toBe(true);
  expect(text()).toContain('29 Sep');
  expect(text()).toContain('Bond forwards include risk premiums');
  expect(text()).toContain('separate from market pricing');
  expect(text()).toContain(formatRunDate(outlook.bondForwards!.publicationDate));
  await press('View ASX market expectations');
  expect(mockExternal).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'official_market_source', url: expect.stringContaining('/rba-rate-tracker') }));
});

test('loads the decision calendar when a direct launch receives its catalogue after mounting', async () => {
  const core = mockState.core;
  const manifest = mockState.manifest;
  mockState.core = null;
  mockState.manifest = null;
  await mount();
  expect(mockEnsureCalendar).not.toHaveBeenCalled();
  mockState.core = core;
  mockState.manifest = manifest;
  await act(async () => { tree!.update(<RbaRates />); });
  expect(mockEnsureCalendar).toHaveBeenCalledTimes(1);
});

test('executes chart audit controls and preserves good graphs after a failed manual refresh', async () => {
  await mount();
  act(() => { mockSurface.actions!['rba.forecast.next'](); mockSurface.actions!['rba.bonds.next'](); });
  const graphs = tree!.root.findAllByType('RateOutlookChart');
  expect(graphs[0].props.selectedIndex).toBe(1);
  expect(graphs[1].props.selectedIndex).toBe(0);
  mockLoad.mockRejectedValueOnce(new Error('network unavailable'));
  await press('Refresh outlook');
  expect(mockLoad).toHaveBeenLastCalledWith(true);
  expect(tree!.root.findAllByType('RateOutlookChart')).toHaveLength(2);
  expect(text()).toContain('could not be refreshed');
});

test('uses explicit unavailable audit results when public data has never been cached', async () => {
  mockLoad.mockRejectedValue(new Error('not cached'));
  await mount();
  expect(tree!.root.findAllByType('RateOutlookChart')).toHaveLength(0);
  expect(mockSurface.actions!['rba.forecast.next']()).toEqual({ unavailableReason: expect.stringContaining('cached economist') });
  expect(mockSurface.actions!['rba.bonds.next']()).toEqual({ unavailableReason: expect.stringContaining('cached bond') });
  expect(text()).toContain('4.35%');
  expect(text()).toContain('No upcoming economist forecasts');
});

test('discloses an elapsed unrecorded decision rather than presenting the next meeting as current', async () => {
  jest.setSystemTime(Date.parse('2026-10-01T00:00:00Z'));
  await mount();
  expect(text()).toContain('Awaiting decision result');
  expect(text()).toContain('Last confirmed cash rate');
  expect(text()).toContain('29 Sep');
});

test('keeps original source dates visible for saved older data and never rolls its curve to today', async () => {
  jest.setSystemTime(Date.parse('2027-01-22T00:00:00Z'));
  mockLoad.mockResolvedValue({ ...outlook, refreshStatus: 'offline' });
  await mount();
  expect(text()).toContain('Saved data shown');
  expect(text()).toContain('Older survey');
  expect(text()).toContain('Older observation');
  const bonds = tree!.root.findAllByType('RateOutlookChart')[1];
  expect(bonds.props.points).toEqual(outlook.bondForwards!.points);
});
