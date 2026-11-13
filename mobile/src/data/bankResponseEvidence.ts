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

/** Per-build indexes avoid repeated date searches and whole-ledger scans for
 * every provider/window. They are rebuilt for each source adoption, not cached. */
export function createBankResponseEvidenceReader(payload: BankInsightsPayload, source?: BankInsightsPayload | null) {
  const dateIndices = new Map(payload.run_dates.map((date, index) => [date, index]));
  const eventKey = (event: BankInsightsPayload['events'][number]) =>
    JSON.stringify([event.date, event.dir, event.moved, event.total, event.avg_bps]);
  const pair = (provider: string, section: SectionKey) => JSON.stringify([provider, section]);
  const retained = new Map<string, Set<string>>();
  const removed = new Map<string, string[]>();
  if (source && source !== payload) {
    for (const event of payload.events) {
      const key = pair(event.provider, event.section);
      if (!retained.has(key)) retained.set(key, new Set());
      retained.get(key)!.add(eventKey(event));
    }
    for (const event of source.events) {
      const key = pair(event.provider, event.section);
      if (retained.get(key)?.has(eventKey(event))) continue;
      if (!removed.has(key)) removed.set(key, []);
      removed.get(key)!.push(event.date);
    }
  }
  return (section: SectionKey, provider: string, start: string, end: string, eventDate: string | null): BankResponseEvidence => {
  const series = payload.banks[provider]?.[section];
  const observed = (s: BankSectionSeries | undefined, index: number) => index >= 0 && !!s &&
    (s.count[index] === 0 && s.median[index] == null && s.best[index] == null ||
      (Number.isSafeInteger(s.count[index]) && s.count[index]! > 0 &&
      (Number.isFinite(s.median[index]) || Number.isFinite(s.best[index]))));
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${eventDate ?? end}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return {
    reason: 'missing-history', observedDays: 0, missingDays: 0, baselineAvailable: false, firstMoveVerified: false,
  };
  const baselineDate = new Date(from - DAY).toISOString().slice(0, 10);
  const baselineAvailable = observed(series, dateIndices.get(baselineDate) ?? -1);
  let observedDays = 0;
  let nonzeroDays = 0;
  let filtered = removed.get(pair(provider, section))?.some(date => date >= start && date <= end) ?? false;
  const sourceSeries = source?.banks[provider]?.[section];
  for (let index = 0; index < payload.run_dates.length; index++) {
    const date = payload.run_dates[index];
    if (date < start || date > (eventDate ?? end)) continue;
    if (observed(series, index)) {
      observedDays++;
      if (series?.count[index] !== 0) nonzeroDays++;
    }
  }
  if (source && source !== payload && sourceSeries) {
    filtered ||= source.run_dates.some((date, index) => date >= baselineDate && date <= end &&
      observed(sourceSeries, index) && !observed(series, dateIndices.get(date) ?? -1));
  }
  const missingDays = Math.max(0, Math.round((to - from) / DAY) + 1 - observedDays);
  const complete = baselineAvailable && missingDays === 0 && !filtered && payload.eventLedgerComplete === true;
  const reason: BankResponseReason = filtered ? 'filtered-history'
    : !observedDays ? 'missing-history'
      : !baselineAvailable ? 'missing-baseline'
        : missingDays ? 'history-gap'
          : nonzeroDays === 0 && !eventDate ? 'no-products'
            : payload.eventLedgerComplete !== true ? 'unverified-events'
              : eventDate ? 'recorded-move' : 'no-recorded-move';
  return { reason, observedDays, missingDays, baselineAvailable, firstMoveVerified: eventDate != null && complete };
  };
}
