import {
  isFeedRenderEvidenceReady,
  reconcileFeedRenderEvidence,
  resetFeedRenderEvidence,
} from '../src/lib/feedRenderEvidence';

describe('Changes feed render evidence', () => {
  it('does not accept the initial zero-of-zero state as a rendered empty feed', () => {
    const evidence = resetFeedRenderEvidence('edition-a:mortgage', 0);
    expect(isFeedRenderEvidenceReady(evidence, 'edition-a:mortgage', 0)).toBe(false);
  });

  it('requires every derived row to report layout before becoming ready', () => {
    const revision = 'edition-a:mortgage';
    let evidence = resetFeedRenderEvidence(revision, 2);
    evidence = reconcileFeedRenderEvidence(evidence, revision, 2, {
      expectedCount: 2,
      actualCount: 1,
      emptyStateRendered: false,
    });
    expect(isFeedRenderEvidenceReady(evidence, revision, 2)).toBe(false);

    evidence = reconcileFeedRenderEvidence(evidence, revision, 2, {
      expectedCount: 2,
      actualCount: 2,
      emptyStateRendered: false,
    });
    expect(isFeedRenderEvidenceReady(evidence, revision, 2)).toBe(true);
  });

  it('resets readiness when the feed revision changes', () => {
    const ready = reconcileFeedRenderEvidence(
      resetFeedRenderEvidence('edition-a:mortgage', 1),
      'edition-a:mortgage',
      1,
      { expectedCount: 1, actualCount: 1, emptyStateRendered: false },
    );
    expect(isFeedRenderEvidenceReady(ready, 'edition-b:mortgage', 1)).toBe(false);
  });

  it('accepts zero rows only after the real empty state lays out', () => {
    const revision = 'edition-a:savings';
    const evidence = reconcileFeedRenderEvidence(
      resetFeedRenderEvidence(revision, 0),
      revision,
      0,
      { expectedCount: 0, actualCount: 0, emptyStateRendered: true },
    );
    expect(isFeedRenderEvidenceReady(evidence, revision, 0)).toBe(true);
  });
});
