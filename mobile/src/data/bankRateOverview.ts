import type { CorePayload, RateRow, SectionKey } from '../types';
import { SECTION_KEYS } from '../types';
import { toFraction } from './format';
import type { RbaCalendar } from './rbaCalendar';

export type RateStatistic = 'min' | 'mean' | 'median' | 'max';
export interface RateSummary { min: number; mean: number; median: number; max: number; count: number }
export type BankRateSnapshot = Partial<Record<SectionKey, Record<string, RateSummary>>>;
export interface BankRateScope { rows: Record<SectionKey, RateRow[]>; signatures: Record<SectionKey, Set<string>> }
export const RATE_OBSERVATION_FIELDS = new Set(['rate', 'comparison_rate', 'ongoing_rate', 'last_updated', 'rate_index', 'exact_alert_eligible', 'bank_rate_tier']);
export interface BankRatePoint { date: string; value: number; count: number }
export interface BankRateChartModel {
  dates: string[];
  lines: { provider: string; points: BankRatePoint[] }[];
  decisions: NonNullable<RbaCalendar>['decisions'];
  min: number;
  max: number;
}

/** Match exact currently eligible tiers, never a product's unfiltered best rate.
 * Descriptive changes break continuity conservatively; only rate/observation
 * metadata may change without changing the tier's scope. */
export function rateTierSignature(row: RateRow): string {
  return JSON.stringify(Object.entries(row)
    .filter(([key]) => !RATE_OBSERVATION_FIELDS.has(key))
    .sort(([a], [b]) => a.localeCompare(b)));
}

export function bankRateScope(rows: Record<SectionKey, RateRow[]>): BankRateScope {
  let signatures: BankRateScope['signatures'] | undefined;
  return { rows, get signatures() {
    return signatures ??= Object.fromEntries(SECTION_KEYS.map(section =>
      [section, new Set(rows[section].map(rateTierSignature))])) as BankRateScope['signatures'];
  } };
}

export function summarizeBankRates(rows: RateRow[]): Record<string, RateSummary> {
  const banks = new Map<string, number[]>();
  for (const row of rows) {
    const value = toFraction(row.rate);
    if (value == null || !Number.isFinite(value) || value < 0) continue;
    const values = banks.get(row.provider) ?? [];
    values.push(value * 100); banks.set(row.provider, values);
  }
  return Object.fromEntries([...banks].map(([provider, values]) => [provider, summarizeRateValues(values)]));
}

/** Values are percentage points; the caller owns this array. */
export function summarizeRateValues(values: number[]): RateSummary {
  values.sort((a, b) => a - b);
  const middle = values.length >> 1;
  return { min: values[0], max: values.at(-1)!,
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    median: values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2,
    count: values.length };
}

export function snapshotBankRates(scope: BankRateScope, historicalCore?: CorePayload): BankRateSnapshot {
  return Object.fromEntries(SECTION_KEYS.map(section => [section, summarizeBankRates(historicalCore
    ? historicalCore.sections[section].rates.filter(row => scope.signatures[section].has(rateTierSignature(row)))
    : scope.rows[section])]));
}

export function buildBankRateChart(
  snapshots: Record<string, BankRateSnapshot>, section: SectionKey, statistic: RateStatistic,
  gap: boolean, calendar: RbaCalendar | null,
): BankRateChartModel {
  const dates = Object.keys(snapshots).sort();
  const byBank = new Map<string, BankRatePoint[]>();
  for (const date of dates) {
    const snapshot = snapshots[date];
    for (const [provider, stats] of Object.entries(snapshot[gap ? 'Mortgage' : section] ?? {})) {
      const savings = snapshot.Savings?.[provider];
      if (gap && !savings) continue;
      const points = byBank.get(provider) ?? [];
      points.push({ date, value: gap ? stats.mean - savings!.mean : stats[statistic],
        count: gap ? stats.count + savings!.count : stats.count });
      byBank.set(provider, points);
    }
  }
  const lines = [...byBank].map(([provider, points]) => ({ provider, points })).sort((a, b) => a.provider.localeCompare(b.provider));
  let min = Infinity, max = -Infinity;
  for (const line of lines) for (const point of line.points) { min = Math.min(min, point.value); max = Math.max(max, point.value); }
  const padding = Math.max(0.05, (max - min) * 0.08);
  return { dates, lines, min: lines.length ? min - padding : 0, max: lines.length ? max + padding : 1,
    decisions: (calendar?.decisions ?? []).filter(d => d.date >= dates[0] && d.date <= dates.at(-1)!) };
}
