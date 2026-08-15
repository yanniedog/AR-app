import { SECTIONS } from '../constants';
import type { CorePayload, ProductDetail, RateRow, SectionKey } from '../types';
import { bpsBetween, formatRate, humanizeEnum, toFraction } from './format';
import type { SavedRateRef } from './savedRates';
import { activeFilterCount, filterRows, rankFraction, type Filters, type MortgageRateMetric, type RankMetric, type SortKey } from './selectors';
import { breadcrumb, rowsForSearchScope } from './taxonomy';
import { factCriterionId, normalizeFactCriterion } from './productFacts';

/** factCriteria is optional only for persisted snapshots created before this field existed. */
export type FilterSnapshot = Omit<Filters, 'query' | 'factCriteria'> & {
  factCriteria?: Filters['factCriteria'];
};

export interface ProductSubscription {
  id: string;
  kind: 'product';
  productKey: string;
  rateIndex: number | null;
  label: string;
  createdAt: string;
}

export interface SearchSubscription {
  id: string;
  kind: 'search';
  section: SectionKey;
  path: string[];
  hierarchyScoped: boolean;
  query: string;
  sort?: SortKey;
  filters: FilterSnapshot;
  label: string;
  createdAt: string;
}

export type Subscription = ProductSubscription | SearchSubscription;

export function rowIdentity(row: RateRow): string {
  return `${row.product_key}#${row.rate_index ?? 0}`;
}

export function productSubscriptionId(productKey: string, rateIndex: number | null): string {
  return `product:${productKey}:${rateIndex ?? 'all'}`;
}

function searchSnapshotKey(input: {
  section: SectionKey;
  path: string[];
  hierarchyScoped: boolean;
  query: string;
  sort?: SortKey;
  filters: FilterSnapshot;
}): string {
  return JSON.stringify({
    section: input.section,
    path: input.path,
    hierarchyScoped: input.hierarchyScoped,
    query: input.query.trim().toLowerCase(),
    filters: normalizeFilterSnapshot(input.filters),
  });
}

export function normalizeFilterSnapshot(filters: FilterSnapshot): FilterSnapshot {
  const sort = (xs: string[] | undefined) => (xs ? [...xs].sort() : []);
  return {
    providers: sort(filters?.providers),
    rateTypes: sort(filters?.rateTypes),
    lvrTiers: sort(filters?.lvrTiers),
    repaymentTypes: sort(filters?.repaymentTypes),
    loanPurposes: sort(filters?.loanPurposes),
    depositKinds: sort(filters?.depositKinds),
    interestPayments: sort(filters?.interestPayments),
    accountFeatures: sort(filters?.accountFeatures),
    eligibilityCriteria: sort(filters?.eligibilityCriteria),
    factCriteria: (filters?.factCriteria ?? [])
      .map(normalizeFactCriterion)
      .filter((criterion): criterion is NonNullable<typeof criterion> => criterion !== null)
      .sort((a, b) => factCriterionId(a).localeCompare(factCriterionId(b))),
    includeNonStandard: !!filters?.includeNonStandard,
  };
}

export function buildProductLabel(row: RateRow, rateIndex: number | null): string {
  const base = `${row.provider} · ${row.product_name}`;
  if (rateIndex == null) return base;
  const bits: string[] = [];
  if (row.rate_type) bits.push(humanizeEnum(row.rate_type));
  if (row.lvr_tier) bits.push(humanizeEnum(row.lvr_tier));
  const suffix = bits.length ? bits.join(' · ') : `rate #${rateIndex}`;
  return `${base} (${suffix})`;
}

