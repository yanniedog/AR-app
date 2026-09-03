import type { HistoryWindow, SectionKey } from '../types';

export interface HistoryGraphicEvidence {
  contentRevision: string;
  graphicRevision: string;
  window: HistoryWindow;
  availability: 'rendered' | 'unavailable';
  pointCount: number;
  accessibleSummary: boolean;
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
    ? evidence.pointCount > 0 && evidence.accessibleSummary
    : evidence.availability === 'unavailable' &&
        evidence.pointCount === 0 &&
        !evidence.accessibleSummary;
}
