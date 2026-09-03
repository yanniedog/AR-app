export interface FeedLayoutEvidence {
  expectedCount: number;
  actualCount: number;
  emptyStateRendered: boolean;
}

export interface FeedRenderEvidence extends FeedLayoutEvidence {
  revision: string;
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
