import { useCallback, useEffect, useRef, useState } from 'react';

import {
  commitVirtualizedListRevision,
  initialVirtualizedListCommitState,
  isVirtualizedListRevisionReady,
  isVirtualizedListVisiblyCommitted,
} from '../lib/virtualizedListReadiness';

type ViewableItemsChangedInfo = {
  viewableItems: { isViewable?: boolean | null }[];
};

/**
 * Tracks whether a FlashList (or similar) has painted the active data revision.
 *
 * Callbacks belong to one revision. Lists remount on that revision, so a late
 * callback from an unmounted list cannot certify its replacement. Layout/load
 * signals establish layout only; non-empty lists require observed viewability.
 *
 * Callers should remount the list on the full readiness revision so recycled
 * FlashList instances cannot deliver layout/viewability for a prior identity.
 */
export function useVirtualizedListReadiness(revision: string, itemCount: number) {
  const revisionRef = useRef(revision);
  revisionRef.current = revision;

  const [commit, setCommit] = useState(() => initialVirtualizedListCommitState(revision));
  const [viewability, setViewability] = useState<{ revision: string; count: number } | null>(null);

  useEffect(() => {
    setCommit((current) => (
      current.revision === revision
        ? current
        : initialVirtualizedListCommitState(revision)
    ));
  }, [revision]);

  useEffect(() => {
    setViewability((current) => current?.revision === revision ? current : null);
  }, [revision]);

  const markCommitted = useCallback((visibleCount?: number) => {
    // Capture the revision/count the signal was for. setState may flush later,
    // after a newer revision is active — commitVirtualizedListRevision rejects
    // when callbackRevision !== activeRevision at apply time.
    const callbackRevision = revision;
    const callbackCount = itemCount;
    setCommit((current) => commitVirtualizedListRevision(
      current,
      callbackRevision,
      revisionRef.current,
      callbackCount,
      visibleCount,
    ));
  }, [revision, itemCount]);

  const markLayoutCommitted = useCallback(() => {
    markCommitted();
  }, [markCommitted]);

  const onCommitLayoutEffect = markLayoutCommitted;
  const onRevisionLayout = markLayoutCommitted;
  const onLoad = markLayoutCommitted;
  const onContentSizeChange = markLayoutCommitted;

  const onViewableItemsChanged = useCallback((info: ViewableItemsChangedInfo) => {
    if (revisionRef.current !== revision) return;
    const count = info.viewableItems.filter((item) => item.isViewable === true).length;
    setViewability({ revision, count });
    markCommitted(count);
  }, [revision, markCommitted]);

  return {
    ready: isVirtualizedListRevisionReady(commit, revision, itemCount),
    visiblyCommitted: isVirtualizedListVisiblyCommitted(commit, revision, itemCount),
    expectedCount: itemCount,
    committedItemCount: commit.revision === revision && commit.committed ? commit.itemCount : 0,
    visibleCount: commit.revision === revision ? commit.visibleCount : 0,
    measuredVisibleCount: viewability?.revision === revision ? viewability.count : null,
    onCommitLayoutEffect,
    onRevisionLayout,
    onLoad,
    onContentSizeChange,
    onViewableItemsChanged,
  };
}