export function buildSearchLabel(
  section: SectionKey,
  path: string[],
  query: string,
  filters: FilterSnapshot,
): string {
  const parts: string[] = [SECTIONS[section].title];
  if (path.length) {
    const crumb = breadcrumb(section, path).at(-1);
    if (crumb) parts.push(crumb);
  }
  const q = query.trim();
  if (q) parts.push(`"${q}"`);
  const n = activeFilterCount({ ...filters, factCriteria: filters.factCriteria ?? [], query: '' });
  if (n) parts.push(`${n} filter${n === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

export function makeProductSubscription(row: RateRow, rateIndex: number | null): ProductSubscription {
  return {
    id: productSubscriptionId(row.product_key, rateIndex),
    kind: 'product',
    productKey: row.product_key,
    rateIndex,
    label: buildProductLabel(row, rateIndex),
    createdAt: new Date().toISOString(),
  };
}

export function makeSearchSubscription(input: {
  section: SectionKey;
  path: string[];
  hierarchyScoped: boolean;
  query: string;
  sort?: SortKey;
  filters: FilterSnapshot;
}): SearchSubscription {
  const filters = normalizeFilterSnapshot(input.filters);
  const query = input.query.trim();
  return {
    id: `search:${searchSnapshotKey({ ...input, query, filters })}`,
    kind: 'search',
    section: input.section,
    path: [...input.path],
    hierarchyScoped: input.hierarchyScoped,
    query,
    sort: input.sort ?? 'rate',
    filters,
    label: buildSearchLabel(input.section, input.path, query, filters),
    createdAt: new Date().toISOString(),
  };
}

export function addSubscription(list: Subscription[], next: Subscription): Subscription[] {
  if (list.some((s) => s.id === next.id)) return list;
  return [...list, next];
}

export function removeSubscription(list: Subscription[], id: string): Subscription[] {
  return list.filter((s) => s.id !== id);
}

export function isProductSubscribed(
  list: Subscription[],
  productKey: string,
  rateIndex: number | null,
): boolean {
  return list.some(
    (s) =>
      s.kind === 'product' &&
      s.productKey === productKey &&
      (s.rateIndex === rateIndex || (s.rateIndex === null && rateIndex === null)),
  );
}

/** Saved tiers notify only when the user has explicitly enabled that exact alert. */
export function savedRatesWithAlerts(
  savedRates: readonly SavedRateRef[],
  subscriptions: Subscription[],
): SavedRateRef[] {
  return savedRates.filter((ref) => isProductSubscribed(
    subscriptions,
    ref.productKey,
    ref.scope === 'product' ? null : ref.rateIndex,
  ));
}

export function findSearchSubscription(
  list: Subscription[],
  input: {
    section: SectionKey;
    path: string[];
    hierarchyScoped: boolean;
    query: string;
    sort?: SortKey;
    filters: FilterSnapshot;
  },
): SearchSubscription | undefined {
  const id = `search:${searchSnapshotKey(input)}`;
  const hit = list.find(
    (s) =>
      s.kind === 'search' &&
      (s.id === id || searchSnapshotKey(s) === searchSnapshotKey(input)),
  );
  return hit?.kind === 'search' ? hit : undefined;
}

export function rowsForSearchSubscription(
  core: CorePayload,
  sub: SearchSubscription,
  detailsProducts?: Record<string, ProductDetail> | null,
): RateRow[] {
  const all = core.sections[sub.section]?.rates ?? [];
  const scoped = rowsForSearchScope(all, sub.section, sub.path, sub.hierarchyScoped);
  const filters = normalizeFilterSnapshot(sub.filters);
  return filterRows(
    scoped,
    { ...filters, factCriteria: filters.factCriteria ?? [], query: sub.query },
    detailsProducts,
    null,
    sub.section,
  );
}

function ratesMap(
  rows: RateRow[],
  section: SectionKey,
  depositRankMetric: RankMetric = 'base',
  mortgageRateMetric: MortgageRateMetric = 'comparison',
): Map<string, TrackedRateValue> {
  const out = new Map<string, TrackedRateValue>();
  for (const row of rows) {
    out.set(rowIdentity(row), trackedRateValue(
      row,
      section,
      depositRankMetric,
      mortgageRateMetric,
    ));
  }
  return out;
}

export type TrackedRateMetric = 'advertised' | 'comparison' | 'ranked';

export interface TrackedRateValue {
  row: RateRow;
  fraction: number | null;
  metric?: TrackedRateMetric;
}

/** Keep the chosen metric attached to a notification comparison. Catalogue
 * ranking may fall back from comparison to advertised rate, but a publish/
 * unpublish transition must not be reported as though one metric moved. */
export function trackedRateValue(
  row: RateRow,
  section: SectionKey,
  depositRankMetric: RankMetric = 'base',
  mortgageRateMetric: MortgageRateMetric = 'comparison',
  depositValue: 'ranked' | 'advertised' = 'ranked',
): TrackedRateValue {
  if (section === 'Mortgage') {
    const comparison = toFraction(row.comparison_rate);
    if (mortgageRateMetric === 'comparison' && comparison !== null) {
      return { row, fraction: comparison, metric: 'comparison' };
    }
    return { row, fraction: toFraction(row.rate), metric: 'advertised' };
  }
  return {
    row,
    fraction: depositValue === 'advertised'
      ? toFraction(row.rate)
      : rankFraction(row, section, depositRankMetric, mortgageRateMetric),
    metric: depositValue,
  };
}

function productRatesByIndex(
  core: CorePayload,
  productKey: string,
  rateIndex: number | null,
  depositRankMetric: RankMetric = 'base',
  mortgageRateMetric: MortgageRateMetric = 'comparison',
): Map<number, TrackedRateValue> {
  const out = new Map<number, TrackedRateValue>();
  for (const section of Object.keys(core.sections) as SectionKey[]) {
    for (const row of core.sections[section]?.rates ?? []) {
      if (row.product_key !== productKey) continue;
      if (rateIndex != null && row.exact_alert_eligible === false) continue;
      if (rateIndex != null && row.rate_index !== rateIndex) continue;
      out.set(row.rate_index ?? out.size, trackedRateValue(
        row,
        section,
        depositRankMetric,
        mortgageRateMetric,
        'advertised',
      ));
    }
  }
  return out;
}

export interface RateChangeHit {
  row: RateRow;
  from: number;
  to: number;
  bps: number;
}

export function largestRateChange(
  before: Map<string | number, TrackedRateValue>,
  after: Map<string | number, TrackedRateValue>,
  thresholdBps: number,
  keyOf: (k: string | number) => string | number = (k) => k,
): RateChangeHit | null {
  let biggest: RateChangeHit | null = null;
  for (const [key, nw] of after) {
    const od = before.get(keyOf(key));
    if (!od || od.fraction === null || nw.fraction === null) continue;
    if (od.metric && nw.metric && od.metric !== nw.metric) continue;
    const bps = Math.abs(bpsBetween(nw.fraction, od.fraction) ?? 0);
    if (bps >= thresholdBps && (!biggest || bps > biggest.bps)) {
      biggest = { row: nw.row, from: od.fraction, to: nw.fraction, bps };
    }
  }
  return biggest;
}

export interface NotifyMessage {
  title: string;
  body: string;
}

export function computeSubscriptionChanges(
  oldCore: CorePayload | null,
  newCore: CorePayload,
  subscriptions: Subscription[],
  thresholdBps: number,
  oldDetailsProducts?: Record<string, ProductDetail> | null,
  newDetailsProducts?: Record<string, ProductDetail> | null,
  depositRankMetric: RankMetric = 'base',
  mortgageRateMetric: MortgageRateMetric = 'comparison',
): NotifyMessage[] {
  if (!oldCore || !subscriptions.length) return [];
  const messages: NotifyMessage[] = [];
  const oldDetails = oldDetailsProducts;
  const newDetails = newDetailsProducts ?? oldDetailsProducts;

  for (const sub of subscriptions) {
    if (sub.kind === 'product') {
      const hit = largestRateChange(
        productRatesByIndex(oldCore, sub.productKey, sub.rateIndex, depositRankMetric, mortgageRateMetric),
        productRatesByIndex(newCore, sub.productKey, sub.rateIndex, depositRankMetric, mortgageRateMetric),
        thresholdBps,
      );
      if (hit) {
        messages.push({
          title: `${hit.row.provider} rate changed`,
          body: `${hit.row.product_name}: ${formatRate(hit.from)} → ${formatRate(hit.to)}.`,
        });
      }
      continue;
    }

    const hit = largestRateChange(
      ratesMap(rowsForSearchSubscription(oldCore, sub, oldDetails), sub.section, depositRankMetric, mortgageRateMetric),
      ratesMap(rowsForSearchSubscription(newCore, sub, newDetails), sub.section, depositRankMetric, mortgageRateMetric),
      thresholdBps,
    );
    if (hit) {
      messages.push({
        title: `Search alert: ${sub.label}`,
        body: `${hit.row.provider} ${hit.row.product_name}: ${formatRate(hit.from)} → ${formatRate(hit.to)}.`,
      });
    }
  }

  return messages;
}
