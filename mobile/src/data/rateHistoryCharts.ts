import type { BankHistoryChartModel, BankHistoryPoint, SectionKey } from '../types';
import { alignPointsToTimeline, normalizeTimelineDates, sanitizeRibbonPoint } from './bankHistoryTransform';
import type { BankRateSnapshot, RateSummary } from './bankRateOverview';

// History snapshots are immutable profile/publication projections. Detail routes
// repeatedly mount for the same projection; reuse its timeline and exact bands
// without keeping a previous profile or a replaced same-day capture alive.
const chartModels = new WeakMap<Record<string, BankRateSnapshot>, {
  dates: string[];
  sections: Map<SectionKey, Map<string | undefined, BankHistoryChartModel | null>>;
}>();

function historyPoint(date: string, summary: RateSummary | undefined): BankHistoryPoint {
  if (!summary || !Number.isInteger(summary.count) || summary.count <= 0 ||
    ![summary.min, summary.max, summary.mean, summary.median].every(value => Number.isFinite(value) && value >= 0)) {
    return sanitizeRibbonPoint(date);
  }
  return sanitizeRibbonPoint(date, {
    min: summary.min / 100, max: summary.max / 100,
    mean: summary.mean / 100, median: summary.median / 100, count: summary.count,
  });
}

/** Adapt dated, profile-filtered tiers to the history chart's fractional units.
 * A market series requires exact section totals, never a median of bank medians.
 * Provider bands show the full included tier range with actual mean and median. */
export function rateHistoryChartModel(
  snapshots: Record<string, BankRateSnapshot> | null | undefined,
  section: SectionKey,
  provider?: string,
): BankHistoryChartModel | null {
  if (!snapshots) return null;
  let cache = chartModels.get(snapshots);
  if (!cache) {
    cache = { dates: normalizeTimelineDates(Object.keys(snapshots)), sections: new Map() };
    chartModels.set(snapshots, cache);
  }
  let sectionModels = cache.sections.get(section);
  if (!sectionModels) {
    sectionModels = new Map();
    cache.sections.set(section, sectionModels);
  }
  if (sectionModels.has(provider)) return sectionModels.get(provider) ?? null;
  const dates = cache.dates;
  const points = dates.map(date => historyPoint(date, provider === undefined
    ? snapshots[date]?.sectionTotals?.[section]
    : snapshots[date]?.[section]?.[provider]));
  const model = points.some(point => point.count) ? { section, dates, allDates: dates, points } : null;
  sectionModels.set(provider, model);
  return model;
}

/** A product ledger owns its dates independently of available market context.
 * Pad absent market observations with gaps and never carry an older rate forward. */
export function mergeProductHistoryTimeline(
  model: BankHistoryChartModel | null | undefined,
  section: SectionKey,
  productRunDates: readonly string[] | null | undefined,
  currentDate?: string,
): BankHistoryChartModel | null {
  const market = model?.section === section ? model : null;
  const cutoff = normalizeTimelineDates(currentDate ? [currentDate] : [])[0];
  const dates = normalizeTimelineDates([
    ...(market?.allDates ?? market?.dates ?? []),
    ...(productRunDates ?? []),
    ...(cutoff ? [cutoff] : []),
  ]).filter(date => !cutoff || date <= cutoff);
  if (!dates.length) return null;
  return { section, dates, allDates: dates, points: alignPointsToTimeline(dates, market?.points ?? []) };
}
