import type { BankInsightsPayload, BankSectionSeries } from './bankInsightsTypes';
import type { SectionKey } from '../types';

const DAY = 86_400_000;
export const BANK_RESPONSE_REASONS = ['recorded-move', 'no-recorded-move', 'filtered-history',
  'quarantined-history', 'missing-history', 'missing-baseline', 'history-gap', 'no-products'] as const;
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
  const series = payload.banks[provider]?.[section];
  const observed = (s: BankSectionSeries | undefined, index: number) => index >= 0 && !!s &&
    (s.count[index] === 0 || (Number.isFinite(s.count[index]) && s.count[index]! > 0 &&
      (Number.isFinite(s.median[index]) || Number.isFinite(s.best[index]))));
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${eventDate ?? end}T00:00:00Z`);
  const baselineDate = new Date(from - DAY).toISOString().slice(0, 10);
  const baselineAvailable = observed(series, payload.run_dates.indexOf(baselineDate));
  let observedDays = 0;
  let nonzeroDays = 0;
  let filtered = false;
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
    filtered = source.run_dates.some((date, index) => date >= baselineDate && date <= end &&
      observed(sourceSeries, index) && !observed(series, payload.run_dates.indexOf(date)));
  }
  const missingDays = Math.max(0, Math.round((to - from) / DAY) + 1 - observedDays);
  const complete = baselineAvailable && missingDays === 0 && !filtered;
  const reason: BankResponseReason = filtered ? 'filtered-history'
    : !observedDays ? 'missing-history'
      : !baselineAvailable ? 'missing-baseline'
        : missingDays ? 'history-gap'
          : eventDate ? 'recorded-move' : nonzeroDays === 0 ? 'no-products' : 'no-recorded-move';
  return { reason, observedDays, missingDays, baselineAvailable, firstMoveVerified: eventDate != null && complete };
}
