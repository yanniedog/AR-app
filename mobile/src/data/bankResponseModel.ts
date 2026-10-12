import type { BankInsightsPayload, BankMoveDir, BankRateEvent } from './bankInsights';
import type { RbaCalendar, RbaDecisionEntry } from './rbaCalendar';
import type { SectionKey } from '../types';

const DAY_MS = 86_400_000;

export interface CompactBankResponseRow {
  provider: string;
  movePp: number | null;
  daysAfter: number | null;
  direction: BankMoveDir | null;
}

export interface CompactBankResponseWindow {
  decision: RbaDecisionEntry;
  observationStart: string;
  observedThrough: string;
  windowEnd: string;
  open: boolean;
  partialHistory: boolean;
  rows: CompactBankResponseRow[];
}

function daysBetween(start: string, end: string): number | null {
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${end}T00:00:00Z`);
  return Number.isFinite(from) && Number.isFinite(to) ? Math.round((to - from) / DAY_MS) : null;
}

function dayBefore(date: string): string {
  const time = Date.parse(`${date}T00:00:00Z`);
  return new Date(time - DAY_MS).toISOString().slice(0, 10);
}

function firstDateIndex<T>(values: readonly T[], start: string, date: (value: T) => string): number {
  let low = 0, high = values.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (date(values[middle]) < start) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function buildCompactBankResponseWindows(
  payload: BankInsightsPayload,
  calendar: RbaCalendar | null | undefined,
  section: SectionKey,
): CompactBankResponseWindow[] {
  const decisions = (calendar?.decisions ?? [])
    .filter((decision) => decision.date <= payload.run_date)
    .sort((a, b) => a.date.localeCompare(b.date));
  const ledgerStart = payload.run_dates[0] ?? payload.run_date;
  // Index once per section instead of scanning and sorting the full event
  // ledger for every bank in every decision window. Stable sorting preserves
  // the producer's first event when several observations share a date.
  const eventsByProvider = new Map<string, BankRateEvent[]>();
  for (const event of payload.events) {
    if (event.section !== section) continue;
    const events = eventsByProvider.get(event.provider);
    if (events) events.push(event);
    else eventsByProvider.set(event.provider, [event]);
  }
  for (const events of eventsByProvider.values()) events.sort((a, b) => a.date.localeCompare(b.date));
  const providers = Object.keys(payload.banks).sort((a, b) => a.localeCompare(b));
  const observations = new Map<string, string[]>();
  for (const provider of providers) {
    const series = payload.banks[provider]?.[section];
    if (!series) continue;
    observations.set(provider, payload.run_dates.filter((_, index) =>
      series.median[index] != null || series.best[index] != null || series.count[index] != null).sort());
  }
  return decisions.map((decision, index) => {
    const next = decisions[index + 1];
    const windowEnd = next ? dayBefore(next.date) : payload.run_date;
    const observationStart = decision.date < ledgerStart ? ledgerStart : decision.date;
    const partialHistory = observationStart !== decision.date;
    const includedProviders = providers.filter((provider) => {
      if (eventsByProvider.has(provider)) return true;
      const dates = observations.get(provider) ?? [];
      const first = dates[firstDateIndex(dates, observationStart, date => date)];
      return first !== undefined && first <= windowEnd;
    });
    const rows = includedProviders.map((provider) => {
      const events = eventsByProvider.get(provider) ?? [];
      const candidate = events[firstDateIndex(events, observationStart, event => event.date)];
      const event = candidate && candidate.date <= windowEnd ? candidate : null;
      return {
        provider,
        movePp: event ? event.avg_bps / 100 : null,
        daysAfter: event ? daysBetween(decision.date, event.date) : null,
        direction: event?.dir ?? null,
      };
    });
    return {
      decision,
      observationStart,
      observedThrough: payload.run_date,
      windowEnd,
      open: !next,
      partialHistory,
      rows,
    };
  }).filter((window) => window.windowEnd >= ledgerStart).reverse();
}

export function bankResponseDecisionLabel(decision: RbaDecisionEntry): string {
  if (decision.outcome === 'hold') return `RBA held at ${decision.rate.toFixed(2)}%`;
  const move = `${decision.delta_bps > 0 ? '+' : '−'}${Math.abs(decision.delta_bps)} bp`;
  return `RBA ${move} to ${decision.rate.toFixed(2)}%`;
}
