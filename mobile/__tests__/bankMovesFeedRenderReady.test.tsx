import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { BankMovesFeed } from '../src/components/BankInsights';
import type { BankInsightsPayload } from '../src/data/bankInsights';

jest.mock('../src/components/ui', () => ({
  AppText: ({ children, onLayout, ...props }: {
    children?: React.ReactNode;
    onLayout?: () => void;
  }) => {
    const ReactRuntime = jest.requireActual<typeof React>('react');
    ReactRuntime.useEffect(() => {
      onLayout?.();
    }, [onLayout]);
    return ReactRuntime.createElement('AppText', props, children);
  },
  Badge: 'Badge',
  Divider: 'Divider',
  Row: 'Row',
}));

const emptyPayload: BankInsightsPayload = {
  schema_version: 1,
  run_date: '2026-09-03',
  run_dates: ['2026-09-03'],
  banks: {},
  events: [],
};

describe('BankMovesFeed render evidence', () => {
  it('re-emits empty-feed evidence when the content revision changes', () => {
    const onRenderEvidence = jest.fn();
    let tree!: ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <BankMovesFeed
          payload={emptyPayload}
          contentRevision="revision-1"
          onRenderEvidence={onRenderEvidence}
        />,
      );
    });
    expect(onRenderEvidence).toHaveBeenCalledTimes(1);
    expect(onRenderEvidence).toHaveBeenLastCalledWith({
      expectedCount: 0,
      actualCount: 0,
      emptyStateRendered: true,
    });

    act(() => {
      tree.update(
        <BankMovesFeed
          payload={emptyPayload}
          contentRevision="revision-2"
          onRenderEvidence={onRenderEvidence}
        />,
      );
    });
    expect(onRenderEvidence).toHaveBeenCalledTimes(2);
    act(() => tree.unmount());
  });
});
