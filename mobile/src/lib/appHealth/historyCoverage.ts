import { SECTION_KEYS, type CorePayload, type SectionKey } from '../../types';
import { getMandatoryEligibilityRevision } from '../../data/eligibilityGate';
import { getSuitabilityRevision } from '../../data/suitabilityGate';
import { hobartCalendarDate } from '../nextIngest';
import { productSeriesRecordForChart, type ProductHistoryPayload } from '../../data/productHistoryModel';
import { toFraction } from '../../data/rateNumbers';
import { EMPTY_PROFILE } from '../../data/profile';
import { bankRateScope, buildBankRateChart, type BankRateSnapshot, type RateSummary } from '../../data/bankRateOverview';
import { cachedHistoricalBankRateCatalogue } from '../../data/historicalBankRateCatalogueStore';
import { historicalBankRateSnapshots, historicalCatalogueSelection, preparedReadySources,
  type PreparedHistoricalBankRateCatalogue } from '../../data/historicalBankRateCatalogue';

export interface HistoryCoverageEvidence {
  available: boolean;
  runDate: string;
  observedDay?: string;
  days: number;
  sourceGapDays: string[];
  /** Every date/reason is retained; no sampling or truncation. */
  gaps: [date: string, reason: string, section: SectionKey | null, count: number, provider?: string][];
  processingMismatches: number;
  chartProjectionMismatches: number;
  historicalPixelsVerified: false;
}

/** Independent weighted statistics from raw source events. No production reducer. */
function independentStats(values: Map<number, number>): RateSummary | null {
  const entries = [...values].filter(([, count]) => count > 0).sort(([a], [b]) => a - b);
  const count = entries.reduce((total, [, n]) => total + n, 0);
  if (!count) return null;
  let cumulative = 0, low = 0, high = 0;
  const left = Math.floor((count - 1) / 2), right = Math.floor(count / 2);
  for (const [value, n] of entries) {
    if (cumulative <= left && cumulative + n > left) low = value;
    if (cumulative <= right && cumulative + n > right) high = value;
    cumulative += n;
  }
  return { count, min: entries[0][0], max: entries.at(-1)![0], median: (low + high) / 2,
    mean: entries.reduce((total, [value, n]) => total + value * n, 0) / count };
}

function sourceSnapshots(prepared: PreparedHistoricalBankRateCatalogue): Record<string, BankRateSnapshot> {
  const result: Record<string, BankRateSnapshot> = Object.fromEntries(prepared.catalogue.run_dates.map(day => [day, {}]));
  const reduce = (dates: readonly string[], section: SectionKey,
    add: (emit: (date: number, provider: string, rate: number, delta: number) => void) => void,
    accepted: ReadonlySet<string>) => {
    const events = dates.map(() => new Map<string, Map<number, number>>());
    add((date, provider, rate, delta) => {
      if (date >= dates.length) return;
      const bank = events[date].get(provider) ?? new Map<number, number>();
      bank.set(rate, (bank.get(rate) ?? 0) + delta); events[date].set(provider, bank);
    });
    const banks = new Map<string, Map<number, number>>();
    let current: Record<string, RateSummary> = {};
    dates.forEach((day, index) => {
      if (events[index].size) {
        current = { ...current };
        for (const [provider, changes] of events[index]) {
          const values = banks.get(provider) ?? new Map<number, number>();
          for (const [rate, delta] of changes) {
            const next = (values.get(rate) ?? 0) + delta;
            if (next) values.set(rate, next); else values.delete(rate);
          }
          banks.set(provider, values);
          const stats = independentStats(values);
          if (stats) Object.defineProperty(current, provider, { value: stats, enumerable: true, configurable: true, writable: true });
          else delete current[provider];
        }
      }
      if (accepted.has(day) && result[day]) result[day][section] = current;
    });
  };
  const ready = preparedReadySources(prepared);
  if (ready) {
    for (const source of ready) for (const section of SECTION_KEYS) reduce(source.ready.run_dates, section, emit => {
      for (const cohort of source.ready.sections[section]) for (const [date, changes] of cohort[5])
        for (const [rate, delta] of changes) emit(date, cohort[0], rate, delta);
    }, new Set(source.acceptedDates));
  } else for (const section of SECTION_KEYS) reduce(prepared.catalogue.run_dates, section, emit => {
    for (const tier of prepared.catalogue.sections[section]) for (const [start, count, rates] of tier.spans)
      for (const rate of rates) { emit(start, tier.row.provider, rate, 1); emit(start + count, tier.row.provider, rate, -1); }
  }, new Set(prepared.catalogue.run_dates));
  const selection = historicalCatalogueSelection(prepared);
  if (selection?.fallback) {
    const fallback = sourceSnapshots(selection.fallback);
    for (const day of Object.keys(result)) if (!selection.dates.has(day) && fallback[day]) result[day] = fallback[day];
  }
  return result;
}

