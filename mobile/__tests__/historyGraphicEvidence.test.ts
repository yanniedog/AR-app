import {
  buildHistoryGraphicRevision,
  isCurrentHistoryGraphicEvidence,
  type HistoryGraphicEvidence,
} from '../src/lib/historyGraphicEvidence';

describe('history graphic audit evidence', () => {
  it('changes for content corrections and selected windows even when shape is unchanged', () => {
    const dates = ['2026-08-01', '2026-09-01'];
    expect(buildHistoryGraphicRevision('sha-a', 'Mortgage', '30D', dates)).not.toBe(
      buildHistoryGraphicRevision('sha-b', 'Mortgage', '30D', dates),
    );
    expect(buildHistoryGraphicRevision('sha-a', 'Mortgage', '30D', dates)).not.toBe(
      buildHistoryGraphicRevision('sha-a', 'Mortgage', 'All', dates),
    );
  });

  it('accepts only measured evidence for the current content revision', () => {
    const evidence: HistoryGraphicEvidence = {
      contentRevision: 'sha-a',
      graphicRevision: 'sha-a:Mortgage:30D:2026-09-01:2',
      window: '30D',
      availability: 'rendered',
      pointCount: 2,
      accessibleSummary: true,
    };
    expect(isCurrentHistoryGraphicEvidence(evidence, 'sha-a')).toBe(true);
    expect(isCurrentHistoryGraphicEvidence(evidence, 'sha-b')).toBe(false);
    expect(isCurrentHistoryGraphicEvidence({ ...evidence, pointCount: 0 }, 'sha-a')).toBe(false);
    expect(isCurrentHistoryGraphicEvidence({
      ...evidence,
      availability: 'unavailable',
      pointCount: 0,
      accessibleSummary: false,
    }, 'sha-a')).toBe(true);
  });
});
