import { matchesMortgageFacet } from './mortgageFacets';
import * as compiler from '../../contracts/history-ready/compiler-manifest.json';
import { SECTION_KEYS, type SectionKey } from '../types';
import { normalizeProfileFilters, profileFeaturesForSection, PROFILE_FEATURE_OPTIONS } from './profile';
import { matchesLvrTier } from './lvrRange';
import type { HistoricalCatalogueFilters } from './historicalBankRateCatalogue';
import type { BankRateSnapshot, RateSummary } from './bankRateOverview';
import { validateHistoricalBankRateReady, type HistoricalBankRateReady } from './historicalBankRateReadyWire';

export interface ReadyHistorySource { ready: HistoricalBankRateReady; acceptedDates: readonly string[] }
const validated = new WeakSet<object>();
export function validateHistoricalBankRateReadyForApp(value: unknown): value is HistoricalBankRateReady {
  if (!value || typeof value !== 'object') return false;
  if (validated.has(value)) return true;
  if (!validateHistoricalBankRateReady(value, compiler.sha256)) return false;
  validated.add(value); return true;
}

function summary(counts: Map<number, number>): RateSummary {
  const values = [...counts].sort(([a], [b]) => a - b);
  let count = 0, sum = 0;
  for (const [rate, frequency] of values) { count += frequency; sum += rate * frequency; }
  const left = Math.floor((count - 1) / 2), right = Math.floor(count / 2);
  let seen = 0, low: number | undefined, high = 0;
  for (const [rate, frequency] of values) {
    seen += frequency;
    if (low === undefined && seen > left) low = rate;
    if (seen > right) { high = rate; break; }
  }
  return { min: values[0][0], max: values.at(-1)![0], mean: sum / count, median: (low! + high) / 2, count };
}

/** Aggregate only producer-classified cohorts. Unknown evidence, required
 * features and null structural values retain the original fail-closed rules. */
export function* historicalReadySnapshots(ready: HistoricalBankRateReady,
  filters: HistoricalCatalogueFilters): Generator<void, Record<string, BankRateSnapshot>> {
  const profile = normalizeProfileFilters(filters.profileFilters);
  const snapshots: Record<string, BankRateSnapshot> = Object.fromEntries(ready.run_dates.map(day => [day, {}]));
  for (const section of SECTION_KEYS.filter(section => filters.interests.includes(section))) {
    const lists = section === 'Mortgage' ? [profile.loanPurposes, profile.rateTypes, profile.repaymentTypes, profile.lvrTiers] :
      section === 'Savings' ? [profile.depositKinds] : [profile.interestPayments];
    let mask = 0;
    for (const feature of profileFeaturesForSection(profile, section)) mask |= 1 << PROFILE_FEATURE_OPTIONS[section].indexOf(feature);
    const events = ready.run_dates.map(() => new Map<string, Map<number, number>>());
    for (const [provider, dims, known, broad, features, timeline] of ready.sections[section]) {
      yield;
      if (lists.some((list, i) => section === 'Mortgage' && i === 3 ? !matchesLvrTier(dims[i], list) :
          section === 'Mortgage' && (i === 0 || i === 2) ? !matchesMortgageFacet(dims[i] ?? undefined, list, i === 0 ? 'purpose' : 'repayment') :
          list.length && (dims[i] === null || !list.includes(dims[i]!))) ||
          (!known ? !filters.includeNonStandard || mask !== 0 : (!filters.includeNonStandard && !broad) || (features & mask) !== mask)) continue;
      for (const [date, changes] of timeline) {
        if (date >= events.length) continue;
        const rates = events[date].get(provider) ?? new Map<number, number>();
        for (const [rate, delta] of changes) rates.set(rate, (rates.get(rate) ?? 0) + delta);
        events[date].set(provider, rates);
      }
    }
    const banks = new Map<string, Map<number, number>>(), totals = new Map<number, number>();
    let current: Record<string, RateSummary> = {}, total: RateSummary | undefined;
    for (let date = 0; date < events.length; date++) {
      if (events[date].size) {
        current = { ...current }; let totalChanged = false;
        for (const [provider, changes] of events[date]) {
          const counts = banks.get(provider) ?? new Map<number, number>(); let changed = false;
          for (const [rate, delta] of changes) if (delta) {
            changed = true; totalChanged = true;
            const count = (counts.get(rate) ?? 0) + delta, pooled = (totals.get(rate) ?? 0) + delta;
            if (count) counts.set(rate, count); else counts.delete(rate);
            if (pooled) totals.set(rate, pooled); else totals.delete(rate);
          }
          banks.set(provider, counts);
          if (changed) {
            if (counts.size) Object.defineProperty(current, provider, { value: summary(counts), enumerable: true, configurable: true, writable: true });
            else delete current[provider];
          }
          yield;
        }
        if (totalChanged) total = totals.size ? summary(totals) : undefined;
      }
      const snapshot = snapshots[ready.run_dates[date]];
      snapshot[section as SectionKey] = current;
      if (total) (snapshot.sectionTotals ??= {})[section] = total;
      yield;
    }
  }
  return snapshots;
}
