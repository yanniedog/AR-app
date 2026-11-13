import React from 'react';
import * as bankData from '../src/data/bankInsights';
import * as navigationReady from '../src/hooks/useNavigationContentReady';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import Market from '../src/components/market/MarketOverview';
import { DEFAULT_PREFS } from '../src/data/storeTypes';
import { View } from 'react-native';
import { PerformanceAuditReadinessRegistry } from '../src/lib/performanceAuditReadiness';
let mockState: any;
const mockSurfaces = new Map<string, any>();
jest.mock('../src/data/store', () => ({ useStore: (selector: any) => selector(mockState) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useLocalSearchParams: () => ({}) }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => jest.requireActual('../src/theme/theme').lightTheme }));
jest.mock('../src/hooks/useSuitabilityRevision', () => ({ useSuitabilityRevision: () => 0 }));
jest.mock('../src/hooks/usePerformanceAuditReadiness', () => ({ usePerformanceAuditSurface: (surface: any) => mockSurfaces.set(surface.id, surface) }));
jest.mock('../src/components/BankInsights', () => ({ BankMovesFeed: 'BankMovesFeed', MoversLeaderboard: 'MoversLeaderboard' }));
jest.mock('../src/components/Screen', () => ({ ScreenScrollView: 'ScreenScrollView' }));
jest.mock('../src/components/controls', () => ({ SegmentedControl: 'SegmentedControl' }));
jest.mock('../src/components/feedback', () => ({ ScreenSkeleton: 'ScreenSkeleton' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Disclosure: 'Disclosure', SectionHeading: 'SectionHeading' }));
beforeEach(() => {
  mockSurfaces.clear(); mockState = { core: { run_date: '2026-10-14', rba: [{ date: '2026-09-01', rate: 4.1 }], sections: { Mortgage: { rates: [] }, Savings: { rates: [] }, TD: { rates: [] } } },
    prefs: { ...DEFAULT_PREFS, includeNonStandard: true }, source: 'cache', offline: true, bankInsights: null, bankInsightsError: 'Offline',
    rbaCalendar: null, rbaCalendarError: 'Offline', ensureBankInsights: jest.fn(async () => undefined), ensureRbaCalendar: jest.fn(async () => undefined) };
});
test('a cached history fallback is dated and qualified, never an unqualified current rate', async () => {
  let tree: any; await act(async () => { tree = TestRenderer.create(<Market />); });
  try {
    const text = tree.root.findAllByType('AppText').map((node: any) => String(node.props.children)).join(' ');
    expect(text).toContain('Last confirmed cash rate'); expect(text).toContain('4.10%'); expect(text).toContain('2026'); expect(text).toContain('Cached');
    expect(mockSurfaces.get('market.overview').probes.find((probe: any) => probe.id === 'market.calendar').status).toBe('error');
    const screen = tree.root.findByType('ScreenScrollView');
    act(() => screen.props.onLayout({ nativeEvent: { layout: { width: 0, height: 0 } } }));
    expect(mockSurfaces.get('market.overview').probes.find((probe: any) => probe.id === 'market.layout').status).toBe('pending');
    act(() => screen.props.onLayout({ nativeEvent: { layout: { width: 360, height: 500 } } }));
    expect(mockSurfaces.get('market.overview').probes.find((probe: any) => probe.id === 'market.layout').status).toBe('ready');
  } finally { act(() => tree.unmount()); }
});

function readyCalendarState(coreSha: string | null = 'a'.repeat(64)) {
  mockState.manifest = { files: { core: { sha256: coreSha }, rba_calendar: { sha256: 'b'.repeat(64) } } };
  mockState.rbaCalendar = { timezone: 'Australia/Sydney', decisions: [], schedule: [] };
  mockState.rbaCalendarError = null;
  mockState.bankInsights = { schema_version: 1, run_date: '2026-10-14', run_dates: ['2026-10-14'], banks: {}, events: [] };
  mockState.bankInsightsError = null;
}

type MarketTestNode = { props: {
  onLayout?: (event: { nativeEvent: { layout: { width: number; height: number } } }) => void;
  value?: unknown;
  onRenderEvidence?: (evidence: { expectedCount: number; actualCount: number; emptyStateRendered: boolean }) => void;
} };
// The local renderer declaration omits root; describe only this fixture's API.
type MarketTestRenderer = ReactTestRenderer & { root: {
  findByType(type: unknown): MarketTestNode;
  findAllByType(type: unknown): MarketTestNode[];
} };

function measureMarket(tree: MarketTestRenderer) {
  const event = { nativeEvent: { layout: { width: 360, height: 500 } } };
  act(() => {
    tree.root.findByType('ScreenScrollView').props.onLayout?.(event);
    tree.root.findAllByType(View).filter(node => typeof node.props.onLayout === 'function')
      .forEach(node => node.props.onLayout?.(event));
  });
}

