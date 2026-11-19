import type { BankInsightsPayload, BankMoveDir, BankRateEvent } from './bankInsights';
import type { RbaCalendar, RbaDecisionEntry } from './rbaCalendar';
import type { SectionKey } from '../types';
import { createBankResponseEvidenceReader, type BankResponseEvidence } from './bankResponseEvidence';

const DAY_MS = 86_400_000;

export interface CompactBankResponseRow {
  provider: string;
  movePp: number | null;
  daysAfter: number | null;
  direction: BankMoveDir | null;
  evidence: BankResponseEvidence;
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

function isSortedDates(dates: readonly string[]): boolean {
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] < dates[i - 1]) return false;
  }
  return true;
}

function upperDateIndex(values: readonly string[], end: string): number {
  let low = 0, high = values.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (values[middle] <= end) low = middle + 1;
    else high = middle;
  }
  return low;
}

export interface BuildCompactBankResponseOptions {
  activeIndex?: number;
  activeDecisionDate?: string | null;
}

export function buildCompactBankResponseWindows(
  payload: BankInsightsPayload,
  calendar: RbaCalendar | null | undefined,
  section: SectionKey,
  source?: BankInsightsPayload | null,
  options?: BuildCompactBankResponseOptions,
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
  const providers = [...new Set([...Object.keys(payload.banks), ...eventsByProvider.keys()])].sort((a, b) => a.localeCompare(b));
  const evidenceFor = createBankResponseEvidenceReader(payload, source);
  const runDatesSorted = isSortedDates(payload.run_dates);
  const observations = runDatesSorted ? null : new Map<string, string[]>();
  if (observations) {
    for (const provider of providers) {
      const series = payload.banks[provider]?.[section];
      if (!series) continue;
      observations.set(provider, payload.run_dates.filter((_, index) =>
        series.median[index] != null || series.best[index] != null || series.count[index] != null).sort());
    }
  }
  const dayMsCache = new Map<string, number>();
  const parseDayMs = (date: string): number => {
    let cached = dayMsCache.get(date);
    if (cached === undefined) {
      cached = Date.parse(`${date}T00:00:00Z`);
      dayMsCache.set(date, cached);
    }
    return cached;
  };
  const cachedDaysBetween = (start: string, end: string): number | null => {
    const from = parseDayMs(start);
    const to = parseDayMs(end);
    return Number.isFinite(from) && Number.isFinite(to) ? Math.round((to - from) / DAY_MS) : null;
  };
  const metaWindows = decisions.map((decision, index) => {
    const next = decisions[index + 1];
    const windowEnd = next ? dayBefore(next.date) : payload.run_date;
    const observationStart = decision.date < ledgerStart ? ledgerStart : decision.date;
    const partialHistory = observationStart !== decision.date;
    return {
      decision,
      observationStart,
      observedThrough: payload.run_date,
      windowEnd,
      open: !next,
      partialHistory,
    };
  }).filter((window) => window.windowEnd >= ledgerStart).reverse();

  let targetIndex: number | null = null;
  if (options) {
    if (options.activeDecisionDate) {
      const found = metaWindows.findIndex((window) => window.decision.date === options.activeDecisionDate);
      targetIndex = found >= 0 ? found : 0;
    } else if (options.activeIndex != null) {
      targetIndex = Math.min(Math.max(0, options.activeIndex), Math.max(0, metaWindows.length - 1));
    }
  }

  return metaWindows.map((window, index) => {
    if (targetIndex !== null && index !== targetIndex) {
      return { ...window, rows: [] };
    }
    const { decision, observationStart, windowEnd } = window;
    const startIdx = runDatesSorted ? firstDateIndex(payload.run_dates, observationStart, date => date) : 0;
    const endIdx = runDatesSorted ? upperDateIndex(payload.run_dates, windowEnd) : 0;
    const includedProviders = providers.filter((provider) => {
      if (eventsByProvider.has(provider)) return true;
      if (runDatesSorted) {
        const series = payload.banks[provider]?.[section];
        if (!series) return false;
        for (let i = startIdx; i < endIdx; i++) {
          if (series.median[i] != null || series.best[i] != null || series.count[i] != null) return true;
        }
        return false;
      }
      const dates = observations?.get(provider) ?? [];
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
        daysAfter: event ? cachedDaysBetween(decision.date, event.date) : null,
        direction: event?.dir ?? null,
        evidence: evidenceFor(section, provider, decision.date, windowEnd, event?.date ?? null),
      };
    });
    return { ...window, rows };
  });
}

export type BankResponseStatus = 'full' | 'partial' | 'none' | 'opposite';

/** Pass-through of the bank's first move against the RBA change, in basis points. */
export function bankResponseStatus(row: CompactBankResponseRow, decisionBps: number): BankResponseStatus | null {
  if (!decisionBps) return null;
  if (row.movePp == null) return row.evidence.reason === 'no-recorded-move' ? 'none' : null;
  const moveBps = row.movePp * 100;
  if (moveBps === 0) return 'none';
  if (Math.sign(moveBps) !== Math.sign(decisionBps)) return 'opposite';
  return Math.abs(moveBps) + 0.5 >= Math.abs(decisionBps) ? 'full' : 'partial';
}

export function bankResponseDecisionLabel(decision: RbaDecisionEntry): string {
  if (decision.outcome === 'hold') return `RBA held at ${decision.rate.toFixed(2)}%`;
  const move = `${decision.delta_bps > 0 ? '+' : '−'}${Math.abs(decision.delta_bps)} bp`;
  return `RBA ${move} to ${decision.rate.toFixed(2)}%`;
}
