import { matchesMortgageFacet } from './mortgageFacets';
import { SECTIONS } from '../constants';
import { getMandatoryEligibilityRevision, mandatoryEligibleRows } from './eligibilityGate';
import { getSuitabilityRevision } from './suitabilityGate';
import { rowsForProductKey } from './rateRowIndex';
import { matchesLvrTier } from './lvrRange';
import { yieldToUi } from '../lib/yieldToUi';
import { isMeaningfulDepositRate, MIN_MEANINGFUL_DEPOSIT_RATE_FRACTION } from '../ratePolicy';
import type { ProductDetail, RateRow, SectionKey } from '../types';
import {
  prepareRowSearchQuery,
  prepareRowSearchQueryCooperatively,
  type SearchIndexPayload,
} from './detailSearch';
import { productHasAllEligibilityCriteria } from './eligibility';
import { productHasAllFeatures } from './featuresCore';
import { isFirstValuePending } from '../lib/firstValue';
import {
  effectiveFraction,
  sortByDisplayLabel,
  toFraction,
  visibleAccountRows,
} from './format';
import { rateConditionality } from './rateConditionalFacts';
import {
  featureEvidenceScope,
  productFactCriteriaState,
  type FactCriterion,
} from './productFactsCore';

export type { FactCriterion, FactCriterionOperator, FactCriterionScalar } from './productFactsCore';

export type SortKey = 'rate' | 'comparison' | 'bank';

export function normalizeSortKey(value?: string): SortKey {
  return value === 'comparison' || value === 'bank' ? value : 'rate';
}

export interface Filters {
  query: string;
  providers: string[];
  rateTypes: string[];
  lvrTiers: string[];
  repaymentTypes: string[];
  /** Owner-occupier vs investment (CDR loan_purpose codes). */
  loanPurposes: string[];
  depositKinds: string[];
  interestPayments: string[];
  /** CDR featureType codes from details.features (AND when multiple selected). */
  accountFeatures: string[];
  /** CDR eligibilityType codes from details.eligibility (AND when multiple selected). */
  eligibilityCriteria: string[];
  /** Structured normalized-fact predicates (AND across selected criteria). */
  factCriteria: FactCriterion[];
  factMatchMode?: 'matching' | 'unknown';
  includeNonStandard: boolean;
}

export const EMPTY_FILTERS: Filters = {
  query: '',
  providers: [],
  rateTypes: [],
  lvrTiers: [],
  repaymentTypes: [],
  loanPurposes: [],
  depositKinds: [],
  interestPayments: [],
  accountFeatures: [],
  eligibilityCriteria: [],
  factCriteria: [],
  includeNonStandard: false,
};

export function activeFilterCount(f: Filters): number {
  return (
    f.providers.length +
    f.rateTypes.length +
    f.lvrTiers.length +
    f.repaymentTypes.length +
    f.loanPurposes.length +
    f.depositKinds.length +
    f.interestPayments.length +
    f.accountFeatures.length +
    f.eligibilityCriteria.length +
    (f.factCriteria?.length ?? 0)
  );
}

/** How savings & term-deposit lists are ranked. `base` = the unconditional
 *  ongoing rate a typical customer keeps (a bonus/intro row ranks on the base
 *  rate it reverts to), so conditional promo rates never top the list; `max` =
 *  the headline/maximum achievable rate. */
export type RankMetric = 'base' | 'max';

/** How home-loan lists are ranked when sorting by rate. `headline` = the
 *  advertised interest rate shown large on product cards; `comparison` = the
 *  fee-inclusive comparison rate (falling back to headline when unpublished). */
export type MortgageRateMetric = 'headline' | 'comparison';

export function rankedRateLabelForSection(
  section: SectionKey,
  depositMetric: RankMetric = 'base',
  mortgageMetric: MortgageRateMetric = 'comparison',
): 'Advertised rate' | 'Comparison rate' | 'Ongoing rate' {
  if (section === 'Mortgage') {
    return mortgageMetric === 'comparison' ? 'Comparison rate' : 'Advertised rate';
  }
  if (section === 'Savings' && depositMetric === 'base') return 'Ongoing rate';
  return 'Advertised rate';
}

