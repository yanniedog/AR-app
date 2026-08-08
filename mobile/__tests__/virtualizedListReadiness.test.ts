import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { useVirtualizedListReadiness } from '../src/hooks/useVirtualizedListReadiness';
import {
  commitVirtualizedListRevision,
  initialVirtualizedListCommitState,
  isVirtualizedListRevisionReady,
  isVirtualizedListVisiblyCommitted,
} from '../src/lib/virtualizedListReadiness';

describe('virtualized list readiness', () => {
  test('publishes a count only after that exact render revision commits', () => {
    let state = initialVirtualizedListCommitState('query:a');
    expect(isVirtualizedListRevisionReady(state, 'query:a', 12)).toBe(false);
    state = commitVirtualizedListRevision(state, 'query:a', 'query:a', 12, 5);
    expect(isVirtualizedListRevisionReady(state, 'query:a', 12)).toBe(true);
    expect(state).toMatchObject({ itemCount: 12, visibleCount: 5 });
    expect(isVirtualizedListVisiblyCommitted(state, 'query:a', 12)).toBe(true);
  });

  test('rejects stale callbacks after query, sort, or filter revision changes', () => {
    const previous = commitVirtualizedListRevision(
      initialVirtualizedListCommitState('sort:rate'),
      'sort:rate',
      'sort:rate',
      20,
    );
    const ignored = commitVirtualizedListRevision(
      previous,
      'sort:rate',
      'sort:bank',
      20,
    );
    expect(ignored).toBe(previous);
    expect(isVirtualizedListRevisionReady(ignored, 'sort:bank', 20)).toBe(false);
  });

  test('requires a new commit when the item count changes within a revision', () => {
    const state = commitVirtualizedListRevision(
      initialVirtualizedListCommitState('filters:1'),
      'filters:1',
      'filters:1',
      4,
    );
    expect(isVirtualizedListRevisionReady(state, 'filters:1', 3)).toBe(false);
  });

  test('requires viewability evidence for non-empty lists but not empty states', () => {
    const nonEmpty = commitVirtualizedListRevision(
      initialVirtualizedListCommitState('query'),
      'query',
      'query',
      2,
      0,
    );
    expect(isVirtualizedListVisiblyCommitted(nonEmpty, 'query', 2)).toBe(false);
    const empty = commitVirtualizedListRevision(
      initialVirtualizedListCommitState('empty'),
      'empty',
      'empty',
      0,
    );
    expect(isVirtualizedListVisiblyCommitted(empty, 'empty', 0)).toBe(true);
  });

  test('onRevisionLayout through the hook seeds visibility for filtered non-empty lists', () => {
    type Api = ReturnType<typeof useVirtualizedListReadiness>;
    const latest: { current: Api | null } = { current: null };

    function Probe({ revision, itemCount }: { revision: string; itemCount: number }) {
      const api = useVirtualizedListReadiness(revision, itemCount);
      useEffect(() => {
        latest.current = api;
      });
      return null;
    }

    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        React.createElement(Probe, { revision: 'query:afg', itemCount: 1 }),
      );
    });
    expect(latest.current?.ready).toBe(false);
    expect(latest.current?.visiblyCommitted).toBe(false);

    act(() => {
      latest.current?.onRevisionLayout();
    });

    expect(latest.current?.ready).toBe(true);
    expect(latest.current?.visiblyCommitted).toBe(true);
    expect(latest.current?.committedItemCount).toBe(1);
    expect(latest.current?.visibleCount).toBe(1);

    act(() => {
      tree!.update(React.createElement(Probe, { revision: 'query:afg:next', itemCount: 2 }));
    });
    expect(latest.current?.ready).toBe(false);
    expect(latest.current?.visiblyCommitted).toBe(false);

    act(() => {
      tree!.unmount();
    });
  });

  test('onViewableItemsChanged counts only explicitly viewable items', () => {
    type Api = ReturnType<typeof useVirtualizedListReadiness>;
    const latest: { current: Api | null } = { current: null };

    function Probe({ revision, itemCount }: { revision: string; itemCount: number }) {
      const api = useVirtualizedListReadiness(revision, itemCount);
      useEffect(() => {
        latest.current = api;
      });
      return null;
    }

    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        React.createElement(Probe, { revision: 'viewable', itemCount: 2 }),
      );
    });

    act(() => {
      latest.current?.onViewableItemsChanged({
        viewableItems: [
          { isViewable: true },
          { isViewable: undefined },
          { isViewable: null },
          { isViewable: false },
        ],
      });
    });

    expect(latest.current?.ready).toBe(true);
    expect(latest.current?.visiblyCommitted).toBe(true);
    expect(latest.current?.visibleCount).toBe(1);

    act(() => {
      tree!.unmount();
    });
  });
});
