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
import { rateQualifier } from '../lib/rateQualifier';

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
 *  the headline/maximum achievable rate. Mortgages are unaffected — they carry
 *  no bonus/intro concept (rateQualifier returns 'none'). */
export type RankMetric = 'base' | 'max';

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
 *  metric. For `base` (default), a bonus/intro deposit row ranks on the base
 *  ongoing rate it reverts to (`null` when the bank publishes none, so it can't
 *  masquerade as a broadly-earned rate); everything else uses the effective
 *  (comparison-or-headline) rate. This is the single ranking metric every
 *  best/sort/compare surface shares. */
export function rankFraction(
  row: RateRow,
  section: SectionKey,
  metric: RankMetric = 'base',
): number | null {
  if (metric === 'base') {
    const q = rateQualifier(row, section);
    if (q.kind === 'bonus' || q.kind === 'intro') {
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
): RateRow | null {
  const lowerIsBetter = SECTIONS[section].lowerIsBetter;
  let best: RateRow | null = null;
  let bestVal: number | null = null;
  for (const row of visibleAccountRows(rows, includeNonStandard, detailsProducts)) {
    // Token floor uses headline rate (parity with statsFor / excludeTokenDepositRates).
    if (!passesDepositTokenFloor(row, section)) continue;
    const v = rankFraction(row, section, metric);
    if (v === null) continue;
    if (bestVal === null || (lowerIsBetter ? v < bestVal : v > bestVal)) {
      bestVal = v;
      best = row;
    }
  }
  return best;
}

export function sortRows(
  rows: RateRow[],
  sortKey: SortKey,
  section: SectionKey,
  metric: RankMetric = 'base',
): RateRow[] {
  const lowerIsBetter = SECTIONS[section].lowerIsBetter;
  const copy = rows.slice();
  copy.sort((a, b) => {
    if (sortKey === 'bank') {
      return a.provider.localeCompare(b.provider) || a.product_name.localeCompare(b.product_name);
    }
    // "rate" — and the legacy "comparison" deep-link alias — both rank by the
    // deposit rank metric: base ongoing rate by default, so conditional bonus/intro
    // rates never top a deposit list on ANY sort. For loans rankFraction is the
    // comparison-or-headline rate, so comparison ordering is preserved.
    const va = rankFraction(a, section, metric);
    const vb = rankFraction(b, section, metric);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    // "Best first": ascending for loans, descending for deposits.
    return lowerIsBetter ? va - vb : vb - va;
  });
  return copy;
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
): RateRow[] {
  return sortRows(
    filterRows(rows, filters, detailsProducts, searchIndex, section),
    sortKey,
    section,
    metric,
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
): number {
  const lowerIsBetter = SECTIONS[section].lowerIsBetter;
  const va = a.bestBySection[section] ? rankFraction(a.bestBySection[section]!, section, metric) : null;
  const vb = b.bestBySection[section] ? rankFraction(b.bestBySection[section]!, section, metric) : null;
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
): ProviderGroup[] {
  // Bucket rows per provider AND per section in a single pass. The previous
  // implementation re-scanned every section's full row array (Array.includes)
  // for every provider, which is O(providers × rows) — the Banks screen's
  // main lag source. This is O(rows).
  interface Acc extends ProviderGroup {
    bySection: Partial<Record<SectionKey, RateRow[]>>;
  }
  const map = new Map<string, Acc>();
  const keys = Object.keys(sections) as SectionKey[];
  for (const section of keys) {
    for (const row of excludeTokenDepositRates(
      visibleAccountRows(sections[section]?.rates ?? [], includeNonStandard, detailsProducts),
      section,
    )) {
      let group = map.get(row.provider);
      if (!group) {
        group = { provider: row.provider, rows: [], bestBySection: {}, bySection: {} };
        map.set(row.provider, group);
      }
      group.rows.push(row);
      (group.bySection[section] ??= []).push(row);
    }
  }
  const out: ProviderGroup[] = [];
  for (const { bySection, ...group } of map.values()) {
    for (const section of keys) {
      const inSection = bySection[section];
      if (!inSection?.length) continue;
      const best = bestRow(inSection, section, includeNonStandard, metric, detailsProducts);
      if (best) group.bestBySection[section] = best;
    }
    out.push(group);
  }
  if (sortSection) {
    // Precompute rank once per provider (avoid O(n log n) re-ranking in the comparator).
    const lowerIsBetter = SECTIONS[sortSection].lowerIsBetter;
    const ranked = out.map((group) => {
      const best = group.bestBySection[sortSection];
      return {
        group,
        value: best ? rankFraction(best, sortSection, metric) : null,
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