/** Label the actual value used for a row. Mortgage comparison ranking falls
 * back to advertised rate when a comparison rate is not published. */
export function rankedRateLabelForRow(
  row: RateRow,
  section: SectionKey,
  depositMetric: RankMetric = 'base',
  mortgageMetric: MortgageRateMetric = 'comparison',
): 'Advertised rate' | 'Comparison rate' | 'Ongoing rate' {
  if (section === 'Mortgage'
    && mortgageMetric === 'comparison'
    && toFraction(row.comparison_rate) === null) {
    return 'Advertised rate';
  }
  return rankedRateLabelForSection(section, depositMetric, mortgageMetric);
}

export { MIN_MEANINGFUL_DEPOSIT_RATE_FRACTION, isMeaningfulDepositRate };

/** True when a deposit row should stay after the token-rate floor.
 *  Published zero/negative headlines are tokens (`toFraction` maps them to null);
 *  genuinely missing/unparseable headlines are kept (e.g. incomplete bonus rows).
 */
function passesDepositTokenFloor(row: RateRow, section: SectionKey): boolean {
  if (section === 'Mortgage') return true;
  const v = effectiveFraction(row);
  if (v !== null) return isMeaningfulDepositRate(v, section);
  const raw = row.rate;
  if (raw === null || raw === undefined || raw === '') return true;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (isFinite(n) && n <= 0) return false;
  return true;
}

/**
 * Drop Savings/TD rows whose headline/effective rate is a near-zero token.
 * Gate on `effectiveFraction` (not the active rank metric) so list membership
 * matches ribbon/`statsFor` and genuine bonus savers with a low ongoing base
 * stay visible under both `base` and `max` ranking. Mortgages are unchanged.
 */
export function excludeTokenDepositRates(
  rows: RateRow[],
  section: SectionKey,
): RateRow[] {
  if (section === 'Mortgage') return rows;
  return rows.filter((row) => passesDepositTokenFloor(row, section));
}

/** The fraction a row should be ranked/compared by, honouring the deposit rank
 *  metric and (for loans) the mortgage rate metric. For deposits with `base`
 *  (default), a bonus/intro row ranks on the ongoing rate it reverts to (`null`
 *  when the bank publishes none); `max` uses the headline. Mortgages use the
 *  advertised headline or the comparison-or-headline effective rate. */
export function rankFraction(
  row: RateRow,
  section: SectionKey,
  metric: RankMetric = 'base',
  mortgageMetric: MortgageRateMetric = 'comparison',
): number | null {
  if (section === 'Mortgage') {
    return mortgageMetric === 'headline' ? toFraction(row.rate) : effectiveFraction(row);
  }
  if (metric === 'base') {
    const kind = rateConditionality(row, section);
    if (kind === 'bonus' || kind === 'intro') {
      // Some bonus/intro accounts legitimately pay 0% ongoing (see rateQualifier's
      // formatOngoingRate). toFraction rejects <= 0 as missing, so handle a published
      // 0% explicitly — rank it at 0 rather than treating it as unpublished/unrankable.
      const raw = row.ongoing_rate;
      if (raw !== null && raw !== undefined && raw !== '') {
        const n = typeof raw === 'number' ? raw : Number(raw);
        if (n === 0) return 0;
      }
      return toFraction(raw);
    }
  }
  return effectiveFraction(row);
}

/** The "best" rate in a list, honouring lower-is-better for loans. */
export function bestRow(
  rows: RateRow[],
  section: SectionKey,
  includeNonStandard = false,
  metric: RankMetric = 'base',
  detailsProducts?: Record<string, ProductDetail> | null,
  mortgageMetric: MortgageRateMetric = 'comparison',
): RateRow | null {
  const candidates = excludeTokenDepositRates(
    visibleAccountRows(rows, includeNonStandard, detailsProducts),
    section,
  );
  const lowerIsBetter = SECTIONS[section].lowerIsBetter;
  let best: PreparedSortRow | null = null;
  for (let originalIndex = 0; originalIndex < candidates.length; originalIndex += 1) {
    const row = candidates[originalIndex];
    const prepared = prepareSortRow(
      row,
      originalIndex,
      'rate',
      section,
      metric,
      mortgageMetric,
    );
    // Historically bestRow removed unrankable rows before sorting. Preserve
    // that contract rather than returning a null-ranked row when all are null.
    if (prepared.rank === null) continue;
    if (
      !best ||
      comparePreparedRows(
        prepared,
        best,
        'rate',
        section,
        lowerIsBetter,
        mortgageMetric,
      ) < 0
    ) {
      best = prepared;
    }
  }
  return best?.row ?? null;
}

