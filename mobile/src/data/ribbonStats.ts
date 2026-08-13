import { visibleAccountRows } from './format';
import { rankFraction, type MortgageRateMetric, type RankMetric } from './selectors';
import { statsFor, type RateStats } from './taxonomy';
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

  const fractionOf = section
    ? (row: RateRow) => rankFraction(row, section, depositRankMetric, mortgageRateMetric)
    : undefined;
  const computed = statsFor(filtered, true, section, fractionOf);
  if (computed.min != null) return computed;

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
