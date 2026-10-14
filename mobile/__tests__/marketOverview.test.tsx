import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import Market from '../src/components/market/MarketOverview';
import { DEFAULT_PREFS } from '../src/data/storeTypes';
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