/** Fraction used when ordering a product list for a given sort chip.
 *  Mortgage "rate" follows {@link MortgageRateMetric};
 *  "comparison" always ranks by comparison-or-headline. Deposits keep
 *  {@link rankFraction} for both chips so bonus/intro rows never top a list on
 *  the promo headline unless the deposit metric is `max`. */
export function sortRankFraction(
  row: RateRow,
  sortKey: SortKey,
  section: SectionKey,
  metric: RankMetric = 'base',
  mortgageMetric: MortgageRateMetric = 'comparison',
): number | null {
  if (sortKey === 'rate' && section === 'Mortgage') {
    return rankFraction(row, section, metric, mortgageMetric);
  }
  if (sortKey === 'comparison' && section === 'Mortgage') {
    return effectiveFraction(row);
  }
  return rankFraction(row, section, metric, mortgageMetric);
}

interface PreparedSortRow {
  row: RateRow;
  originalIndex: number;
  rank: number | null;
  comparisonTie: number | null;
  /** Comparison ranking only: false when the row publishes no comparison rate. */
  comparisonKnown: boolean;
}

// Reuse one comparator for large product lists. Calling String#localeCompare
// tens of thousands of times is particularly expensive in Hermes because the
// locale machinery may be prepared for every comparison.
const ROW_TEXT_COLLATOR = new Intl.Collator();

function prepareSortRow(
  row: RateRow,
  originalIndex: number,
  sortKey: SortKey,
  section: SectionKey,
  metric: RankMetric,
  mortgageMetric: MortgageRateMetric,
): PreparedSortRow {
  return {
    row,
    originalIndex,
    rank:
      sortKey === 'bank'
        ? null
        : sortRankFraction(row, sortKey, section, metric, mortgageMetric),
    comparisonTie:
      section === 'Mortgage' && sortKey === 'rate' && mortgageMetric === 'headline'
        ? toFraction(row.comparison_rate)
        : null,
    comparisonKnown: !ranksByComparison(sortKey, section, mortgageMetric)
      || toFraction(row.comparison_rate) !== null,
  };
}

/** Mortgage orders whose rank value is the comparison rate. */
function ranksByComparison(sortKey: SortKey, section: SectionKey, mortgageMetric: MortgageRateMetric): boolean {
  return section === 'Mortgage'
    && (sortKey === 'comparison' || (sortKey === 'rate' && mortgageMetric === 'comparison'));
}

function comparePreparedRows(
  a: PreparedSortRow,
  b: PreparedSortRow,
  sortKey: SortKey,
  section: SectionKey,
  lowerIsBetter: boolean,
  mortgageMetric: MortgageRateMetric,
): number {
  if (sortKey !== 'bank') {
    // An advertised-rate fallback is not comparable with a fee-inclusive
    // comparison rate: unknown comparison rates follow every known one.
    if (a.comparisonKnown !== b.comparisonKnown) return a.comparisonKnown ? -1 : 1;
    const va = a.rank;
    const vb = b.rank;
    if (va === null && vb !== null) return 1;
    if (va !== null && vb === null) return -1;
    if (va !== null && vb !== null) {
      const byRate = lowerIsBetter ? va - vb : vb - va;
      if (byRate !== 0) return byRate;
      // Equal Mortgage headlines use the published comparison rate as their
      // fee-aware tie-break. Missing comparison rates remain last in that tie.
      if (section === 'Mortgage' && sortKey === 'rate' && mortgageMetric === 'headline') {
        const ca = a.comparisonTie;
        const cb = b.comparisonTie;
        if (ca === null && cb !== null) return 1;
        if (ca !== null && cb === null) return -1;
        if (ca !== null && cb !== null && ca !== cb) return ca - cb;
      }
    }
  }
  return compareProviderThenName(a.row, b.row) || a.originalIndex - b.originalIndex;
}

