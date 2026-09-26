import { SECTION_KEYS, type CorePayload, type RateRow, type SectionKey } from '../types';
import { isBroadlyAvailable, isConditionalDepositRate, isNonStandard } from './format';
import { mandatoryEligibleRows } from './eligibilityGate';
import { isExplicitTermDepositProduct } from './sectionIntegrity';
import { normalizeProfileFilters, profileFeaturesForSection, profileFilterRows, type ProfileFilters } from './profile';
import { featureEvidenceMatches, featureEvidenceScope } from './productFacts';
import { summarizeBankRates, type BankRateScope, type BankRateSnapshot, type RateSummary } from './bankRateOverview';
import { validateHistoricalBankRateCatalogue, validateHistoricalBankRateCatalogueAsync, type HistoricalBankRateCatalogue, type HistoricalCatalogueTier } from './historicalBankRateCatalogueWire';

export type { HistoricalBankRateCatalogue, HistoricalCatalogueEvidence, HistoricalCatalogueSource } from './historicalBankRateCatalogueWire';
export interface HistoricalCatalogueFilters {
  profileFilters: ProfileFilters;
  interests: readonly SectionKey[];
  includeNonStandard: boolean;
}
export interface PreparedHistoricalBankRateCatalogue {
  readonly catalogue: HistoricalBankRateCatalogue;
  readonly quarantinedTierCount: number;
}
interface TierState { tier: HistoricalCatalogueTier; broad: Map<number, boolean>; features: Map<string, boolean> }
interface PreparedState {
  sections: Record<SectionKey, TierState[]>;
  snapshots: Map<string, Record<string, BankRateSnapshot>>;
  current: WeakMap<CorePayload, Map<string, Record<string, BankRateSnapshot>>>;
  broad: Map<string, boolean>;
}
const prepared = new WeakMap<object, PreparedHistoricalBankRateCatalogue | null>();
const states = new WeakMap<PreparedHistoricalBankRateCatalogue, PreparedState>();
const preparing = new WeakMap<object, Promise<PreparedHistoricalBankRateCatalogue | null>>();

function installPrepared(value: HistoricalBankRateCatalogue, sections: PreparedState['sections'], quarantinedTierCount: number): PreparedHistoricalBankRateCatalogue {
  const existing = prepared.get(value);
  if (existing) return existing;
  const result = Object.freeze({ catalogue: value, quarantinedTierCount });
  states.set(result, { sections, snapshots: new Map(), current: new WeakMap(), broad: new Map() });
  prepared.set(value, result);
  return result;
}

/** Call once for an immutable, transport-verified payload, before core adoption. */
export function prepareHistoricalBankRateCatalogue(value: unknown): PreparedHistoricalBankRateCatalogue | null {
  if (!value || typeof value !== 'object') return null;
  if (prepared.has(value)) return prepared.get(value)!;
  if (!validateHistoricalBankRateCatalogue(value)) { prepared.set(value, null); return null; }
  let quarantinedTierCount = 0;
  const sections = Object.fromEntries(SECTION_KEYS.map(section => [section, value.sections[section].flatMap(tier => {
    if (section === 'Savings' && isExplicitTermDepositProduct(tier.row)) { quarantinedTierCount++; return []; }
    return [{ tier, broad: new Map<number, boolean>(), features: new Map<string, boolean>() }];
  })])) as PreparedState['sections'];
  return installPrepared(value, sections, quarantinedTierCount);
}

/** Validate and construct the same cached representation without one long
 * synchronous scan on the React Native UI thread. Input must remain immutable. */
