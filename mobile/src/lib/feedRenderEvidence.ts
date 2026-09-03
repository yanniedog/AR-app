export interface FeedLayoutEvidence {
  expectedCount: number;
  actualCount: number;
  emptyStateRendered: boolean;
}

export interface FeedRenderEvidence extends FeedLayoutEvidence {
  revision: string;
}

export interface FeedRenderProbeResult {
  status: 'ready' | 'pending' | 'error';
  error: string | null;
}

export function resolveFeedRenderProbe({
  hasPayload,
  settledEmpty,
  dataError,
  renderReady,
}: {
  hasPayload: boolean;
  settledEmpty: boolean;
  dataError: boolean;
  renderReady: boolean;
}): FeedRenderProbeResult {
  if (dataError && !hasPayload && !settledEmpty) {
    return {
      status: 'error',
      error: 'Rate changes feed did not render because its data is unavailable',
    };
  }
  return {
    status: (hasPayload || settledEmpty) && renderReady ? 'ready' : 'pending',
    error: null,
  };
}

export function buildFeedRowRevision(
  contentRevision: string,
  rowIdentities: readonly string[],
): string {
  return `${contentRevision}|${rowIdentities.join('|')}`;
}

export function resetFeedRenderEvidence(
  revision: string,
  expectedCount: number,
): FeedRenderEvidence {
  return {
    revision,
    expectedCount,
    actualCount: 0,
    emptyStateRendered: false,
  };
}

export function reconcileFeedRenderEvidence(
  current: FeedRenderEvidence,
  revision: string,
  expectedCount: number,
  observed: FeedLayoutEvidence,
): FeedRenderEvidence {
  const base = current.revision === revision && current.expectedCount === expectedCount
    ? current
    : resetFeedRenderEvidence(revision, expectedCount);
  if (
    !Number.isInteger(expectedCount) ||
    expectedCount < 0 ||
    observed.expectedCount !== expectedCount ||
    !Number.isInteger(observed.actualCount) ||
    observed.actualCount < 0 ||
    observed.actualCount > expectedCount
  ) {
    return base;
  }
  return {
    revision,
    expectedCount,
    actualCount: Math.max(base.actualCount, observed.actualCount),
    emptyStateRendered:
      expectedCount === 0 && (base.emptyStateRendered || observed.emptyStateRendered),
  };
}

export function isFeedRenderEvidenceReady(
  evidence: FeedRenderEvidence,
  revision: string,
  expectedCount: number,
): boolean {
  if (
    evidence.revision !== revision ||
    evidence.expectedCount !== expectedCount ||
    !Number.isInteger(expectedCount) ||
    expectedCount < 0
  ) {
    return false;
  }
  if (expectedCount === 0) {
    return evidence.actualCount === 0 && evidence.emptyStateRendered;
  }
  return evidence.actualCount >= expectedCount && !evidence.emptyStateRendered;
}