export function sortRows(
  rows: RateRow[],
  sortKey: SortKey,
  section: SectionKey,
  metric: RankMetric = 'base',
  mortgageMetric: MortgageRateMetric = 'comparison',
): RateRow[] {
  const lowerIsBetter = SECTIONS[section].lowerIsBetter;
  return mandatoryEligibleRows(rows)
    .map((row, originalIndex) => prepareSortRow(
      row,
      originalIndex,
      sortKey,
      section,
      metric,
      mortgageMetric,
    ))
    .sort((a, b) =>
      comparePreparedRows(a, b, sortKey, section, lowerIsBetter, mortgageMetric),
    )
    .map(({ row }) => row);
}

/** The `limit` leading rows of `sortRows(rows, ...)`, returned in input order.
 * Bounded selection with the exact comparator and tie order of the full sort,
 * so large books can name their first page without sorting every row. */
export function leadingSortedRowsInInputOrder(
  rows: readonly RateRow[],
  limit: number,
  sortKey: SortKey,
  section: SectionKey,
  metric: RankMetric = 'base',
  mortgageMetric: MortgageRateMetric = 'comparison',
): RateRow[] {
  const eligible = mandatoryEligibleRows(rows as RateRow[]);
  if (limit <= 0) return [];
  if (eligible.length <= limit) return [...eligible];
  const lowerIsBetter = SECTIONS[section].lowerIsBetter;
  const worse = (a: PreparedSortRow, b: PreparedSortRow) =>
    comparePreparedRows(a, b, sortKey, section, lowerIsBetter, mortgageMetric) > 0;
  // Max-heap on "worse": the root is the weakest of the current leaders.
  const heap: PreparedSortRow[] = [];
  const up = (from: number) => {
    let at = from;
    while (at > 0) {
      const parent = (at - 1) >> 1;
      if (!worse(heap[at], heap[parent])) break;
      [heap[at], heap[parent]] = [heap[parent], heap[at]]; at = parent;
    }
  };
  const down = (from: number) => {
    let at = from;
    for (;;) {
      const left = at * 2 + 1, right = left + 1;
      let top = at;
      if (left < heap.length && worse(heap[left], heap[top])) top = left;
      if (right < heap.length && worse(heap[right], heap[top])) top = right;
      if (top === at) break;
      [heap[at], heap[top]] = [heap[top], heap[at]]; at = top;
    }
  };
  for (let index = 0; index < eligible.length; index++) {
    const item = prepareSortRow(eligible[index], index, sortKey, section, metric, mortgageMetric);
    if (heap.length < limit) { heap.push(item); up(heap.length - 1); }
    else if (worse(heap[0], item)) { heap[0] = item; down(0); }
  }
  return heap.sort((a, b) => a.originalIndex - b.originalIndex).map(({ row }) => row);
}

const lenderProductCache = new WeakMap<RateRow[], WeakMap<object, Map<string, RateRow[]>>>();
const NO_LENDER_DETAILS = {};

/** Ranked lender rates; by default select one tier per product for product-level history. */
export function lenderProductRows(
  rows: RateRow[],
  section: SectionKey,
  metric: RankMetric = 'base',
  mortgageMetric: MortgageRateMetric = 'comparison',
  includeNonStandard = false,
  detailsProducts?: Record<string, ProductDetail> | null,
  allTiers = false,
): RateRow[] {
  let byDetails = lenderProductCache.get(rows);
  if (!byDetails) { byDetails = new WeakMap(); lenderProductCache.set(rows, byDetails); }
  const detailKey = detailsProducts ?? NO_LENDER_DETAILS;
  let cached = byDetails.get(detailKey);
  if (!cached) { cached = new Map(); byDetails.set(detailKey, cached); }
  const key = `${section}:${metric}:${mortgageMetric}:${includeNonStandard}:${allTiers}:${getMandatoryEligibilityRevision()}:${getSuitabilityRevision()}`;
  const previous = cached.get(key);
  if (previous) return previous;
  const visible = mandatoryEligibleRows(excludeTokenDepositRates(
    visibleAccountRows(rows, includeNonStandard, detailsProducts), section,
  ));
  const compare = (a: PreparedSortRow, b: PreparedSortRow) =>
    comparePreparedRows(a, b, 'rate', section, SECTIONS[section].lowerIsBetter, mortgageMetric);
  // Choose the best tier in one pass, then sort only the product winners.
  // Sorting every tier first repeated needless comparisons on large banks.
  const ranked = allTiers ? visible.map((row, index) => prepareSortRow(row, index, 'rate', section, metric, mortgageMetric)) : (() => {
    const products = new Map<string, PreparedSortRow>();
    visible.forEach((row, index) => {
      const prepared = prepareSortRow(row, index, 'rate', section, metric, mortgageMetric);
      const prior = products.get(row.product_key);
      if (!prior || compare(prepared, prior) < 0) products.set(row.product_key, prepared);
    });
    return [...products.values()];
  })();
  const result = ranked.sort(compare).map(item => item.row);
  // Bound preference/gate variants while the immutable source book remains live.
  if (cached.size >= 8) cached.delete(cached.keys().next().value!);
  cached.set(key, result);
  return result;
}

