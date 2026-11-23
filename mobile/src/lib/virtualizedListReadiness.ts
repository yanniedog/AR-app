export interface VirtualizedListCommitState {
  revision: string;
  committed: boolean;
  itemCount: number;
  visibleCount: number;
}

export function initialVirtualizedListCommitState(revision: string): VirtualizedListCommitState {
  return { revision, committed: false, itemCount: 0, visibleCount: 0 };
}

export function commitVirtualizedListRevision(
  current: VirtualizedListCommitState,
  callbackRevision: string,
  activeRevision: string,
  itemCount: number,
  visibleCount = current.revision === callbackRevision ? current.visibleCount : 0,
): VirtualizedListCommitState {
  if (callbackRevision !== activeRevision) return current;
  const next = {
    revision: activeRevision,
    committed: true,
    itemCount: Math.max(0, itemCount),
    visibleCount: Math.max(0, visibleCount),
  };
  return current.revision === next.revision &&
    current.committed === next.committed &&
    current.itemCount === next.itemCount &&
    current.visibleCount === next.visibleCount
    ? current
    : next;
}

export function isVirtualizedListRevisionReady(
  state: VirtualizedListCommitState,
  activeRevision: string,
  itemCount: number,
): boolean {
  return state.committed && state.revision === activeRevision && state.itemCount === itemCount;
}

export function isVirtualizedListVisiblyCommitted(
  state: VirtualizedListCommitState,
  activeRevision: string,
  itemCount: number,
): boolean {
  return isVirtualizedListRevisionReady(state, activeRevision, itemCount) &&
    (itemCount === 0 || state.visibleCount > 0);
}

export interface ListIdentityVersion {
  signature: string;
  version: number;
}

/** The version moves only when the ordered item ids change. A new array holding
 * the same ids keeps its version, so a painted list is not marked unpainted. */
export function nextListIdentityVersion(
  current: ListIdentityVersion | null,
  ids: readonly string[],
): ListIdentityVersion {
  const signature = ids.join('\u0001');
  if (current && current.signature === signature) return current;
  return { signature, version: (current?.version ?? 0) + 1 };
}
