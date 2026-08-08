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
 * Callback identities stay stable across revision changes — FlashList drops
 * viewability updates when `onViewableItemsChanged` is replaced. Layout/load
 * signals seed visibility for non-empty lists so query/filter revisions cannot
 * hang readiness when viewability is not re-emitted after an in-place data swap.
 *
 * Callers should remount the list on the full readiness revision so recycled
 * FlashList instances cannot deliver layout/viewability for a prior identity.
 */
export function useVirtualizedListReadiness(revision: string, itemCount: number) {
  const revisionRef = useRef(revision);
  const itemCountRef = useRef(itemCount);
  revisionRef.current = revision;
  itemCountRef.current = itemCount;

  const [commit, setCommit] = useState(() => initialVirtualizedListCommitState(revision));

  useEffect(() => {
    setCommit((current) => (
      current.revision === revision
        ? current
        : initialVirtualizedListCommitState(revision)
    ));
  }, [revision]);

  const markCommitted = useCallback((visibleCount?: number) => {
    // Capture the revision/count the signal was for. setState may flush later,
    // after a newer revision is active — commitVirtualizedListRevision rejects
    // when callbackRevision !== activeRevision at apply time.
    const callbackRevision = revisionRef.current;
    const callbackCount = itemCountRef.current;
    setCommit((current) => commitVirtualizedListRevision(
      current,
      callbackRevision,
      revisionRef.current,
      callbackCount,
      visibleCount,
    ));
  }, []);

  const markLayoutCommitted = useCallback(() => {
    const activeCount = itemCountRef.current;
    // Non-empty lists that finished layout are visibly committed even when
    // FlashList skips a fresh onViewableItemsChanged after filtering.
    markCommitted(activeCount > 0 ? 1 : 0);
  }, [markCommitted]);

  const markCommittedRef = useRef(markCommitted);
  markCommittedRef.current = markCommitted;
  const markLayoutCommittedRef = useRef(markLayoutCommitted);
  markLayoutCommittedRef.current = markLayoutCommitted;

  const onCommitLayoutEffect = useCallback(() => {
    markLayoutCommittedRef.current();
  }, []);

  const onRevisionLayout = useCallback(() => {
    markLayoutCommittedRef.current();
  }, []);

  const onLoad = useCallback(() => {
    markLayoutCommittedRef.current();
  }, []);

  const onContentSizeChange = useCallback(() => {
    markLayoutCommittedRef.current();
  }, []);

  const onViewableItemsChanged = useCallback((info: ViewableItemsChangedInfo) => {
    markCommittedRef.current(
      info.viewableItems.filter((item) => item.isViewable === true).length,
    );
  }, []);

  return {
    ready: isVirtualizedListRevisionReady(commit, revision, itemCount),
    visiblyCommitted: isVirtualizedListVisiblyCommitted(commit, revision, itemCount),
    expectedCount: itemCount,
    committedItemCount: commit.revision === revision && commit.committed ? commit.itemCount : 0,
    visibleCount: commit.revision === revision ? commit.visibleCount : 0,
    onCommitLayoutEffect,
    onRevisionLayout,
    onLoad,
    onContentSizeChange,
    onViewableItemsChanged,
  };
}