export async function prepareHistoricalBankRateCatalogueAsync(value: unknown,
  yieldWork: () => Promise<void> = async () => (await import('../lib/yieldToUi')).yieldToUi()): Promise<PreparedHistoricalBankRateCatalogue | null> {
  if (!value || typeof value !== 'object') return null;
  if (prepared.has(value)) return prepared.get(value)!;
  if (preparing.has(value)) return preparing.get(value)!;
  const task = (async () => {
    if (!await validateHistoricalBankRateCatalogueAsync(value, yieldWork)) { prepared.set(value, null); return null; }
    const catalogue = value as HistoricalBankRateCatalogue;
    let quarantinedTierCount = 0, count = 0, started = Date.now();
    const sections: PreparedState['sections'] = { Mortgage: [], Savings: [], TD: [] };
    for (const section of SECTION_KEYS) for (const tier of catalogue.sections[section]) {
      if (section === 'Savings' && isExplicitTermDepositProduct(tier.row)) quarantinedTierCount++;
      else sections[section].push({ tier, broad: new Map(), features: new Map() });
      if (++count % 32 === 0 && Date.now() - started >= 8) { await yieldWork(); started = Date.now(); }
    }
    return installPrepared(catalogue, sections, quarantinedTierCount);
  })();
  preparing.set(value, task);
  try { return await task; } finally { preparing.delete(value); }
}

function normalizedFilters(filters: HistoricalCatalogueFilters) {
  const profile = normalizeProfileFilters(filters.profileFilters);
  for (const key of Object.keys(profile) as (keyof ProfileFilters)[]) profile[key] = [...new Set(profile[key])].sort();
  const interests = SECTION_KEYS.filter(section => filters.interests.includes(section));
  const key = JSON.stringify([profile, interests, filters.includeNonStandard]);
  return { profile, interests, key };
}

function evidenceAllows(state: TierState, evidenceId: number, section: SectionKey, catalogue: HistoricalBankRateCatalogue,
  features: string[], includeNonStandard: boolean, broad: Map<string, boolean>): boolean {
  const evidence = catalogue.evidence[evidenceId];
  if (evidence.status !== 'known') return includeNonStandard && !features.length;
  // Descriptors intentionally have no observation fields; these predicates read only descriptive scope.
  const row = state.tier.row as RateRow;
  if (!includeNonStandard) {
    if (!state.broad.has(evidenceId)) {
      // Different rate tiers often share access evidence. Include every input to
      // the central classifier; row-specific conditional/restricted siblings differ.
      const key = JSON.stringify([evidenceId, row.provider, row.product_name, isNonStandard(row), isConditionalDepositRate(row)]);
      if (!broad.has(key)) broad.set(key, isBroadlyAvailable(row, evidence.detail));
      state.broad.set(evidenceId, broad.get(key)!);
    }
    if (!state.broad.get(evidenceId)) return false;
  }
  if (!features.length) return true;
  const scope = featureEvidenceScope(row.product_key, row, section);
  return features.every(feature => {
    const key = `${evidenceId}:${feature}`;
    if (!state.features.has(key)) state.features.set(key, featureEvidenceMatches(evidence.detail, feature, true, scope));
    return state.features.get(key)!;
  });
}

type Changes = Map<string, Map<number, number>>;
function addEvent(events: Changes[], index: number, provider: string, rates: number[], direction: number): void {
  if (index >= events.length) return;
  const changes = events[index].get(provider) ?? new Map<number, number>();
  for (const rate of rates) changes.set(rate, (changes.get(rate) ?? 0) + direction);
  events[index].set(provider, changes);
}

function summarize(counts: Map<number, number>): RateSummary {
  const values = [...counts].sort(([a], [b]) => a - b);
  let count = 0, sum = 0;
  for (const [rate, frequency] of values) { count += frequency; sum += rate * frequency; }
  const left = Math.floor((count - 1) / 2), right = Math.floor(count / 2);
  let seen = 0, low: number | undefined, high = 0;
  for (const [rate, frequency] of values) {
    seen += frequency;
    if (low === undefined && seen > left) low = rate;
    if (seen > right) { high = rate; break; }
  }
  return { min: values[0][0], max: values.at(-1)![0], mean: sum / count, median: (low! + high) / 2, count };
}

function eventSnapshots(events: Changes[]): Record<string, RateSummary>[] {
  const banks = new Map<string, Map<number, number>>();
  let current: Record<string, RateSummary> = {};
  return events.map(changesByBank => {
    if (!changesByBank.size) return current;
    current = { ...current };
    for (const [provider, changes] of changesByBank) {
      const counts = banks.get(provider) ?? new Map<number, number>();
      let changed = false;
      for (const [rate, delta] of changes) if (delta) {
        changed = true;
        const count = (counts.get(rate) ?? 0) + delta;
        if (count) counts.set(rate, count); else counts.delete(rate);
      }
      banks.set(provider, counts);
      if (changed) {
        if (counts.size) Object.defineProperty(current, provider, { value: summarize(counts), enumerable: true, configurable: true, writable: true });
        else delete current[provider];
      }
    }
    return current;
  });
}