/** CPU slice between yields. Until Rates first settles nothing is interactive,
 * and every yield costs a scheduler round trip (up to 48 ms on a loaded device),
 * so use longer slices then and keep the short slice for a live screen. */
function cooperativeSliceMs(): number {
  return isFirstValuePending() ? 24 : 6;
}

/** Same ranking as sortRows, with bounded preparation and merge slices. */
export async function sortRowsCooperatively(
  rows: RateRow[],
  sortKey: SortKey,
  section: SectionKey,
  metric: RankMetric = 'base',
  mortgageMetric: MortgageRateMetric = 'comparison',
  control: { cancelled?: () => boolean; yieldControl?: () => Promise<void>; now?: () => number } = {},
): Promise<RateRow[] | null> {
  const yieldControl = control.yieldControl ?? (() => yieldToUi(0));
  const now = control.now ?? (() => performance.now());
  const cancelled = control.cancelled ?? (() => false);
  await yieldControl();
  if (cancelled()) return null;
  let sliceStarted = now();
  // An already-resolved async checkpoint still queues a microtask. A full
  // section's merge performs thousands of checkpoints: stay synchronous until
  // the CPU slice actually expires, then yield to the host rather than merely
  // cycling through promise continuations.
  const sliceExpired = () => now() - sliceStarted >= cooperativeSliceMs();
  const pause = async () => {
    await yieldControl();
    sliceStarted = now();
    return cancelled();
  };
  const lowerIsBetter = SECTIONS[section].lowerIsBetter;
  const compare = (a: PreparedSortRow, b: PreparedSortRow) =>
    comparePreparedRows(a, b, sortKey, section, lowerIsBetter, mortgageMetric);
  let prepared: PreparedSortRow[] = [];
  for (let offset = 0; offset < rows.length; offset += 32) {
    const batch = mandatoryEligibleRows(rows.slice(offset, offset + 32));
    for (const row of batch) {
      prepared.push(prepareSortRow(row, prepared.length, sortKey, section, metric, mortgageMetric));
    }
    if (cancelled() || sliceExpired() && await pause()) return null;
  }
  // Bottom-up merging avoids the single native Array.sort burst on a full section.
  let target = new Array<PreparedSortRow>(prepared.length);
  let operations = 0;
  for (let width = 1; width < prepared.length; width *= 2) {
    for (let start = 0; start < prepared.length; start += width * 2) {
      const middle = Math.min(start + width, prepared.length);
      const end = Math.min(start + width * 2, prepared.length);
      let left = start;
      let right = middle;
      for (let output = start; output < end; output += 1) {
        target[output] = right >= end || (left < middle && compare(prepared[left], prepared[right]) <= 0)
          ? prepared[left++] : prepared[right++];
        operations += 1;
        if (operations % 32 === 0 && (cancelled() || sliceExpired() && await pause())) return null;
      }
    }
    [prepared, target] = [target, prepared];
  }
  const result: RateRow[] = [];
  for (let index = 0; index < prepared.length; index += 32) {
    for (const item of prepared.slice(index, index + 32)) result.push(item.row);
    if (cancelled() || sliceExpired() && await pause()) return null;
  }
  return cancelled() ? null : result;
}