function unknownMetadata(prepared: PreparedHistoricalBankRateCatalogue): Record<string, Record<SectionKey, number>> {
  const result = Object.fromEntries(prepared.catalogue.run_dates.map(day => [day, { Mortgage: 0, Savings: 0, TD: 0 }]));
  const ready = preparedReadySources(prepared);
  if (ready) for (const source of ready) {
    const accepted = new Set(source.acceptedDates);
    for (const section of SECTION_KEYS) {
      const deltas = new Float64Array(source.ready.run_dates.length + 1);
      for (const cohort of source.ready.sections[section]) if (!cohort[2]) for (const [date, changes] of cohort[5])
        for (const [, delta] of changes) deltas[date] += delta;
      let count = 0;
      source.ready.run_dates.forEach((day, index) => { count += deltas[index]; if (accepted.has(day) && result[day]) result[day][section] = count; });
    }
  } else for (const section of SECTION_KEYS) {
    const deltas = new Float64Array(prepared.catalogue.run_dates.length + 1);
    for (const tier of prepared.catalogue.sections[section]) for (const [start, count, rates, evidenceId] of tier.spans)
      if (prepared.catalogue.evidence[evidenceId]?.status !== 'known') { deltas[start] += rates.length; deltas[start + count] -= rates.length; }
    let count = 0;
    prepared.catalogue.run_dates.forEach((day, index) => { count += deltas[index]; result[day][section] = count; });
  }
  const selection = historicalCatalogueSelection(prepared);
  if (selection?.fallback) {
    const fallback = unknownMetadata(selection.fallback);
    for (const day of Object.keys(result)) if (!selection.dates.has(day) && fallback[day]) result[day] = fallback[day];
  }
  return result;
}

/** Every retained product series is checked, including explicit null gaps. */
function auditProductHistory(core: CorePayload, history: ProductHistoryPayload | null,
  prepared: PreparedHistoricalBankRateCatalogue | null, result: HistoryCoverageEvidence): void {
  const current = new Map<string, { section: SectionKey; rate: number }>();
  for (const section of SECTION_KEYS) for (const row of core.sections[section].rates) {
    const rate = toFraction(row.rate);
    if (rate == null || !Number.isFinite(rate) || rate < 0) continue;
    const previous = current.get(row.product_key);
    if (!previous || (section === 'Mortgage' ? rate < previous.rate : rate > previous.rate)) current.set(row.product_key, { section, rate });
  }
  if (!history) {
    result.gaps.push([core.run_date, 'product-history-not-loaded', null, current.size]);
    return;
  }
  const axis = [...new Set([...history.run_dates, ...(prepared?.catalogue.run_dates ?? []), core.run_date])].sort();
  const dates = new Map(history.run_dates.map((day, index) => [day, index]));
  for (const day of axis) if (day <= core.run_date && !dates.has(day)) result.gaps.push([day, 'product-history-date-unavailable', null, 1]);
  for (const key of new Set([...Object.keys(history.products), ...current.keys()])) {
    const selected = current.get(key), raw = history.products[key];
    const chart = productSeriesRecordForChart(history, key, axis, core.run_date, selected?.rate);
    for (const day of axis) {
      const index = dates.get(day);
      const retained = index === undefined ? null : raw?.[index] ?? null;
      const expected = retained ?? (day === core.run_date ? selected?.rate ?? null : null);
      if (chart[day] !== expected) {
        result.gaps.push([day, 'product-model-to-chart-mismatch', selected?.section ?? null, 1, key]); result.chartProjectionMismatches++;
      }
      if (day === core.run_date && selected && retained != null && Math.abs(retained - selected.rate) > 1e-9) {
        result.gaps.push([day, 'current-product-rate-mismatch', selected.section, 1, key]); result.processingMismatches++;
      }
    }
  }
  const compareSource = (source: PreparedHistoricalBankRateCatalogue, selectedDates?: ReadonlySet<string>) => {
    const ready = preparedReadySources(source);
    const selection = historicalCatalogueSelection(source);
    if (selection?.fallback) compareSource(selection.fallback, new Set(selection.fallback.catalogue.run_dates.filter(day => !selection.dates.has(day) && (!selectedDates || selectedDates.has(day)))));
    const owns = (day: string) => day < core.run_date && Boolean(source.catalogue.sources[day]) && !source.catalogue.unavailable_dates[day] && (!selectedDates || selectedDates.has(day)) && (!selection || selection.dates.has(day));
    if (!ready) {
      for (const day of source.catalogue.run_dates) if (owns(day) && source.catalogue.sources[day] && !source.catalogue.unavailable_dates[day])
        result.gaps.push([day, 'product-source-reconciliation-unavailable', null, 1]);
      return;
    }
    for (const input of ready) {
      const accepted = new Set(input.acceptedDates);
      for (const section of SECTION_KEYS) for (const [key, spans] of input.ready.products[section]) for (const [start, count, rate] of spans)
        for (let index = start; index < start + count; index++) {
          const day = input.ready.run_dates[index];
          if (!accepted.has(day) || !owns(day)) continue;
          const position = dates.get(day), actual = position === undefined ? null : history.products[key]?.[position] ?? null;
          if (actual == null || !Number.isFinite(actual) || Math.abs(actual - rate / 100) > 1e-9) {
            result.gaps.push([day, 'product-source-to-model-mismatch', section, 1, key]); result.processingMismatches++;
          }
        }
    }
  };
  if (prepared) compareSource(prepared);
}

