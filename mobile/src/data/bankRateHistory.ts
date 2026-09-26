import { SECTION_KEYS, type CorePayload, type SectionKey, type RateRow } from '../types';
import type { PackedBankRateHistory } from './bankRateHistoryWire';
import { attachBankRateHistoryTiers } from './bankRateHistoryWire';
import { isValidCalendarDate } from '../lib/calendarDate';
import { RATE_OBSERVATION_FIELDS, snapshotBankRates, summarizeBankRates, type BankRateScope, type BankRateSnapshot, type RateSummary } from './bankRateOverview';

const verified = new WeakMap<CorePayload, PackedBankRateHistory | null>();
const calculated = new WeakMap<CorePayload, Map<string, Record<string, BankRateSnapshot>>>();
const supplementary = new WeakMap<CorePayload, { pack: PackedBankRateHistory; ids: WeakMap<RateRow, number>; missing: readonly string[] }>();

/** A verified projection binds to these exact normalized rows, independently of
 * producer IDs assigned before quarantine. Shared eligibility identities stay intact. */
export function installSupplementaryBankRateHistory(core: CorePayload, pack: PackedBankRateHistory, missing: readonly string[] = []): boolean {
  const candidate = attachBankRateHistoryTiers({ ...core, bank_rate_history: pack });
  if (!packedBankRateHistory(candidate)) return false;
  const ids = new WeakMap<RateRow, number>();
  for (const section of SECTION_KEYS) core.sections[section].rates.forEach((row, index) => ids.set(row, pack.row_tiers[section][index]));
  supplementary.set(core, { pack, ids, missing });
  calculated.delete(core);
  return true;
}

export function clearSupplementaryBankRateHistory(core: CorePayload): void {
  supplementary.delete(core);
  calculated.delete(core);
}

export function availableBankRateHistory(core: CorePayload): PackedBankRateHistory | null {
  return packedBankRateHistory(core) ?? supplementary.get(core)?.pack ?? null;
}

export function missingBankRateHistoryDates(core: CorePayload): readonly string[] {
  return packedBankRateHistory(core) ? [] : supplementary.get(core)?.missing ?? [];
}
function sameTier(left: RateRow, right: RateRow): boolean {
  const a = Object.entries(left).filter(([key]) => !RATE_OBSERVATION_FIELDS.has(key));
  const b = Object.keys(right).filter(key => !RATE_OBSERVATION_FIELDS.has(key));
  return a.length === b.length && a.every(([key, value]) => value === right[key as keyof RateRow]);
}
/** History shares the core's verified hash, transport and offline cache. */
export function packedBankRateHistory(core: CorePayload): PackedBankRateHistory | null {
  if (verified.has(core)) return verified.get(core)!;
  const pack = core.bank_rate_history;
  let cells = 0, tiers = 0;
  const valid = pack?.schema_version === 1 && Array.isArray(pack.run_dates) && pack.run_dates.length > 0 &&
    pack.run_dates.length <= 5000 && pack.run_dates.at(-1) === core.run_date &&
    pack.run_dates.every((day, i) => isValidCalendarDate(day) && (!i || day > pack.run_dates[i - 1])) &&
    SECTION_KEYS.every(section => {
      const series = pack.sections?.[section];
      if (!Array.isArray(series) || (tiers += series.length) > 100_000) return false;
      const bindings = new Map<number, RateRow>();
      for (const row of core.sections[section].rates) {
        const id = row.bank_rate_tier;
        if (!Number.isInteger(id) || id! < 0 || id! >= series.length) return false;
        const previous = bindings.get(id!);
        if (previous && !sameTier(previous, row)) return false;
        bindings.set(id!, row);
      }
      return series.every(spans => {
        if (!Array.isArray(spans)) return false;
        let end = 0;
        return spans.every(span => {
          if (!Array.isArray(span) || span.length !== 3) return false;
          const [start, count, rates] = span;
          if (!Number.isInteger(start) || !Number.isInteger(count) || start < end || count < 1 ||
              start + count > pack.run_dates.length || !Array.isArray(rates) || !rates.length ||
              rates.length > 10_000 || !rates.every(rate => typeof rate === 'number' && Number.isFinite(rate) && rate >= 0)) return false;
          end = start + count;
          cells += count * rates.length;
          return cells <= 10_000_000;
        });
      });
    });
  verified.set(core, valid ? pack! : null);
  return valid ? pack! : null;
}

