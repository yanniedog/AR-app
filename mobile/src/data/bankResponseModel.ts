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

function firstEvent(
  events: BankRateEvent[], provider: string, section: SectionKey, start: string, end: string,
): BankRateEvent | null {
  return events
    .filter((event) => event.provider === provider && event.section === section && event.date >= start && event.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
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
  return decisions.map((decision, index) => {
    const next = decisions[index + 1];
    const windowEnd = next ? dayBefore(next.date) : payload.run_date;
    const observationStart = decision.date < ledgerStart ? ledgerStart : decision.date;
    const partialHistory = observationStart !== decision.date;
    const providers = Object.entries(payload.banks)
      .filter(([, sections]) => Boolean(sections[section]))
      .map(([provider]) => provider)
      .sort((a, b) => a.localeCompare(b));
    const rows = providers.map((provider) => {
      const event = firstEvent(payload.events, provider, section, observationStart, windowEnd);
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
