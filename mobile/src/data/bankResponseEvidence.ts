import type { BankInsightsPayload, BankSectionSeries } from './bankInsightsTypes';
import type { SectionKey } from '../types';

const DAY = 86_400_000;
export const BANK_RESPONSE_REASONS = ['recorded-move', 'no-recorded-move', 'filtered-history',
  'quarantined-history', 'missing-history', 'missing-baseline', 'history-gap', 'no-products', 'unverified-events'] as const;
export type BankResponseReason = typeof BANK_RESPONSE_REASONS[number];
export interface BankResponseEvidence {
  reason: BankResponseReason;
  observedDays: number;
  missingDays: number;
  baselineAvailable: boolean;
  firstMoveVerified: boolean;
}

/** Absence of a >=5bp product event does not prove unchanged rates. Require a
 * daily observed window and its prior-day baseline before saying no recorded move. */
export function bankResponseEvidence(payload: BankInsightsPayload, section: SectionKey,
  provider: string, start: string, end: string, eventDate: string | null,
  source?: BankInsightsPayload | null): BankResponseEvidence {
  return createBankResponseEvidenceReader(payload, source)(section, provider, start, end, eventDate);
}

function isSortedDates(dates: readonly string[]): boolean {
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] < dates[i - 1]) return false;
  }
  return true;
}

function lowerBound(dates: readonly string[], target: string): number {
  let low = 0;
  let high = dates.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (dates[mid] < target) low = mid + 1;
    else high = mid;
  }
  return low;
}

function upperBound(dates: readonly string[], target: string): number {
  let low = 0;
  let high = dates.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (dates[mid] <= target) low = mid + 1;
    else high = mid;
  }
  return low;
}

function observed(s: BankSectionSeries | undefined, index: number): boolean {
  return index >= 0 && !!s &&
    (s.count[index] === 0 && s.median[index] == null && s.best[index] == null ||
      (Number.isSafeInteger(s.count[index]) && s.count[index]! > 0 &&
      (Number.isFinite(s.median[index]) || Number.isFinite(s.best[index]))));
}

/** Per-build indexes avoid repeated date searches and whole-ledger scans for
 * every provider/window. They are rebuilt for each source adoption, not cached. */