const retained = new WeakMap<CorePayload, { prepared: PreparedHistoricalBankRateCatalogue | null;
  revision: string; productHistory: ProductHistoryPayload | null; result: HistoryCoverageEvidence }>();

/** Check every loaded historical date and all four bank-chart statistics.
 * This proves model projection, while foreground probes prove sampled pixels.
 * No fetch, raw archive preparation, profile changes or cache writes occur here.
 */
export function historyCoverageEvidence(core: CorePayload, productHistory: ProductHistoryPayload | null = null, nowMs = Date.now()): HistoryCoverageEvidence {
  const prepared = cachedHistoricalBankRateCatalogue(core);
  const observedDay = hobartCalendarDate(nowMs);
  const revision = `${getMandatoryEligibilityRevision()}:${getSuitabilityRevision()}:${observedDay}`;
  const cached = retained.get(core);
  if (cached?.prepared === prepared && cached.revision === revision && cached.productHistory === productHistory) return cached.result;
  const result: HistoryCoverageEvidence = { available: Boolean(prepared), runDate: core.run_date, observedDay,
    days: 0, sourceGapDays: [], gaps: [], processingMismatches: 0, chartProjectionMismatches: 0,
    historicalPixelsVerified: false };
  const missingCurrentDays = Math.floor((Date.parse(observedDay) - Date.parse(core.run_date)) / 86_400_000);
  if (missingCurrentDays > 5000) result.gaps.push([observedDay, 'date-axis-unverifiable', null, missingCurrentDays]);
  else for (let offset = 1; offset <= missingCurrentDays; offset++) {
    const day = new Date(Date.parse(core.run_date) + offset * 86_400_000).toISOString().slice(0, 10);
    result.sourceGapDays.push(day); result.gaps.push([day, 'current-payload-stale', null, 1]);
  }
  auditProductHistory(core, productHistory, prepared, result);
  if (!prepared) {
    result.gaps.push([core.run_date, 'historical-source-not-loaded', null, 1]);
    retained.set(core, { prepared, revision, productHistory, result });
    return result;
  }
  const catalogue = prepared.catalogue;
  const scope = bankRateScope(Object.fromEntries(SECTION_KEYS.map(section => [section, core.sections[section].rates])) as Record<SectionKey, typeof core.sections.Mortgage.rates>);
  const snapshots = historicalBankRateSnapshots(prepared, core, scope,
    { profileFilters: EMPTY_PROFILE, interests: SECTION_KEYS, includeNonStandard: true });
  for (const [day, sections] of Object.entries(unknownMetadata(prepared))) if (day < core.run_date && catalogue.sources[day] && !catalogue.unavailable_dates[day])
    for (const section of SECTION_KEYS) if (sections[section]) result.gaps.push([day, 'historical-detail-evidence-unknown', section, sections[section]]);
  if (prepared.quarantinedTierCount) result.gaps.push([core.run_date, 'historical-quarantined-tiers', null, prepared.quarantinedTierCount]);
  reconcileHistoryCoverage(result, catalogue.run_dates, catalogue.sources, catalogue.unavailable_dates,
    sourceSnapshots(prepared), snapshots);
  retained.set(core, { prepared, revision, productHistory, result });
  return result;
}

