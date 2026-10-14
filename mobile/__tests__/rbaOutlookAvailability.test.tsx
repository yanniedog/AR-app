import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { RbaOutlook, type RbaOutlookAuditHandle, type RbaOutlookAuditState } from '../src/components/RbaOutlook';
import { EconomicOutlookUnavailableError, loadEconomicOutlook } from '../src/data/economicOutlook';

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useFocusEffect: (callback: () => (() => void)) => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(callback, [callback]);
  },
}));
jest.mock('../src/data/economicOutlook', () => ({
  ...jest.requireActual('../src/data/economicOutlook'), loadEconomicOutlook: jest.fn(),
}));
jest.mock('../src/lib/debugLog', () => ({ debugLog: { warn: jest.fn() } }));
jest.mock('../src/components/economy', () => ({ EconomicExplorer: 'EconomicExplorer', EconomicReleasesList: 'EconomicReleasesList' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Row: 'Row' }));
jest.mock('../src/components/ExternalLinkConfirmation', () => ({
  useTrustedExternalUrl: () => ({ requestExternalUrl: jest.fn() }),
}));
jest.mock('../src/lib/yieldToUi', () => ({ yieldToPaintFrames: jest.fn(async () => undefined) }));

type TestNode = { type: unknown; props: Record<string, any>; findAll: (predicate: (node: TestNode) => boolean) => TestNode[] };
type InspectableRenderer = ReturnType<typeof TestRenderer.create> & { root: TestNode };

test.each([new EconomicOutlookUnavailableError(), new Error('offline')])(
  'an unavailable source requires actual positive empty-state layout before terminal audit evidence: %s', async (error) => {
    jest.mocked(loadEconomicOutlook).mockRejectedValue(error);
    const states: RbaOutlookAuditState[] = [];
    let tree!: InspectableRenderer;
    await act(async () => { tree = TestRenderer.create(<RbaOutlook rba={[]} onAuditStateChange={state => states.push(state)} />) as InspectableRenderer; });
    try {
      expect(states.at(-1)).toMatchObject({ status: 'pending', layoutMeasured: false, emptyStateRendered: false });
      const empty = tree.root.findAll(node => typeof node.props.children === 'string' &&
        node.props.children === 'Economy · Unavailable')[0];
      act(() => empty.props.onLayout({ nativeEvent: { layout: { width: 0, height: 20 } } }));
      expect(states.at(-1)?.status).toBe('pending');
      act(() => empty.props.onLayout({ nativeEvent: { layout: { width: 300, height: 40 } } }));
      expect(states.at(-1)).toMatchObject({ status: 'error', indicatorCount: 0, pointCount: 0, expectedCount: 0,
        graphicReady: true, layoutMeasured: true, emptyStateRendered: true, accessibleSummary: true });
      if (error instanceof EconomicOutlookUnavailableError) expect(states.at(-1)?.error).toBe(error.message);
      let finishRetry!: () => void;
      jest.mocked(loadEconomicOutlook).mockImplementation(() => new Promise((_resolve, reject) => {
        finishRetry = () => reject(error);
      }));
      act(() => tree.root.findAll(node => node.props.title === 'Retry')[0].props.onPress());
      expect(states.at(-1)).toMatchObject({ status: 'pending', layoutMeasured: false, emptyStateRendered: false });
      // Unmounting cancels UI updates; settle the request so the test owns no pending work.
      act(() => tree.unmount());
      await act(async () => finishRetry());
    } finally { act(() => tree.unmount()); }
  },
);

test('cached economic lens, window and date changes require graphic evidence for the actual new render', async () => {
  const checkedAt = '2026-10-12T00:00:00.000Z';
  jest.mocked(loadEconomicOutlook).mockResolvedValue({
    schema_version: 2, fetchedAt: checkedAt, checkedAt, refreshStatus: 'offline',
    indicators: [{ id: 'underlying_inflation', label: 'Underlying inflation', shortLabel: 'Trimmed mean',
      publicationDate: '2026-10-01', points: [{ date: '2026-06-30', value: 3.1 }, { date: '2026-09-30', value: 3.0 }],
      signal: { direction: 'balanced', label: 'Inside band', explanation: 'Cached observations' } }],
    cashRateForecast: null,
  });
  const states: RbaOutlookAuditState[] = [];
  const handle = React.createRef<RbaOutlookAuditHandle>();
  let tree!: InspectableRenderer;
  await act(async () => { tree = TestRenderer.create(<RbaOutlook ref={handle} rba={[]}
    onAuditStateChange={state => states.push(state)} />) as InspectableRenderer; });
  try {
    const chart = () => tree.root.findAll(node => node.type === 'EconomicExplorer')[0];
    const proveGraphic = (revision: string) => act(() => chart().props.onGraphicReady({
      revision, expectedCount: 2, pointCount: 2, layoutMeasured: true, accessibleSummary: true, emptyStateRendered: false,
    }));
    act(() => tree.root.findAll(node => node.props.style?.marginBottom === 8 && node.props.onLayout)[0]
      .props.onLayout({ nativeEvent: { layout: { width: 320, height: 180 } } }));
    proveGraphic(states.at(-1)!.renderRevision!);
    expect(states.at(-1)?.status).toBe('ready');
    for (const action of ['nextLens', 'nextWindow', 'previousDate'] as const) {
      const before = states.at(-1)!.renderRevision!;
      act(() => handle.current![action]());
      const next = states.at(-1)!.renderRevision!;
      expect(next).not.toBe(before);
      expect(states.at(-1)).toMatchObject({ status: 'pending', graphicReady: false, revision: checkedAt });
      // A stale chart callback cannot certify the newly selected economic view.
      proveGraphic(before);
      expect(states.at(-1)?.status).toBe('pending');
      proveGraphic(next);
      expect(states.at(-1)).toMatchObject({ status: 'ready', renderRevision: next, graphicReady: true });
    }
  } finally { act(() => tree.unmount()); }
});
