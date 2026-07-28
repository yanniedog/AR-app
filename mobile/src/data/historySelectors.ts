import type {
  BankHistoryCache,
  BankHistoryChartModel,
  BankHistoryPoint,
  CorePayload,
  HistoryWindow,
  ProductDetail,
  RateRow,
  SectionKey,
} from '../types';
import type { BankInsightsPayload } from './bankInsights';
import { chartModelFromPrebuiltHistory, type HistoryBanksPayload } from './historyPayload';
import {
  alignPointsToTimeline,
  historyDatesInWindow,
  normalizeTimelineDates,
  sanitizeRibbonPoint,
  sliceChartTimeline,
} from './bankHistoryTransform';
import { debugLog } from '../lib/debugLog';
import { toFraction, visibleAccountRows } from './format';
import { getSuitabilityAllowed } from './suitabilityGate';
import { rowsUnder } from './taxonomy';

function medianOf(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

type AggSlot = {
  min: number;
  max: number;
  sum: number;
  count: number;
  rates: number[];
};

function accumulate(slot: AggSlot | undefined, rate: number): AggSlot {
  if (!slot) return { min: rate, max: rate, sum: rate, count: 1, rates: [rate] };
  slot.min = Math.min(slot.min, rate);
  slot.max = Math.max(slot.max, rate);
  slot.sum += rate;
  slot.count += 1;
  slot.rates.push(rate);
  return slot;
}

/** Build aggregate ribbon points from retained history rows (dashboard buildAggregateRibbon). */
export function buildAggregateRibbonFromHistory(
  historyRows: Array<RateRow & { run_date?: string }>,
  retainedRunDates: string[],
  window: HistoryWindow,
): { dates: string[]; points: BankHistoryPoint[]; allDates: string[] } {
  const sliceDates = new Set<string>();
  const byDate: Record<string, AggSlot> = {};

  for (const row of historyRows) {
    const date = String(row.run_date || '').slice(0, 10);
    const rate = toFraction(row.rate);
    if (!date || rate == null || rate <= 0) continue;
    sliceDates.add(date);
    byDate[date] = accumulate(byDate[date], rate);
  }

  const sliceDatesSorted = normalizeTimelineDates(Array.from(sliceDates));
  const timelineSource = retainedRunDates.length ? retainedRunDates : sliceDatesSorted;
  const dates = historyDatesInWindow(timelineSource, window);
  const points = dates.map((date) => {
    const agg = byDate[date];
    if (!agg) return { date, min: null, max: null, mean: null, median: null, count: 0 };
    return {
      date,
      min: agg.min,
      max: agg.max,
      mean: agg.sum / Math.max(1, agg.count),
      median: medianOf(agg.rates),
      count: agg.count,
    };
  });

  return {
    dates,
    points,
    allDates: timelineSource,
  };
}

function currentRibbonFallback(
  core: CorePayload,
  section: SectionKey,
  includeNonStandard: boolean,
  detailsProducts?: Record<string, ProductDetail> | null,
): BankHistoryChartModel | null {
  const sectionData = core.sections[section];
  if (!sectionData) return null;
  const hierRows = rowsUnder(sectionData.rates, section, []);
  const visibleRows = visibleAccountRows(hierRows, includeNonStandard, detailsProducts);
  if (!visibleRows.length) return null;

  const date = String(core.run_date || '').slice(0, 10);
  if (!date) return null;
  const aggregate = buildAggregateRibbonFromHistory(
    visibleRows.map((row) => ({ ...row, run_date: date })),
    [date],
    'All',
  );
  if (!aggregate.points[0]?.count) return null;
  const point = sanitizeRibbonPoint(date, aggregate.points[0]);
  if (point.min == null && point.max == null && point.mean == null) return null;

  return {
    section,
    dates: [date],
    points: [point],
    allDates: [date],
  };
}

export interface HistorySelectorState {
  core: CorePayload | null;
  historyBanks?: HistoryBanksPayload | null;
  historyCache?: BankHistoryCache | null;
  /**
   * Suitability-filtered bank intelligence. Used for multi-day Spread/Calendar
   * when prebuilt history_banks is unsafe under Standard products only.
   */
  bankInsights?: BankInsightsPayload | null;
  includeNonStandard?: boolean;
  detailsProducts?: Record<string, ProductDetail> | null;
}

/**
 * Aggregate filtered per-bank medians/bests into a section ribbon series.
 * Prefer this under Standard products only — prebuilt history_banks mixes the
 * full catalogue and cannot be product-gated on device.
 */
export function chartModelFromBankInsights(
  payload: BankInsightsPayload | null | undefined,
  section: SectionKey,
  window: HistoryWindow = 'All',
): Omit<BankHistoryChartModel, 'section'> | null {
  try {
    if (!payload?.run_dates?.length) return null;

    const allDates = normalizeTimelineDates(payload.run_dates);
    if (!allDates.length) return null;

    // Index by the same YYYY-MM-DD keys normalizeTimelineDates emits so lookups
    // stay aligned when run_dates carry longer timestamps or duplicates.
    const dateIndex = new Map<string, number>();
    payload.run_dates.forEach((raw, i) => {
      const date = String(raw ?? '').slice(0, 10);
      if (date && !dateIndex.has(date)) dateIndex.set(date, i);
    });
    const points: BankHistoryPoint[] = allDates.map((date) => {
      const idx = dateIndex.get(date);
      if (idx == null) return sanitizeRibbonPoint(date, { date, min: null, max: null, mean: null, median: null, count: 0 });

      const medians: number[] = [];
      const bests: number[] = [];
      for (const sections of Object.values(payload.banks)) {
        const series = sections?.[section];
        if (!series) continue;
        const median = series.median[idx];
        const best = series.best[idx];
        if (typeof median === 'number' && Number.isFinite(median)) medians.push(median);
        if (typeof best === 'number' && Number.isFinite(best)) bests.push(best);
      }

      if (!medians.length && !bests.length) {
        return sanitizeRibbonPoint(date, { date, min: null, max: null, mean: null, median: null, count: 0 });
      }

      const typicalPool = medians.length ? medians : bests;
      const rangePool = [...medians, ...bests];
      const sum = typicalPool.reduce((acc, value) => acc + value, 0);
      return sanitizeRibbonPoint(date, {
        date,
        min: Math.min(...rangePool),
        max: Math.max(...rangePool),
        mean: sum / typicalPool.length,
        median: medianOf(typicalPool),
        count: Math.max(medians.length, bests.length),
      });
    });

    const observed = points.filter((p) => p.min != null || p.max != null || p.median != null);
    if (!observed.length) return null;

    const aligned = alignPointsToTimeline(allDates, points);
    const sliced = sliceChartTimeline(allDates, aligned, window);
    if (!sliced.dates.length) return null;
    return {
      dates: sliced.dates,
      points: sliced.points,
      allDates,
    };
  } catch (err) {
    debugLog.error(
      'historySelectors',
      `chartModelFromBankInsights failed section=${section}: ${String((err as Error)?.message ?? err)}`,
    );
    return null;
  }
}

/**
 * Select bank-history chart model for a section.
 * Returns the full retained timeline; BankHistoryChart applies window chips locally.
 */
export function selectBankHistoryChartModel(
  state: HistorySelectorState,
  section: SectionKey,
  window: HistoryWindow = 'All',
): BankHistoryChartModel | null {
  try {
    const {
      core,
      historyBanks,
      historyCache,
      bankInsights,
      includeNonStandard = false,
      detailsProducts,
    } = state;
    if (!core) return null;
    if (!includeNonStandard && getSuitabilityAllowed()?.size === 0) return null;

    // Prebuilt section history contains the full catalogue and no product keys.
    // It is therefore safe only when the user explicitly includes non-standard products.
    const prebuilt = includeNonStandard
      ? chartModelFromPrebuiltHistory(historyBanks, section, window)
      : null;
    if (prebuilt?.dates.length) {
      return {
        section,
        dates: prebuilt.dates,
        points: prebuilt.points,
        allDates: prebuilt.allDates,
      };
    }

    if (historyCache && historyCache.section === section && historyCache.rates?.length) {
      const sectionRows = core.sections[section]?.rates ?? [];
      const hierRows = rowsUnder(sectionRows, section, []);
      const visibleKeys = new Set(
        visibleAccountRows(hierRows, includeNonStandard, detailsProducts).map(
          (row) => row.product_key,
        ),
      );
      const filtered = historyCache.rates.filter((row) => visibleKeys.has(row.product_key));
      const retained = normalizeTimelineDates(historyCache.run_dates || []);
      const aggregate = buildAggregateRibbonFromHistory(filtered, retained, window);
      if (!aggregate.dates.length) return null;
      return {
        section,
        dates: aggregate.dates,
        points: alignPointsToTimeline(aggregate.dates, aggregate.points),
        allDates: aggregate.allDates,
      };
    }

    // Suitability-filtered bank intelligence keeps Spread/Calendar populated when
    // prebuilt history_banks is withheld under Standard products only.
    const fromInsights = chartModelFromBankInsights(bankInsights, section, window);
    if (fromInsights?.dates.length) {
      return {
        section,
        dates: fromInsights.dates,
        points: fromInsights.points,
        allDates: fromInsights.allDates,
      };
    }

    const fallback = currentRibbonFallback(
      core,
      section,
      includeNonStandard,
      detailsProducts,
    );
    if (!fallback) return null;
    return {
      section,
      dates: fallback.dates,
      points: fallback.points,
      allDates: fallback.allDates ?? fallback.dates,
    };
  } catch (err) {
    debugLog.error(
      'historySelectors',
      `selectBankHistoryChartModel failed section=${section}: ${String((err as Error)?.message ?? err)}`,
    );
    return null;
  }
}

/** Read on-device history cache from store state when wired. */
export function selectBankHistoryCache(state: { historyCache?: BankHistoryCache | null }): BankHistoryCache | null {
  return state.historyCache ?? null;
}
