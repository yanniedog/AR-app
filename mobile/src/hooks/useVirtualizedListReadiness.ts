import { useCallback, useRef, useState } from 'react';

import {
  commitVirtualizedListRevision,
  initialVirtualizedListCommitState,
  isVirtualizedListRevisionReady,
  isVirtualizedListVisiblyCommitted,
} from '../lib/virtualizedListReadiness';

export function useVirtualizedListReadiness(revision: string, itemCount: number) {
  const activeRevisionRef = useRef(revision);
  activeRevisionRef.current = revision;
  const [commit, setCommit] = useState(() => initialVirtualizedListCommitState(revision));

  const markCommitted = useCallback((visibleCount?: number) => {
    if (activeRevisionRef.current !== revision) return;
    setCommit((current) => commitVirtualizedListRevision(
      current,
      revision,
      activeRevisionRef.current,
      itemCount,
      visibleCount,
    ));
  }, [itemCount, revision]);

  return {
    ready: isVirtualizedListRevisionReady(commit, revision, itemCount),
    visiblyCommitted: isVirtualizedListVisiblyCommitted(commit, revision, itemCount),
    expectedCount: itemCount,
    committedItemCount: commit.revision === revision && commit.committed ? commit.itemCount : 0,
    visibleCount: commit.revision === revision ? commit.visibleCount : 0,
    onCommitLayoutEffect: useCallback(() => markCommitted(), [markCommitted]),
    onRevisionLayout: useCallback(() => markCommitted(), [markCommitted]),
    onLoad: useCallback(() => markCommitted(), [markCommitted]),
    onContentSizeChange: useCallback(() => markCommitted(), [markCommitted]),
    onViewableItemsChanged: useCallback(
      (info: { viewableItems: { isViewable?: boolean | null }[] }) => {
        markCommitted(info.viewableItems.filter((item) => item.isViewable !== false).length);
      },
      [markCommitted],
    ),
  };
}
