import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { RbaOutlook, type RbaOutlookAuditState } from '../src/components/RbaOutlook';
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

type TestNode = { props: Record<string, any>; findAll: (predicate: (node: TestNode) => boolean) => TestNode[] };
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
        node.props.children.startsWith('Economic signals are unavailable'))[0];
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