function compareProviderThenName(a: RateRow, b: RateRow): number {
  return ROW_TEXT_COLLATOR.compare(a.provider, b.provider) ||
    ROW_TEXT_COLLATOR.compare(a.product_name, b.product_name);
}

function inList(value: string | undefined, list: string[] | undefined): boolean {
  // Persisted filter snapshots predating a dimension restore without it.
  return !list || list.length === 0 || (value !== undefined && list.includes(value));
}

/**
 * Stable filtering contract: returned rows retain the relative order of the
 * input. Search relies on this to sort its full dataset once and cheaply apply
 * changing text and facet filters without changing result order.
 */
export function filterRows(
  rows: RateRow[],
  filters: Filters,
  detailsProducts?: Record<string, ProductDetail> | null,
  searchIndex?: SearchIndexPayload | null,
  section?: SectionKey | null,
): RateRow[] {
  // Detail-text search is Pro-only via searchIndex. Do not build a runtime
  // detailSearchIndex from detailsProducts — that would unlock fee/feature
  // matching for non-Pro users whenever suitability details are loaded.
  const visibleRows = visibleAccountRows(rows, filters.includeNonStandard, detailsProducts);
  if (!visibleRows.length) return visibleRows;
  return visibleRows.filter(prepareRowFilter(filters, detailsProducts, searchIndex, section));
}

export function prepareRowFilter(
  filters: Filters,
  detailsProducts?: Record<string, ProductDetail> | null,
  searchIndex?: SearchIndexPayload | null,
  section?: SectionKey | null,
  matchesSearch = prepareRowSearchQuery(filters.query, searchIndex),
): (row: RateRow) => boolean {
  return (row) => {
    if (!row) return false;
    if (section && !passesDepositTokenFloor(row, section)) return false;
    if (!matchesSearch(row)) return false;
    if (!inList(row.provider, filters.providers)) return false;
    if (!inList(row.rate_type, filters.rateTypes)) return false;
    if (!matchesLvrTier(row.lvr_tier, filters.lvrTiers)) return false;
    if (!matchesMortgageFacet(row.ribbon_repayment_type ?? row.repayment_type, filters.repaymentTypes, 'repayment')) return false;
    if (!matchesMortgageFacet(row.loan_purpose ?? row.security_purpose, filters.loanPurposes, 'purpose')) return false;
    if (!inList(row.ribbon_deposit_kind, filters.depositKinds)) return false;
    if (!inList(row.interest_payment, filters.interestPayments)) return false;
    if (
      filters.accountFeatures.length > 0 &&
      !productHasAllFeatures(row.product_key, filters.accountFeatures, detailsProducts, row, section ?? undefined)
    ) {
      return false;
    }
    if (
      filters.eligibilityCriteria.length > 0 &&
      !productHasAllEligibilityCriteria(row.product_key, filters.eligibilityCriteria, detailsProducts)
    ) {
      return false;
    }
    if (
      filters.factCriteria?.length > 0 &&
      productFactCriteriaState(detailsProducts?.[row.product_key], filters.factCriteria,
        featureEvidenceScope(row.product_key, row, section ?? undefined)) !== (filters.factMatchMode === 'unknown' ? 'unknown' : 'match')
    ) {
      return false;
    }
    return true;
  };
}

/** Prepare a whole result set without a full-catalogue render-time CPU burst. */
export async function prepareSearchRows(
  rows: RateRow[], filters: Filters, sortKey: SortKey, section: SectionKey,
  detailsProducts?: Record<string, ProductDetail> | null, searchIndex?: SearchIndexPayload | null,
  metric: RankMetric = 'base', mortgageMetric: MortgageRateMetric = 'comparison',
  control: { cancelled?: () => boolean; yieldControl?: () => Promise<void>; now?: () => number } = {},
): Promise<RateRow[] | null> {
  const filtered = await filterRowsCooperatively(rows, filters, detailsProducts, searchIndex, section, control);
  return filtered && sortRowsCooperatively(filtered, sortKey, section, metric, mortgageMetric, control);
}

