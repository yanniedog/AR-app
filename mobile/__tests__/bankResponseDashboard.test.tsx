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

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
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
jest.mock('../src/data/store', () => ({ useStore: (selector: (s: { prefs: { interests: string[] } }) => unknown) => selector({ prefs: { interests: ['Mortgage'] } }) }));
jest.mock('../src/data/bankResponseModel', () => ({ buildCompactBankResponseWindows: () => mockWindows }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: { border: '#ccc', text: '#000' } }) }));
jest.mock('../src/components/BankAvatar', () => ({ BankAvatar: 'BankAvatar' }));
jest.mock('../src/components/controls', () => ({ SegmentedControl: 'SegmentedControl' }));
jest.mock('../src/components/Screen', () => ({ responsiveScreenContentStyle: () => ({}) }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Row: 'Row' }));
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
