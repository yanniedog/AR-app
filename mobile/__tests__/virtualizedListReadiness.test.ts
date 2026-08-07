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
});
