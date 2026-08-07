import { SECTIONS } from '../constants';
import { isMeaningfulDepositRate, MIN_MEANINGFUL_DEPOSIT_RATE_FRACTION } from '../config';
import type { ProductDetail, RateRow, SectionKey } from '../types';
import {
  rowMatchesSearchQuery,
  type SearchIndexPayload,
} from './detailSearch';
import { productHasAllEligibilityCriteria } from './eligibility';
import { productHasAllFeatures } from './features';
import {
  effectiveFraction,
  sortByDisplayLabel,
  toFraction,
  visibleAccountRows,
} from './format';
import { rateConditionality } from '../lib/rateQualifier';

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
    f.eligibilityCriteria.length
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
  mortgageMetric: MortgageRateMetric = 'headline',
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
  mortgageMetric: MortgageRateMetric = 'headline',
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
 *  Mortgage "rate" (Browse + Search "Best rate") follows {@link MortgageRateMetric};
 *  "comparison" always ranks by comparison-or-headline. Deposits keep
 *  {@link rankFraction} for both chips so bonus/intro rows never top a list on
 *  the promo headline unless the deposit metric is `max`. */
export function sortRankFraction(
  row: RateRow,
  sortKey: SortKey,
  section: SectionKey,
  metric: RankMetric = 'base',
  mortgageMetric: MortgageRateMetric = 'headline',
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
}

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
  };
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
  mortgageMetric: MortgageRateMetric = 'headline',
): RateRow[] {
  const lowerIsBetter = SECTIONS[section].lowerIsBetter;
  return rows
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

function compareProviderThenName(a: RateRow, b: RateRow): number {
  return a.provider.localeCompare(b.provider) || a.product_name.localeCompare(b.product_name);
}

function inList(value: string | undefined, list: string[] | undefined): boolean {
  // Persisted filter snapshots predating a dimension restore without it.
  return !list || list.length === 0 || (value !== undefined && list.includes(value));
}

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
  return visibleAccountRows(rows, filters.includeNonStandard, detailsProducts).filter((row) => {
    if (!row) return false;
    if (section && !passesDepositTokenFloor(row, section)) return false;
    if (
      !rowMatchesSearchQuery(
        row,
        filters.query,
        searchIndex,
        undefined,
      )
    ) {
      return false;
    }
    if (!inList(row.provider, filters.providers)) return false;
    if (!inList(row.rate_type, filters.rateTypes)) return false;
    if (!inList(row.lvr_tier, filters.lvrTiers)) return false;
    if (!inList(row.ribbon_repayment_type ?? row.repayment_type, filters.repaymentTypes)) return false;
    if (!inList(row.loan_purpose ?? row.security_purpose, filters.loanPurposes)) return false;
    if (!inList(row.ribbon_deposit_kind, filters.depositKinds)) return false;
    if (!inList(row.interest_payment, filters.interestPayments)) return false;
    if (
      filters.accountFeatures.length > 0 &&
      !productHasAllFeatures(row.product_key, filters.accountFeatures, detailsProducts)
    ) {
      return false;
    }
    if (
      filters.eligibilityCriteria.length > 0 &&
      !productHasAllEligibilityCriteria(row.product_key, filters.eligibilityCriteria, detailsProducts)
    ) {
      return false;
    }
    return true;
  });
}

export function queryAndSort(
  rows: RateRow[],
  filters: Filters,
  sortKey: SortKey,
  section: SectionKey,
  detailsProducts?: Record<string, ProductDetail> | null,
  searchIndex?: SearchIndexPayload | null,
  metric: RankMetric = 'base',
  mortgageMetric: MortgageRateMetric = 'headline',
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
  mortgageMetric: MortgageRateMetric = 'headline',
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
  mortgageMetric: MortgageRateMetric = 'headline',
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
    const matches = sections[section].rates.filter((r) => r.product_key === productKey);
    if (matches.length) {
      return { row: matches[0], section, siblings: matches };
    }
  }
  return null;
}
