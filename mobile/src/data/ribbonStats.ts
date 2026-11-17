import { toFraction, visibleAccountRows } from './format';
import { rankFraction, type MortgageRateMetric, type RankMetric } from './selectors';
import { statsFor, statsForCooperatively, type RateStats } from './taxonomy';
import { collectRowBatches, rowWork, type RowWorkControl } from './cooperativeRows';
import type { ProductDetail, RateRow, Ribbon, SectionData, SectionKey } from '../types';

export function ribbonToRateStats(ribbon: Ribbon): RateStats {
  const { range, counts } = ribbon;
  return {
    min: range.min ?? null,
    max: range.max ?? null,
    mean: range.mean ?? null,
    median: range.median ?? null,
    count: counts.rates,
    products: counts.products,
    providers: counts.providers,
  };
}

export function hasPayloadRibbon(ribbon: Ribbon | undefined): ribbon is Ribbon {
  return ribbon != null && ribbon.range.min != null && ribbon.range.max != null;
}

/**
 * Section-level ribbon stats for Home / Trends / Browse root.
 * Prefer stats from visible hierarchy rows (matches non-standard toggle).
 * Fall back to payload ribbon only when the caller opted into non-standard
 * products — the ingest ribbon is unfiltered and must not override a closed
 * standard-only gate (including the post-ingest rebuild window).
 */
export function resolveSectionRibbonStats(
  sectionData: SectionData | undefined,
  hierarchyRows: RateRow[],
  includeNonStandard: boolean,
  section?: SectionKey | null,
  detailsProducts?: Record<string, ProductDetail> | null,
  depositRankMetric: RankMetric = 'base',
  mortgageRateMetric: MortgageRateMetric = 'comparison',
): RateStats {
  const filtered = includeNonStandard
    ? hierarchyRows
    : visibleAccountRows(hierarchyRows, false, detailsProducts);
  const rankedRows = section === 'Mortgage' && mortgageRateMetric === 'comparison'
    ? filtered.filter((row) => toFraction(row.comparison_rate) !== null)
    : filtered;

  const fractionOf = section
    ? (row: RateRow) => rankFraction(row, section, depositRankMetric, mortgageRateMetric)
    : undefined;
  const computed = statsFor(rankedRows, true, section, fractionOf);
  return sectionRibbonFallback(computed, sectionData, includeNonStandard, section, mortgageRateMetric);
}

function sectionRibbonFallback(computed: RateStats, sectionData: SectionData | undefined,
  includeNonStandard: boolean, section: SectionKey | null | undefined, mortgageRateMetric: MortgageRateMetric): RateStats {
  if (computed.min != null) return computed;

  // An advertised-rate payload ribbon cannot stand in for unpublished
  // comparison-rate statistics.
  if (section === 'Mortgage' && mortgageRateMetric === 'comparison') return computed;

  // Deposit flooring can empty client stats while the payload ribbon still
  // includes token near-zero rows — do not resurrect those for Savings/TD.
  if (section === 'Savings' || section === 'TD') return computed;

  // Standard-only mode must never resurrect the unfiltered payload ribbon.
  // After a new daily ingest the suitability gate fails closed (empty Set) until
  // details rebuild; filtered rows are temporarily empty and falling back here
  // was putting non-standard extremes on Home's first paint.
  if (!includeNonStandard) return computed;

  if (sectionData && hasPayloadRibbon(sectionData.ribbon)) {
    return ribbonToRateStats(sectionData.ribbon);
  }
  return computed;
}

export async function resolveSectionRibbonStatsCooperatively(sectionData: SectionData | undefined, hierarchyRows: RateRow[],
  includeNonStandard: boolean, section?: SectionKey | null, detailsProducts?: Record<string, ProductDetail> | null,
  depositRankMetric: RankMetric = 'base', mortgageRateMetric: MortgageRateMetric = 'comparison',
  control: RowWorkControl = {}): Promise<RateStats | null> {
  const work = rowWork(control);
  const rankedRows = await collectRowBatches(hierarchyRows, batch => {
    const visible = includeNonStandard ? batch : visibleAccountRows(batch, false, detailsProducts);
    return section === 'Mortgage' && mortgageRateMetric === 'comparison'
      ? visible.filter(row => toFraction(row.comparison_rate) !== null) : visible;
  }, { ...control, cancelled: work.cancelled });
  if (!rankedRows) return null;
  const fractionOf = section ? (row: RateRow) => rankFraction(row, section, depositRankMetric, mortgageRateMetric) : undefined;
  const computed = await statsForCooperatively(rankedRows, true, section, fractionOf, { ...control, cancelled: work.cancelled });
  return computed ? sectionRibbonFallback(computed, sectionData, includeNonStandard, section, mortgageRateMetric) : null;
}
