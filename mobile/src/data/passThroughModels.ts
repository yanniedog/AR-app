import type {
  MultiSectionPassThroughModel,
  MultiSectionPassThroughRow,
  PassThroughRow,
} from './bankInsights';
import type { SectionKey } from '../types';

export type PassThroughSort = 'response' | 'timing' | 'bank';

export interface SectionResponseSummary {
  eligible: number;
  movedWithRba: number;
  movedOpposite: number;
  unchanged: number;
  medianObservedBps: number | null;
  medianDays: number | null;
  completeBaselines: number;
  fullOrOver: number;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function sectionRows(
  model: MultiSectionPassThroughModel,
  section: SectionKey,
): (MultiSectionPassThroughRow & { response: PassThroughRow })[] {
  return model.rows.flatMap((row) => {
    const response = row.sections[section];
    return response ? [{ ...row, response }] : [];
  });
}

export function summarizeSectionResponse(
  model: MultiSectionPassThroughModel,
  section: SectionKey,
): SectionResponseSummary {
  const responses = sectionRows(model, section).map((row) => row.response);
  const withRba = responses.filter((row) => row.passedBps !== 0);
  const opposite = responses.filter(
    (row) => (row.netChangeBps ?? 0) !== 0 && row.passedBps === 0,
  );
  const unchanged = responses.length - withRba.length - opposite.length;
  return {
    eligible: responses.length,
    movedWithRba: withRba.length,
    movedOpposite: opposite.length,
    unchanged,
    medianObservedBps: median(withRba.map((row) => Math.abs(row.passedBps))),
    medianDays: median(
      withRba.flatMap((row) =>
        row.daysToFirstMove == null ? [] : [row.daysToFirstMove],
      ),
    ),
    completeBaselines: responses.filter((row) => row.baselineComplete).length,
    fullOrOver: responses.filter(
      (row) => row.passStatus === 'full' || row.passStatus === 'over',
    ).length,
  };
}

export function passThroughCustomerContext(section: SectionKey, decisionBps: number): string {
  const ratesRose = decisionBps > 0;
  if (section === 'Mortgage') {
    return ratesRose
      ? 'More pass-through means higher advertised mortgage rates — worse for borrowers.'
      : 'More pass-through means lower advertised mortgage rates — better for borrowers.';
  }
  return ratesRose
    ? 'More pass-through means higher advertised deposit rates — better for savers.'
    : 'More pass-through means lower advertised deposit rates — worse for savers.';
}

export function filterAndSortSectionRows(
  model: MultiSectionPassThroughModel,
  section: SectionKey,
  query: string,
  sort: PassThroughSort,
): (MultiSectionPassThroughRow & { response: PassThroughRow })[] {
  const normalized = query.trim().toLocaleLowerCase();
  const rows = sectionRows(model, section).filter(
    (row) => !normalized || row.provider.toLocaleLowerCase().includes(normalized),
  );
  return rows.sort((a, b) => {
    if (sort === 'bank') return a.provider.localeCompare(b.provider);
    if (sort === 'timing') {
      const ad = a.response.daysToFirstMove ?? Number.POSITIVE_INFINITY;
      const bd = b.response.daysToFirstMove ?? Number.POSITIVE_INFINITY;
      return ad - bd || Math.abs(b.response.passedBps) - Math.abs(a.response.passedBps) ||
        a.provider.localeCompare(b.provider);
    }
    return (
      Math.abs(b.response.passedBps) - Math.abs(a.response.passedBps) ||
      (a.response.daysToFirstMove ?? Number.POSITIVE_INFINITY) -
        (b.response.daysToFirstMove ?? Number.POSITIVE_INFINITY) ||
      a.provider.localeCompare(b.provider)
    );
  });
}

export function passThroughEvidenceLabel(model: MultiSectionPassThroughModel): string {
  if (model.decision.partialObservation) return 'Early evidence · partial history';
  if (model.windowOpen) return 'Live evidence · window open';
  return 'Complete response window';
}
