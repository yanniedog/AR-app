import { SECTION_KEYS, type SectionKey } from '../types';
import { isValidCalendarDate } from '../lib/calendarDate';
import { validateHistoricalCatalogueSource, type HistoricalCatalogueSource } from './historicalBankRateCatalogueWire';
import { MAX_BANK_RATE_PERCENT } from './bankRateOverview';
import { PROFILE_FEATURE_OPTIONS } from './profile';

export const READY_SEMANTIC_REVISION = 'ar-history-ready-v1';
export const READY_HISTORY_LIMITS = { days: 5000, cohorts: 20_000, products: 100_000, events: 500_000,
  changes: 1_000_000, cells: 10_000_000, decodedBytes: 4 * 1024 * 1024 } as const;
export type ReadyHistoryEvent = [date: number, changes: [rate: number, delta: number][]];
export type ReadyHistoryCohort = [provider: string, dimensions: (string | null)[], known: boolean,
  broad: boolean, features: number, events: ReadyHistoryEvent[]];
export type ReadyProductRates = Record<SectionKey, [productKey: string, spans: [start: number, count: number, best: number][]][]>;
export interface HistoricalBankRateReady {
  schema_version: 1;
  semantic_revision: typeof READY_SEMANTIC_REVISION;
  compiler_sha256: string;
  run_dates: string[];
  sources: Record<string, HistoricalCatalogueSource>;
  unavailable_dates: Record<string, string>;
  quarantined_tier_count: number;
  sections: Record<SectionKey, ReadyHistoryCohort[]>;
  products: ReadyProductRates;
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const exact = (value: Record<string, unknown>, names: readonly string[]) => Object.keys(value).length === names.length && names.every(key => Object.hasOwn(value, key));
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 65_536;
const rate = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_BANK_RATE_PERCENT;

/** Validate producer-prepared counts, conservation and provenance before they
 * can reach profile filters. The app supplies its pinned compiler digest. */
export function validateHistoricalBankRateReady(value: unknown, expectedCompilerSha?: string): value is HistoricalBankRateReady {
  if (!record(value) || !exact(value, ['schema_version', 'semantic_revision', 'compiler_sha256', 'run_dates', 'sources',
    'unavailable_dates', 'quarantined_tier_count', 'sections', 'products']) || value.schema_version !== 1 ||
      value.semantic_revision !== READY_SEMANTIC_REVISION || typeof value.compiler_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.compiler_sha256) ||
      (expectedCompilerSha !== undefined && value.compiler_sha256 !== expectedCompilerSha) ||
      !Array.isArray(value.run_dates) || !value.run_dates.length || value.run_dates.length > READY_HISTORY_LIMITS.days ||
      !record(value.sources) || !record(value.unavailable_dates) || !record(value.sections) || !exact(value.sections, SECTION_KEYS) ||
      !record(value.products) || !exact(value.products, SECTION_KEYS) || !Number.isSafeInteger(value.quarantined_tier_count) ||
      Number(value.quarantined_tier_count) < 0 || Number(value.quarantined_tier_count) > 100_000) return false;
  const dates = value.run_dates;
  if (!dates.every((day, index) => isValidCalendarDate(day) && (!index || Date.parse(day) - Date.parse(dates[index - 1]) === 86_400_000))) return false;
  const axis = new Set(dates);
  if (!Object.entries(value.sources).every(([day, source]) => axis.has(day) && validateHistoricalCatalogueSource(source)) ||
      !Object.entries(value.unavailable_dates).every(([day, reason]) => axis.has(day) && text(reason))) return false;
  const absent = [0];
  for (const day of dates) absent.push(absent.at(-1)! + (!Object.hasOwn(value.sources, day) || Object.hasOwn(value.unavailable_dates, day) ? 1 : 0));
  let cohorts = 0, events = 0, changes = 0, cells = 0, products = 0, productSpans = 0, productCells = 0;
  for (const section of SECTION_KEYS) {
    const items = value.sections[section], rows = value.products[section];
    if (!Array.isArray(items) || (cohorts += items.length) > READY_HISTORY_LIMITS.cohorts || !Array.isArray(rows) ||
        (products += rows.length) > READY_HISTORY_LIMITS.products) return false;
    const identities = new Set<string>();
    for (const item of items) {
      if (!Array.isArray(item) || item.length !== 6) return false;
      const [provider, dimensions, known, broad, features, timeline] = item;
      if (!text(provider) || !Array.isArray(dimensions) || dimensions.length !== (section === 'Mortgage' ? 4 : 1) ||
          !dimensions.every(dim => dim === null || (typeof dim === 'string' && dim.length <= 65_536)) ||
          typeof known !== 'boolean' || typeof broad !== 'boolean' || !Number.isSafeInteger(features) || features < 0 ||
          features >= 2 ** PROFILE_FEATURE_OPTIONS[section].length || (!known && (broad || features)) ||
          !Array.isArray(timeline) || !timeline.length || (events += timeline.length) > READY_HISTORY_LIMITS.events) return false;
      const identity = JSON.stringify(item.slice(0, 5));
      if (identities.has(identity)) return false;
      identities.add(identity);
      const counts = new Map<number, number>();
      let previousDate = -1, total = 0;
      for (const event of timeline) {
        if (!Array.isArray(event) || event.length !== 2) return false;
        const [date, deltas] = event;
        if (!Number.isSafeInteger(date) || date <= previousDate || date > dates.length || !Array.isArray(deltas) ||
            !deltas.length || (changes += deltas.length) > READY_HISTORY_LIMITS.changes) return false;
        if (total && (absent[date] !== absent[previousDate] || (cells += (date - previousDate) * total) > READY_HISTORY_LIMITS.cells)) return false;
        let previousRate = -1;
        for (const delta of deltas) {
          if (!Array.isArray(delta) || delta.length !== 2 || !rate(delta[0]) || delta[0] <= previousRate ||
              !Number.isSafeInteger(delta[1]) || !delta[1] || Math.abs(delta[1]) > READY_HISTORY_LIMITS.cells) return false;
          const next = (counts.get(delta[0]) ?? 0) + delta[1];
          if (next < 0 || next > READY_HISTORY_LIMITS.cells) return false;
          if (next) counts.set(delta[0], next); else counts.delete(delta[0]);
          total += delta[1]; previousRate = delta[0];
        }
        if (total < 0 || total > READY_HISTORY_LIMITS.cells) return false;
        previousDate = date;
      }
      if (total !== 0 || counts.size) return false;
    }
    const productKeys = new Set<string>();
    for (const row of rows) {
      if (!Array.isArray(row) || row.length !== 2 || !text(row[0]) || productKeys.has(row[0]) || !Array.isArray(row[1]) ||
          !row[1].length || (productSpans += row[1].length) > READY_HISTORY_LIMITS.events) return false;
      productKeys.add(row[0]); let end = 0;
      for (const span of row[1]) {
        if (!Array.isArray(span) || span.length !== 3 || !Number.isSafeInteger(span[0]) || !Number.isSafeInteger(span[1]) ||
            span[0] < end || span[1] < 1 || span[0] + span[1] > dates.length || !rate(span[2]) ||
            absent[span[0] + span[1]] !== absent[span[0]] || (productCells += span[1]) > READY_HISTORY_LIMITS.cells) return false;
        end = span[0] + span[1];
      }
    }
  }
  return true;
}