function historicalSnapshots(preparation: PreparedHistoricalBankRateCatalogue, state: PreparedState,
  filters: HistoricalCatalogueFilters, normalized: ReturnType<typeof normalizedFilters>): Record<string, BankRateSnapshot> {
  if (state.snapshots.has(normalized.key)) return state.snapshots.get(normalized.key)!;
  const catalogue = preparation.catalogue;
  const snapshots: Record<string, BankRateSnapshot> = Object.fromEntries(catalogue.run_dates.map(day => [day, {}]));
  const structural = { ...normalized.profile, accountFeatures: [] };
  for (const section of normalized.interests) {
    const events: Changes[] = catalogue.run_dates.map(() => new Map());
    const features = profileFeaturesForSection(normalized.profile, section);
    for (const tierState of state.sections[section]) {
      if (!profileFilterRows([tierState.tier.row as RateRow], structural, section).length) continue;
      for (const [start, count, rates, evidenceId] of tierState.tier.spans) {
        if (!evidenceAllows(tierState, evidenceId, section, catalogue, features, filters.includeNonStandard, state.broad)) continue;
        addEvent(events, start, tierState.tier.row.provider, rates, 1);
        addEvent(events, start + count, tierState.tier.row.provider, rates, -1);
      }
    }
    eventSnapshots(events).forEach((banks, index) => { snapshots[catalogue.run_dates[index]][section] = banks; });
  }
  if (state.snapshots.size >= 8) state.snapshots.delete(state.snapshots.keys().next().value!);
  state.snapshots.set(normalized.key, snapshots);
  return snapshots;
}

/** All banks are calculated together; provider selection never enters this key.
 * Historical predicates never borrow the installed current-core eligibility or details.
 * Current observations still require original core references and the live mandatory gate. */
export function historicalBankRateSnapshots(preparation: PreparedHistoricalBankRateCatalogue, core: CorePayload,
  currentScope: BankRateScope, filters: HistoricalCatalogueFilters): Record<string, BankRateSnapshot> {
  const state = states.get(preparation);
  if (!state) throw new Error('Historical catalogue was not prepared');
  const normalized = normalizedFilters(filters);
  const rowKeys: string[] = [];
  const currentRows = Object.fromEntries(SECTION_KEYS.map(section => {
    const admitted = new Map(core.sections[section].rates.map((row, index) => [row, index]));
    const rows = normalized.interests.includes(section)
      ? mandatoryEligibleRows(currentScope.rows[section].filter(row => admitted.has(row))) : [];
    rowKeys.push(rows.map(row => admitted.get(row)).join(','));
    return [section, rows];
  })) as BankRateScope['rows'];
  const key = `${normalized.key}|${rowKeys.join('|')}`;
  const cache = state.current.get(core) ?? new Map<string, Record<string, BankRateSnapshot>>();
  if (cache.has(key)) return cache.get(key)!;
  const history = historicalSnapshots(preparation, state, filters, normalized);
  const snapshots = Object.fromEntries(Object.entries(history).filter(([day]) => day < core.run_date));
  // A legacy current core can be newer than the last packed day. Retain real calendar gaps.
  const last = preparation.catalogue.run_dates.at(-1)!;
  let days = Object.keys(snapshots).length;
  for (let day = Date.parse(last) + 86_400_000; day < Date.parse(core.run_date); day += 86_400_000) {
    if (++days >= 5000) break;
    snapshots[new Date(day).toISOString().slice(0, 10)] = {};
  }
  snapshots[core.run_date] = Object.fromEntries(SECTION_KEYS.map(section => [section, summarizeBankRates(currentRows[section])]));
  if (cache.size >= 8) cache.delete(cache.keys().next().value!);
  cache.set(key, snapshots); state.current.set(core, cache);
  return snapshots;
}
