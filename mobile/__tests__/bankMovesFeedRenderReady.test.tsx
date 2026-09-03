import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { BankMovesFeed } from '../src/components/BankInsights';
import type { BankInsightsPayload } from '../src/data/bankInsights';

jest.mock('../src/components/ui', () => ({
  AppText: ({ children, ...props }: {
    children?: React.ReactNode;
  }) => {
    const ReactRuntime = jest.requireActual<typeof React>('react');
    return ReactRuntime.createElement('AppText', props, children);
  },
  Badge: 'Badge',
  Divider: 'Divider',
  Row: 'Row',
}));

jest.mock('../src/components/BankAvatar', () => ({ BankAvatar: 'BankAvatar' }));
jest.mock('../src/components/icons/AppIcon', () => 'AppIcon');
jest.mock('../src/lib/nav', () => ({ openBank: jest.fn() }));
jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      danger: '#b00020',
      success: '#006b54',
      textMuted: '#666666',
      primary: '#005ea8',
    },
  }),
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

  it('reports every committed non-empty row after a same-size revision replacement', () => {
    const eventPayload: BankInsightsPayload = {
      ...emptyPayload,
      events: [{
        date: '2026-09-03',
        provider: 'Example Bank',
        section: 'Mortgage',
        dir: 'cut',
        moved: 1,
        total: 1,
        avg_bps: -10,
      }],
    };
    const onRenderEvidence = jest.fn();
    let tree!: ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <BankMovesFeed
          payload={eventPayload}
          sections={['Mortgage']}
          contentRevision="revision-1"
          onRenderEvidence={onRenderEvidence}
        />,
      );
    });
    expect(onRenderEvidence).toHaveBeenLastCalledWith({
      expectedCount: 1,
      actualCount: 1,
      emptyStateRendered: false,
    });

    act(() => {
      tree.update(
        <BankMovesFeed
          payload={eventPayload}
          sections={['Mortgage']}
          contentRevision="revision-2"
          onRenderEvidence={onRenderEvidence}
        />,
      );
    });
    expect(onRenderEvidence).toHaveBeenCalledTimes(2);
    expect(onRenderEvidence).toHaveBeenLastCalledWith({
      expectedCount: 1,
      actualCount: 1,
      emptyStateRendered: false,
    });
    act(() => tree.unmount());
  });
});
