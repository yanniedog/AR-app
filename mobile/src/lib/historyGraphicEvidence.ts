import type { HistoryWindow, SectionKey } from '../types';

export interface HistoryGraphicEvidence {
  contentRevision: string;
  graphicRevision: string;
  window: HistoryWindow;
  availability: 'rendered' | 'unavailable';
  pointCount: number;
  expectedCount: number;
  accessibleSummary: boolean;
  layoutMeasured: boolean;
  emptyStateRendered: boolean;
}

/** A measured empty window is available display evidence, not a chart failure.
 * Missing finite values that the model expected must still fail the audit. */
export function isMeasuredEmptyHistoryGraphic(evidence: HistoryGraphicEvidence | null): boolean {
  return evidence?.availability === 'unavailable' &&
    evidence.expectedCount === 0 && evidence.pointCount === 0 &&
    evidence.layoutMeasured && evidence.emptyStateRendered && !evidence.accessibleSummary;
}

export function buildHistoryGraphicRevision(
  contentRevision: string,
  section: SectionKey,
  window: HistoryWindow,
  plotDates: readonly string[],
): string {
  return [
    contentRevision,
    section,
    window,
    plotDates.at(-1) ?? 'none',
    plotDates.length,
  ].join(':');
}

export function isCurrentHistoryGraphicEvidence(
  evidence: HistoryGraphicEvidence | null,
  contentRevision: string,
): evidence is HistoryGraphicEvidence {
  if (
    evidence?.contentRevision !== contentRevision ||
    !Number.isInteger(evidence.pointCount) ||
    evidence.pointCount < 0
  ) {
    return false;
  }
  return evidence.availability === 'rendered'
    ? evidence.pointCount > 0 && evidence.accessibleSummary && evidence.layoutMeasured
    : evidence.availability === 'unavailable' &&
        evidence.pointCount === 0 &&
        !evidence.accessibleSummary && evidence.layoutMeasured && evidence.emptyStateRendered;
}