test.each(['a'.repeat(64), null])('calendar data uses publication identity for the real pre-action wait (%s)', async coreSha => {
  readyCalendarState(coreSha);
  let tree: MarketTestRenderer;
  await act(async () => { tree = TestRenderer.create(<Market />) as MarketTestRenderer; });
  const registry = new PerformanceAuditReadinessRegistry();
  const capture = registry.beginCapture('market-calendar-pre-action');
  try {
    measureMarket(tree!);
    const definition = mockSurfaces.get('market.overview');
    registry.registerSurface(definition);
    const snapshot = await registry.waitForReady({ surfaceIds: ['market.overview'], onlyKinds: ['data', 'layout'], quietWindowMs: 0, timeoutMs: 25 });
    const calendar = snapshot.surfaces[0].probes.find(probe => probe.id === 'market.calendar');
    expect(calendar).toMatchObject({ required: true, status: 'ready', datasetRevision: coreSha ?? '2026-10-14' });
    expect(snapshot.ready).toBe(true);
    expect(snapshot.blockers).toEqual([]);
    const before = tree!.root.findByType('SegmentedControl').props.value;
    await act(async () => { await registry.invokeAction('market.overview', 'changes.section.next'); });
    expect(tree!.root.findByType('SegmentedControl').props.value).not.toBe(before);
    expect(registry.snapshot().surfaces[0]).toMatchObject({ lastCompletedAction: 'changes.section.next', actionRevision: 1 });
  } finally { registry.endCapture(capture); act(() => tree!.unmount()); }
});

test('a changed calendar asset invalidates facts layout even with unchanged publication and values', async () => {
  readyCalendarState();
  let tree: MarketTestRenderer;
  await act(async () => { tree = TestRenderer.create(<Market />) as MarketTestRenderer; });
  try {
    measureMarket(tree!);
    const original = mockSurfaces.get('market.overview');
    expect(original.probes.find((probe: any) => probe.id === 'market.facts.layout').status).toBe('ready');
    mockState.manifest = { files: { ...mockState.manifest.files, rba_calendar: { sha256: 'c'.repeat(64) } } };
    await act(async () => { tree!.update(<Market />); });
    const changed = mockSurfaces.get('market.overview');
    expect(changed.datasetRevision).toBe(original.datasetRevision);
    expect(changed.renderRevision).not.toBe(original.renderRevision);
    expect(changed.probes.find((probe: any) => probe.id === 'market.facts.layout').status).toBe('pending');
    measureMarket(tree!);
    expect(mockSurfaces.get('market.overview').probes.find((probe: any) => probe.id === 'market.facts.layout').status).toBe('ready');
  } finally { act(() => tree!.unmount()); }
});

test('late old facts layout cannot erase the current calendar layout', async () => {
  readyCalendarState(); let tree: MarketTestRenderer;
  await act(async () => { tree = TestRenderer.create(<Market />) as MarketTestRenderer; });
  try {
    const old = tree!.root.findAllByType(View).find(node => typeof node.props.onLayout === 'function')!.props.onLayout!;
    measureMarket(tree!);
    mockState.manifest = { files: { ...mockState.manifest.files, rba_calendar: { sha256: 'e'.repeat(64) } } };
    await act(async () => tree!.update(<Market />)); measureMarket(tree!);
    act(() => old({ nativeEvent: { layout: { width: 360, height: 500 } } }));
    expect(mockSurfaces.get('market.overview').probes.find((probe: any) => probe.id === 'market.facts.layout').status).toBe('ready');
  } finally { act(() => tree!.unmount()); }
});

test('late old feed callbacks cannot erase current section render evidence', async () => {
  readyCalendarState();
  const ready = jest.spyOn(navigationReady, 'useNavigationContentReady').mockReturnValue(true);
  const projection = jest.spyOn(bankData, 'filterBankInsightsForSuitability').mockImplementation(payload => payload ?? null);
  let tree!: MarketTestRenderer;
  await act(async () => { tree = TestRenderer.create(<Market />) as MarketTestRenderer; });
  const evidence = { expectedCount: 0, actualCount: 0, emptyStateRendered: true };
  const probe = () => mockSurfaces.get('market.overview').probes.find((item: any) => item.id === 'market.movements.list');
  try {
    const old = tree.root.findByType('BankMovesFeed').props.onRenderEvidence!;
    act(() => old(evidence)); expect(probe().status).toBe('ready');
    act(() => mockSurfaces.get('market.overview').actions['changes.section.next']());
    expect(probe().status).toBe('pending');
    act(() => tree.root.findByType('BankMovesFeed').props.onRenderEvidence!(evidence));
    expect(probe().status).toBe('ready');
    act(() => old(evidence)); expect(probe().status).toBe('ready');
  } finally { act(() => tree.unmount()); ready.mockRestore(); projection.mockRestore(); }
});