/** Exact weighted statistics from rate frequencies, without expanding tier rows. */
function summarizeCounts(counts: Map<number, number>): RateSummary {
  const ordered = [...counts].sort(([a], [b]) => a - b);
  let count = 0, sum = 0;
  for (const [rate, frequency] of ordered) { count += frequency; sum += rate * frequency; }
  const left = Math.floor((count - 1) / 2), right = Math.floor(count / 2);
  let seen = 0, low: number | undefined, high = 0;
  for (const [rate, frequency] of ordered) {
    seen += frequency;
    if (low === undefined && seen > left) low = rate;
    if (seen > right) { high = rate; break; }
  }
  return { min: ordered[0][0], max: ordered.at(-1)![0], mean: sum / count, median: (low! + high) / 2, count };
}

function sectionSnapshots(pack: PackedBankRateHistory, section: SectionKey, members: Map<number, string>) {
  const events = pack.run_dates.map(() => new Map<string, Map<number, number>>());
  const add = (index: number, provider: string, rates: number[], direction: number) => {
    if (index >= events.length) return;
    const changes = events[index].get(provider) ?? new Map<number, number>();
    for (const value of rates) changes.set(value, (changes.get(value) ?? 0) + direction);
    events[index].set(provider, changes);
  };
  for (const [id, provider] of members) for (const [start, count, rates] of pack.sections[section][id]) {
    add(start, provider, rates, 1); add(start + count, provider, rates, -1);
  }
  const banks = new Map<string, Map<number, number>>();
  let current: Record<string, RateSummary> = {};
  return events.map(changesByBank => {
    if (!changesByBank.size) return current;
    current = { ...current };
    for (const [provider, changes] of changesByBank) {
      const counts = banks.get(provider) ?? new Map<number, number>();
      let changed = false;
      for (const [rate, delta] of changes) if (delta) {
        changed = true;
        const count = (counts.get(rate) ?? 0) + delta;
        if (count) counts.set(rate, count); else counts.delete(rate);
      }
      banks.set(provider, counts);
      if (changed) {
        if (counts.size) current[provider] = summarizeCounts(counts); else delete current[provider];
      }
    }
    return current;
  });
}

/** One complete local calculation, with no per-date requests or partial renders. */
export function packedBankRateSnapshots(core: CorePayload, scope: BankRateScope): Record<string, BankRateSnapshot> {
  const pack = availableBankRateHistory(core);
  const result: Record<string, BankRateSnapshot> = {};
  if (pack) {
    const rowKeys: string[] = [];
    const currentRows = { Mortgage: [], Savings: [], TD: [] } as BankRateScope['rows'];
    const members = SECTION_KEYS.map(section => {
      const admitted = new Map(core.sections[section].rates.map((row, index) => [row, index]));
      const rows = scope.rows[section].filter(row => admitted.has(row));
      currentRows[section] = rows;
      rowKeys.push(rows.map(row => admitted.get(row)).join(','));
      const bound = packedBankRateHistory(core) ? null : supplementary.get(core);
      return new Map(rows.map(row => [bound ? bound.ids.get(row)! : row.bank_rate_tier!, row.provider]));
    });
    const key = rowKeys.join('|');
    const cache = calculated.get(core) ?? new Map<string, Record<string, BankRateSnapshot>>();
    if (cache.has(key)) return cache.get(key)!;
    for (const day of pack.run_dates) result[day] = {};
    SECTION_KEYS.forEach((section, sectionIndex) => {
      const days = sectionSnapshots(pack, section, members[sectionIndex]);
      days.forEach((banks, index) => {
        result[pack.run_dates[index]][section] = banks;
      });
    });
    result[core.run_date] = Object.fromEntries(SECTION_KEYS.map(section => [section, summarizeBankRates(currentRows[section])]));
    if (cache.size >= 8) cache.delete(cache.keys().next().value!);
    cache.set(key, result); calculated.set(core, cache);
    return result;
  }
  result[core.run_date] = snapshotBankRates(scope);
  return result;
}