/** Share search membership with live filter counts without a render-time catalogue scan. */
export async function filterRowsCooperatively(
  rows: RateRow[], filters: Filters, detailsProducts?: Record<string, ProductDetail> | null,
  searchIndex?: SearchIndexPayload | null, section?: SectionKey | null,
  control: { cancelled?: () => boolean; yieldControl?: () => Promise<void>; now?: () => number } = {},
): Promise<RateRow[] | null> {
  const yieldControl = control.yieldControl ?? (() => yieldToUi(0));
  const now = control.now ?? (() => performance.now());
  const eligibilityRevision = getMandatoryEligibilityRevision();
  const suitabilityRevision = getSuitabilityRevision();
  const cancelled = () => Boolean(control.cancelled?.()) ||
    getMandatoryEligibilityRevision() !== eligibilityRevision || getSuitabilityRevision() !== suitabilityRevision;
  await yieldControl();
  if (cancelled()) return null;
  const matchesSearch = rows.length ? await prepareRowSearchQueryCooperatively(filters.query, searchIndex, { ...control, cancelled }) : () => false;
  if (!matchesSearch || cancelled()) return null;
  const predicate = prepareRowFilter(filters, detailsProducts, searchIndex, section, matchesSearch);
  const filtered: RateRow[] = [];
  let sliceStarted = now();
  for (let offset = 0; offset < rows.length; offset += 32) {
    const batch = visibleAccountRows(rows.slice(offset, offset + 32), filters.includeNonStandard, detailsProducts);
    for (const row of batch) if (predicate(row)) filtered.push(row);
    if (now() - sliceStarted >= cooperativeSliceMs()) {
      await yieldControl();
      sliceStarted = now();
    }
    if (cancelled()) return null;
  }
  return filtered;
}

export function queryAndSort(
  rows: RateRow[],
  filters: Filters,
  sortKey: SortKey,
  section: SectionKey,
  detailsProducts?: Record<string, ProductDetail> | null,
  searchIndex?: SearchIndexPayload | null,
  metric: RankMetric = 'base',
  mortgageMetric: MortgageRateMetric = 'comparison',
): RateRow[] {
  return sortRows(
    filterRows(rows, filters, detailsProducts, searchIndex, section),
    sortKey,
    section,
    metric,
    mortgageMetric,
  );
}

/** Distinct non-empty values for a field, sorted by frequency then label. */
export function distinctValues(rows: RateRow[], field: keyof RateRow): string[] {
  rows = mandatoryEligibleRows(rows);
  const counts = new Map<string, number>();
  for (const row of rows) {
    const raw = row[field];
    if (raw === undefined || raw === null || raw === '') continue;
    const key = String(raw);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([k]) => k);
}

/** Distinct provider names for filter UI, sorted A-Z (case-insensitive). */
export function distinctProviders(rows: RateRow[]): string[] {
  rows = mandatoryEligibleRows(rows);
  const names = new Set<string>();
  for (const row of rows) {
    const prov = row.provider;
    if (prov === undefined || prov === null || prov === '') continue;
    names.add(prov);
  }
  return sortByDisplayLabel(Array.from(names), (name) => name);
}

export interface ProviderGroup {
  provider: string;
  rows: RateRow[];
  bestBySection: Partial<Record<SectionKey, RateRow>>;
}

/**
 * Compare provider groups by best rate for `section` (best first), then name.
 * Mortgage: lowest first. Savings/TD: highest first. Missing rates sort last.
 */
export function compareProviderGroupsByRate(
  a: ProviderGroup,
  b: ProviderGroup,
  section: SectionKey,
  metric: RankMetric = 'base',
  mortgageMetric: MortgageRateMetric = 'comparison',
): number {
  const lowerIsBetter = SECTIONS[section].lowerIsBetter;
  const va = a.bestBySection[section]
    ? rankFraction(a.bestBySection[section]!, section, metric, mortgageMetric)
    : null;
  const vb = b.bestBySection[section]
    ? rankFraction(b.bestBySection[section]!, section, metric, mortgageMetric)
    : null;
  return compareRankedProviders(a.provider, va, b.provider, vb, lowerIsBetter);
}