export function reconcileHistoryCoverage(result: HistoryCoverageEvidence, dates: readonly string[],
  sources: Readonly<Record<string, unknown>>, unavailable: Readonly<Record<string, string>>,
  expected: Record<string, BankRateSnapshot>, snapshots: Record<string, BankRateSnapshot>): HistoryCoverageEvidence {
  const first = [...dates, result.runDate].sort()[0];
  const length = Math.floor((Date.parse(result.observedDay && result.observedDay > result.runDate ? result.observedDay : result.runDate) - Date.parse(first)) / 86_400_000) + 1;
  if (!Number.isSafeInteger(length) || length < 1 || length > 5000) {
    result.available = false;
    result.processingMismatches++;
    result.gaps.push([result.runDate, 'date-axis-unverifiable', null, Number.isFinite(length) ? length : 0]);
    return result;
  }
  const allDates = Array.from({ length }, (_, index) => new Date(Date.parse(first) + index * 86_400_000).toISOString().slice(0, 10));
  result.days = allDates.length;
  for (const day of allDates) {
    // Today's source is the pinned core, independently reconciled by catalogue coverage.
    if (day < result.runDate && (!sources[day] || unavailable[day])) {
      result.sourceGapDays.push(day);
      result.gaps.push([day, 'historical-source-unavailable', null, 1]);
    }
    if (!snapshots[day]) {
      result.gaps.push([day, 'processed-day-missing', null, 1]);
      if (day === result.runDate || (sources[day] && !unavailable[day])) result.processingMismatches++;
      continue;
    }
    if (day !== result.runDate && sources[day] && !unavailable[day]) for (const section of SECTION_KEYS) {
      const raw = expected[day]?.[section] ?? {}, processed = snapshots[day][section] ?? {};
      for (const provider of new Set([...Object.keys(raw), ...Object.keys(processed)])) {
        const source = raw[provider], model = processed[provider];
        if (!source || !model || source.count !== model.count) {
          result.gaps.push([day, 'source-to-model-count-mismatch', section, (source?.count ?? 0) - (model?.count ?? 0), provider]);
          result.processingMismatches++;
        } else for (const field of ['min', 'mean', 'median', 'max'] as const) {
          const tolerance = Math.max(1, Math.abs(source[field])) * 1e-10;
          if (!Number.isFinite(model[field]) || Math.abs(source[field] - model[field]) > tolerance) {
            result.gaps.push([day, `source-to-model-${field}-mismatch`, section, 1, provider]);
            result.processingMismatches++;
          }
        }
      }
    }
  }
  for (const section of SECTION_KEYS) for (const statistic of ['min', 'mean', 'median', 'max'] as const) {
    const chart = buildBankRateChart(snapshots, section, statistic, false, null);
    const points = new Map(chart.lines.flatMap(line => line.points.map(point => [JSON.stringify([line.provider, point.date]), point] as const)));
    for (const day of allDates) for (const [provider, stats] of Object.entries(snapshots[day]?.[section] ?? {})) {
      const key = JSON.stringify([provider, day]);
      const point = points.get(key);
      if (!point || point.count !== stats.count || point.value !== stats[statistic]) {
        result.gaps.push([day, `model-to-chart-${statistic}-mismatch`, section, 1, provider]); result.chartProjectionMismatches++;
      }
      points.delete(key);
    }
    for (const [key, point] of points) { result.gaps.push([point.date, `unexpected-chart-${statistic}-point`, section, 1, (JSON.parse(key) as string[])[0]]); result.chartProjectionMismatches++; }
  }
  result.sourceGapDays = [...new Set(result.sourceGapDays)].sort();
  return result;
}
