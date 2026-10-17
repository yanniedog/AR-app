import { hasMandatoryRequirements } from './eligibilityGate';
import { SECTIONS } from '../constants';
import { uiJoin, uiProviderName, uiProductName } from '../lib/uiCopy';
import type { LegacyProductAliasMap } from '../contracts/v3/canonicalCoreAdapter';
import type { CorePayload, ProductDetail, RateRow, SectionKey } from '../types';
import { SECTION_KEYS } from '../types';
import { bpsBetween, formatRate, humanizeEnum, toFraction } from './format';
import type { SavedRateRef } from './savedRates';
import { activeFilterCount, filterRows, rankFraction, type Filters, type MortgageRateMetric, type RankMetric, type SortKey } from './selectors';
import { breadcrumb, rowsForSearchScope } from './taxonomy';
import { factCriterionId, normalizeFactCriterion } from './productFactsCore';
import { lvrTierDisplay, refreshLvrLabelText } from './lvrTier';
import { publicOfferRefId } from './publicOfferIdentity';

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
  offerId?: string;
  programmeId?: string;
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

export function productSubscriptionId(productKey: string, rateIndex: number | null, offerId?: string): string {
  if (offerId) return publicOfferRefId('product', productKey, offerId);
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
  if (row.lvr_tier) bits.push(lvrTierDisplay(row.lvr_tier));
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

/** Bring product-alert labels saved by older builds up to the current LVR wording. */
export function refreshProductSubscriptionLabels(list: Subscription[]): Subscription[] {
  let changed = false;
  const next = list.map((sub) => {
    // Product-wide alerts store only "provider · product name"; never rewrite a name.
    if (sub.kind !== 'product' || sub.rateIndex == null || typeof sub.label !== 'string') return sub;
    const label = refreshLvrLabelText(sub.label);
    if (label === sub.label) return sub;
    changed = true;
    return { ...sub, label };
  });
  return changed ? next : list;
}

export function makeProductSubscription(row: RateRow, rateIndex: number | null): ProductSubscription {
  const exact = rateIndex != null || row.rate_index == null && row.exact_alert_eligible === true;
  return {
    id: productSubscriptionId(row.product_key, rateIndex, exact ? row.public_offer_id : undefined),
    kind: 'product',
    productKey: row.product_key,
    rateIndex,
    label: buildProductLabel(row, rateIndex),
    createdAt: new Date().toISOString(),
    ...(exact && row.public_offer_id ? { offerId: row.public_offer_id } : {}),
    ...(exact && row.public_programme_id ? { programmeId: row.public_programme_id } : {}),
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

/** Re-key persisted semantic refs from their retained fields before deduping. */
export function normalizeProductSubscriptionIds(list: Subscription[]): Subscription[] {
  const out = new Map<string, Subscription>();
  let changed = false;
  for (const sub of list) {
    const id = sub.kind === 'product' && sub.offerId
      ? productSubscriptionId(sub.productKey, sub.rateIndex, sub.offerId) : sub.id;
    const next = id === sub.id ? sub : { ...sub, id };
    if (next !== sub || out.has(id)) changed = true;
    if (!out.has(id)) out.set(id, next);
  }
  return changed ? [...out.values()] : list;
}

export function removeSubscription(list: Subscription[], id: string): Subscription[] {
  return list.filter((s) => s.id !== id);
}

export interface ProductSubscriptionAliasMigration {
  subscriptions: Subscription[];
  /** Exact v1 rate indexes have no authenticated mapping to v3 rate UIDs. */
  droppedExactSubscriptionIds: string[];
}

export function migrateProductSubscriptionAliases(
  list: readonly Subscription[],
  aliases: LegacyProductAliasMap,
): ProductSubscriptionAliasMigration {
  const subscriptions = new Map<string, Subscription>();
  const droppedExactSubscriptionIds: string[] = [];
  for (const subscription of list) {
    if (subscription.kind !== 'product') {
      subscriptions.set(subscription.id, subscription);
      continue;
    }
    const target = aliases.get(subscription.productKey);
    if (!target) {
      subscriptions.set(subscription.id, subscription);
      continue;
    }
    if (subscription.rateIndex !== null) {
      droppedExactSubscriptionIds.push(subscription.id);
      continue;
    }
    const migrated: ProductSubscription = {
      ...subscription,
      id: productSubscriptionId(target.productKey, null),
      productKey: target.productKey,
    };
    subscriptions.set(migrated.id, migrated);
  }
  return { subscriptions: [...subscriptions.values()], droppedExactSubscriptionIds };
}

export function isProductSubscribed(
  list: Subscription[],
  productKey: string,
  rateIndex: number | null,
  offerId?: string,
): boolean {
  return list.some(
    (s) =>
      s.kind === 'product' &&
      s.productKey === productKey &&
      (offerId ? s.offerId === offerId : !s.offerId && s.rateIndex === rateIndex),
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
    ref.offerId,
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
  for (const sectionKey of Object.keys(core.sections)) {
    const section = SECTION_KEYS.find(known => known === sectionKey);
    if (!section) continue;
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
  title: import('../lib/uiCopy').UiCopy;
  body: import('../lib/uiCopy').UiCopy;
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
  // Historical product eligibility needs independently verified dated details.
  if (!oldCore || !subscriptions.length || hasMandatoryRequirements()) return [];
  const messages: NotifyMessage[] = [];
  const oldDetails = oldDetailsProducts;
  const newDetails = newDetailsProducts ?? oldDetailsProducts;

  for (const sub of subscriptions) {
    if (sub.kind === 'product') {
      if (sub.offerId) continue; // Public semantic watches use the shared resolver path.
      const hit = largestRateChange(
        productRatesByIndex(oldCore, sub.productKey, sub.rateIndex, depositRankMetric, mortgageRateMetric),
        productRatesByIndex(newCore, sub.productKey, sub.rateIndex, depositRankMetric, mortgageRateMetric),
        thresholdBps,
      );
      if (hit) {
        messages.push({
          title: uiJoin(uiProviderName(hit.row), ' · ', 'Rate changed'),
          body: uiJoin(uiProductName(hit.row), ': ', formatRate(hit.from), ' → ', formatRate(hit.to)),
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
        title: 'Search alert',
        body: uiJoin(uiProviderName(hit.row), ' · ', uiProductName(hit.row), ': ', formatRate(hit.from), ' → ', formatRate(hit.to)),
      });
    }
  }

  return messages;
}