function compareRankedProviders(
  aName: string,
  va: number | null,
  bName: string,
  vb: number | null,
  lowerIsBetter: boolean,
): number {
  if (va === null && vb === null) return aName.localeCompare(bName);
  if (va === null) return 1;
  if (vb === null) return -1;
  const byRate = lowerIsBetter ? va - vb : vb - va;
  return byRate || aName.localeCompare(bName);
}

/** Group every row across all sections by provider (for the Banks screen). */
export function groupByProvider(
  sections: Record<SectionKey, { rates: RateRow[] }>,
  metric: RankMetric = 'base',
  includeNonStandard = false,
  detailsProducts?: Record<string, ProductDetail> | null,
  /** When set, order lenders best→worst for this section; otherwise A–Z by name. */
  sortSection?: SectionKey | null,
  mortgageMetric: MortgageRateMetric = 'comparison',
): ProviderGroup[] {
  // Bucket rows per provider AND per section in a single pass. The previous
  // implementation re-scanned every section's full row array (Array.includes)
  // for every provider, which is O(providers × rows) — the Banks screen's
  // main lag source. This is O(rows).
  interface Acc extends ProviderGroup {
    bestPreparedBySection: Partial<Record<SectionKey, PreparedSortRow>>;
  }
  const map = new Map<string, Acc>();
  const keys = Object.keys(sections) as SectionKey[];
  let originalIndex = 0;
  for (const section of keys) {
    for (const row of excludeTokenDepositRates(
      visibleAccountRows(sections[section]?.rates ?? [], includeNonStandard, detailsProducts),
      section,
    )) {
      let group = map.get(row.provider);
      if (!group) {
        group = {
          provider: row.provider,
          rows: [],
          bestBySection: {},
          bestPreparedBySection: {},
        };
        map.set(row.provider, group);
      }
      group.rows.push(row);
      const prepared = prepareSortRow(
        row,
        originalIndex,
        'rate',
        section,
        metric,
        mortgageMetric,
      );
      originalIndex += 1;
      const currentBest = group.bestPreparedBySection[section];
      if (
        prepared.rank !== null &&
        (!currentBest ||
          comparePreparedRows(
            prepared,
            currentBest,
            'rate',
            section,
            SECTIONS[section].lowerIsBetter,
            mortgageMetric,
          ) < 0)
      ) {
        group.bestPreparedBySection[section] = prepared;
        group.bestBySection[section] = row;
      }
    }
  }
  const out: ProviderGroup[] = [];
  for (const group of map.values()) {
    out.push({
      provider: group.provider,
      rows: group.rows,
      bestBySection: group.bestBySection,
    });
  }
  if (sortSection) {
    // Precompute rank once per provider (avoid O(n log n) re-ranking in the comparator).
    const lowerIsBetter = SECTIONS[sortSection].lowerIsBetter;
    const ranked = out.map((group) => {
      const best = group.bestBySection[sortSection];
      return {
        group,
        value: best ? rankFraction(best, sortSection, metric, mortgageMetric) : null,
      };
    });
    ranked.sort((a, b) =>
      compareRankedProviders(a.group.provider, a.value, b.group.provider, b.value, lowerIsBetter),
    );
    return ranked.map((r) => r.group);
  }
  return out.sort((a, b) => a.provider.localeCompare(b.provider));
}

/** Find a single rate row by product_key across all sections. */
export function findByKey(
  sections: Record<SectionKey, { rates: RateRow[] }>,
  productKey: string,
): { row: RateRow; section: SectionKey; siblings: RateRow[] } | null {
  for (const section of Object.keys(sections) as SectionKey[]) {
    const matches = rowsForProductKey(sections[section].rates, productKey);
    if (matches.length) {
      return { row: matches[0], section, siblings: matches };
    }
  }
  return null;
}

/** UI lookup; the raw lookup remains available to preserve saved/source evidence. */
export function findEligibleByKey(
  sections: Record<SectionKey, { rates: RateRow[] }>,
  productKey: string,
): ReturnType<typeof findByKey> {
  for (const section of Object.keys(sections) as SectionKey[]) {
    const siblings = mandatoryEligibleRows(rowsForProductKey(sections[section].rates, productKey));
    if (siblings.length) return { row: siblings[0], section, siblings };
  }
  return null;
}