export function createBankResponseEvidenceReader(payload: BankInsightsPayload, source?: BankInsightsPayload | null) {
  const dateIndices = new Map(payload.run_dates.map((date, index) => [date, index]));
  const payloadSorted = isSortedDates(payload.run_dates);
  const hasDistinctSource = Boolean(source && source !== payload);
  const sourceDateIndices = hasDistinctSource && source
    ? new Map(source.run_dates.map((date, index) => [date, index]))
    : null;
  const sourceSorted = hasDistinctSource && source ? isSortedDates(source.run_dates) : false;
  const eventKey = (event: BankInsightsPayload['events'][number]) =>
    `${event.date}\0${event.dir}\0${event.moved}\0${event.total}\0${event.avg_bps}`;
  const retained = new Map<string, Map<SectionKey, Set<string>>>();
  const removed = new Map<string, Map<SectionKey, string[]>>();
  if (hasDistinctSource && source) {
    for (const event of payload.events) {
      let bySection = retained.get(event.provider);
      if (!bySection) {
        bySection = new Map();
        retained.set(event.provider, bySection);
      }
      let set = bySection.get(event.section);
      if (!set) {
        set = new Set();
        bySection.set(event.section, set);
      }
      set.add(eventKey(event));
    }
    for (const event of source.events) {
      if (retained.get(event.provider)?.get(event.section)?.has(eventKey(event))) continue;
      let bySection = removed.get(event.provider);
      if (!bySection) {
        bySection = new Map();
        removed.set(event.provider, bySection);
      }
      let list = bySection.get(event.section);
      if (!list) {
        list = [];
        bySection.set(event.section, list);
      }
      list.push(event.date);
    }
  }
  const dayMsCache = new Map<string, number>();
  const baselineCache = new Map<string, string>();
  const parseDayMs = (date: string): number => {
    let cached = dayMsCache.get(date);
    if (cached === undefined) {
      cached = Date.parse(`${date}T00:00:00Z`);
      dayMsCache.set(date, cached);
    }
    return cached;
  };
  const baselineFor = (start: string, fromMs: number): string => {
    let cached = baselineCache.get(start);
    if (cached === undefined) {
      cached = new Date(fromMs - DAY).toISOString().slice(0, 10);
      baselineCache.set(start, cached);
    }
    return cached;
  };
  return (section: SectionKey, provider: string, start: string, end: string, eventDate: string | null): BankResponseEvidence => {
  const series = payload.banks[provider]?.[section];
  const toDate = eventDate ?? end;
  const from = parseDayMs(start);
  const to = parseDayMs(toDate);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return {
    reason: 'missing-history', observedDays: 0, missingDays: 0, baselineAvailable: false, firstMoveVerified: false,
  };
  const baselineDate = baselineFor(start, from);
  const baselineAvailable = observed(series, dateIndices.get(baselineDate) ?? -1);
  let observedDays = 0;
  let nonzeroDays = 0;
  const removedDates = removed.get(provider)?.get(section);
  let filtered = removedDates?.some(date => date >= start && date <= end) ?? false;
  const sourceSeries = source?.banks[provider]?.[section];
  const startIdx = payloadSorted ? lowerBound(payload.run_dates, start) : 0;
  const endIdx = payloadSorted ? upperBound(payload.run_dates, toDate) : payload.run_dates.length;
  for (let index = startIdx; index < endIdx; index++) {
    if (!payloadSorted) {
      const date = payload.run_dates[index];
      if (date < start || date > toDate) continue;
    }
    if (observed(series, index)) {
      observedDays++;
      if (series?.count[index] !== 0) nonzeroDays++;
    }
  }
  let sourceDeficit: BankResponseReason | null = null;
  if (hasDistinctSource && source && sourceDateIndices) {
    let earliestRemoved: string | null = null;
    if (removedDates) {
      for (const date of removedDates) {
        if (date >= start && date <= end && (earliestRemoved === null || date < earliestRemoved)) {
          earliestRemoved = date;
        }
      }
    }
    const sourceEnd = eventDate && earliestRemoved
      ? (eventDate < earliestRemoved ? eventDate : earliestRemoved)
      : eventDate ?? earliestRemoved ?? end;
    const sourceTo = parseDayMs(sourceEnd);
    if (!sourceSeries) {
      sourceDeficit = 'missing-history';
    } else if (Number.isFinite(sourceTo) && sourceTo >= from) {
      const sourceBaselineAvailable = observed(sourceSeries, sourceDateIndices.get(baselineDate) ?? -1);
      let sourceObservedDays = 0;
      let sourceNonzeroDays = 0;
      const srcStartIdx = sourceSorted ? lowerBound(source.run_dates, start) : 0;
      const srcEndIdx = sourceSorted ? upperBound(source.run_dates, sourceEnd) : source.run_dates.length;
      for (let index = srcStartIdx; index < srcEndIdx; index++) {
        if (!sourceSorted) {
          const date = source.run_dates[index];
          if (date < start || date > sourceEnd) continue;
        }
        if (observed(sourceSeries, index)) {
          sourceObservedDays++;
          if (sourceSeries.count[index] !== 0) sourceNonzeroDays++;
        }
      }
      const sourceMissingDays = Math.max(0, Math.round((sourceTo - from) / DAY) + 1 - sourceObservedDays);
      if (!sourceObservedDays) sourceDeficit = 'missing-history';
      else if (!sourceBaselineAvailable) sourceDeficit = 'missing-baseline';
      else if (sourceMissingDays > 0) sourceDeficit = 'history-gap';
      else if (sourceNonzeroDays === 0 && !eventDate && !earliestRemoved) sourceDeficit = 'no-products';
    }
    if (sourceSeries && !filtered) {
      const fStart = sourceSorted ? lowerBound(source.run_dates, baselineDate) : 0;
      const fEnd = sourceSorted ? upperBound(source.run_dates, end) : source.run_dates.length;
      for (let index = fStart; index < fEnd; index++) {
        const date = source.run_dates[index];
        if (!sourceSorted && (date < baselineDate || date > end)) continue;
        const payloadIdx = payload.run_dates[index] === date ? index : (dateIndices.get(date) ?? -1);
        if (observed(sourceSeries, index) && !observed(series, payloadIdx)) {
          filtered = true;
          break;
        }
      }
    }
  }
  const missingDays = Math.max(0, Math.round((to - from) / DAY) + 1 - observedDays);
  const complete = baselineAvailable && missingDays === 0 && !filtered && payload.eventLedgerComplete === true;
  const reason: BankResponseReason = sourceDeficit
    ? sourceDeficit
    : filtered ? 'filtered-history'
    : !observedDays ? 'missing-history'
      : !baselineAvailable ? 'missing-baseline'
        : missingDays ? 'history-gap'
          : nonzeroDays === 0 && !eventDate ? 'no-products'
            : payload.eventLedgerComplete !== true ? 'unverified-events'
              : eventDate ? 'recorded-move' : 'no-recorded-move';
  return { reason, observedDays, missingDays, baselineAvailable, firstMoveVerified: eventDate != null && complete };
  };
}
