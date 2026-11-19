import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { BankResponseDashboard } from '../src/components/passthrough/BankResponseDashboard';
import type { CompactBankResponseRow, CompactBankResponseWindow } from '../src/data/bankResponseModel';
import type { BankResponseReason } from '../src/data/bankResponseEvidence';
import { uiLabel } from '../src/lib/uiCopy';

type TestNode = { props: Record<string, unknown> };
type Renderer = ReactTestRenderer & { root: { findAllByType: (type: unknown) => TestNode[] } };

const mockWindows: CompactBankResponseWindow[] = [{
  decision: { date: '2026-08-12', delta_bps: -25, rate: 0.036, outcome: 'cut' } as any,
  observationStart: '2026-08-01',
  observedThrough: '2026-08-19',
  windowEnd: '2026-08-19',
  open: false,
  partialHistory: false,
  rows: (['no-recorded-move', 'filtered-history', 'history-gap', 'missing-baseline'] as BankResponseReason[]).map((reason, index) => ({
    provider: `Bank ${index}`,
    movePp: null,
    daysAfter: null,
    direction: null,
    evidence: {
      reason,
      observedDays: reason === 'history-gap' ? 6 : 8,
      missingDays: reason === 'history-gap' ? 2 : 0,
      baselineAvailable: reason !== 'missing-baseline',
      firstMoveVerified: false,
    },
  })) satisfies CompactBankResponseRow[],
}];

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock('@shopify/flash-list', () => {
  const mockReact = jest.requireActual('react');
  return {
    FlashList: ({ data, renderItem, ListHeaderComponent }: any) => mockReact.createElement(
      'FlashList',
      { data },
      ListHeaderComponent,
      ...(data ?? []).map((item: any) => mockReact.createElement(mockReact.Fragment, { key: item.provider }, renderItem({ item }))),
    ),
  };
});
let mockSaved = new Set<string>();
jest.mock('../src/data/store', () => ({ useStore: (selector: (s: { prefs: { interests: string[] } }) => unknown) => selector({ prefs: { interests: ['Mortgage'] } }) }));
jest.mock('../src/hooks/useSavedProviders', () => ({ useSavedProviders: () => mockSaved }));
jest.mock('../src/data/bankResponseModel', () => ({
  ...jest.requireActual('../src/data/bankResponseModel'),
  buildCompactBankResponseWindows: () => mockWindows,
}));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: { border: '#ccc', text: '#000' } }) }));
jest.mock('../src/components/BankAvatar', () => ({ BankAvatar: 'BankAvatar' }));
jest.mock('../src/components/controls', () => ({ SegmentedControl: 'SegmentedControl', SearchBar: 'SearchBar' }));
jest.mock('../src/components/Screen', () => ({ responsiveScreenContentStyle: () => ({}) }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Badge: 'Badge', Button: 'Button', Row: 'Row' }));
jest.mock('../src/components/icons/AppIcon', () => 'Ionicons');
jest.mock('../src/hooks/usePerformanceAuditReadiness', () => ({
  usePerformanceAuditSurface: () => null,
  usePerformanceAuditProbe: jest.fn(),
}));

it('renders distinct structured statuses visibly when a bank has no observed move', () => {
  const payload = { run_date: '2026-08-20', run_dates: [], banks: {}, events: [] } as any;
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(<BankResponseDashboard payload={payload} calendar={null} />) as Renderer; });
  const textValues = tree.root.findAllByType('AppText').map(node => node.props.children);
  try {
    expect(textValues).toContain(uiLabel('No recorded move'));
    expect(textValues).toContain(uiLabel('Filtered history'));
    expect(textValues).toContain(uiLabel('History gaps'));
    expect(textValues).toContain(uiLabel('Baseline unavailable'));
  } finally {
    act(() => tree.unmount());
  }
});

const movedRow = (provider: string, movePp: number, verified = true): CompactBankResponseRow => ({
  provider, movePp, daysAfter: 2, direction: movePp < 0 ? 'cut' : 'hike',
  evidence: { reason: 'recorded-move', observedDays: 8, missingDays: 0, baselineAvailable: true, firstMoveVerified: verified },
});

describe('bank list', () => {
  const original = mockWindows[0].rows;
  beforeEach(() => {
    mockPush.mockClear();
    mockWindows[0].rows = [movedRow('Alpha', -0.25), movedRow('Beta', -0.15, false), movedRow('Gamma', -0.25)];
  });
  afterEach(() => { mockWindows[0].rows = original; mockSaved = new Set(); });
  const render = () => {
    let tree!: Renderer;
    act(() => { tree = TestRenderer.create(<BankResponseDashboard payload={{ run_date: '2026-08-20', run_dates: [], banks: {}, events: [] } as any} calendar={null} />) as Renderer; });
    return tree;
  };
  const rows = (tree: Renderer) => (tree.root as any).findAll((node: any) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function' && node.props.style?.minHeight === 64);

  it('puts saved banks first, filters by search and shows pass-through status chips', () => {
    mockSaved = new Set(['Gamma']);
    const tree = render();
    try {
      expect(rows(tree).map((row: any) => row.props.accessibilityLabel)).toEqual([
        expect.stringContaining('Gamma'), expect.stringContaining('Alpha'), expect.stringContaining('Beta'),
      ]);
      const badges = tree.root.findAllByType('Badge').map(node => node.props.label);
      expect(badges).toEqual([uiLabel('Full'), uiLabel('Full'), uiLabel('Partial'), uiLabel('Unverified')]);
      act(() => { (tree.root.findAllByType('SearchBar')[0].props.onChangeText as (text: string) => void)('bet'); });
      expect(rows(tree)).toHaveLength(1);
      expect(rows(tree)[0].props.accessibilityLabel).toContain('Beta');
    } finally { act(() => tree.unmount()); }
  });

  it('opens the bank at its first move date', () => {
    const tree = render();
    try {
      act(() => rows(tree)[0].props.onPress());
      expect(mockPush).toHaveBeenCalledWith({ pathname: '/bank/[provider]', params: { provider: 'Alpha', date: '2026-08-14', section: 'Mortgage' } });
    } finally { act(() => tree.unmount()); }
  });
});
