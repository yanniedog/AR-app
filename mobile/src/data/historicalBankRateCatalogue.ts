import { SECTION_KEYS, type CorePayload, type RateRow, type SectionKey } from '../types';
import { isBroadlyAvailable, isConditionalDepositRate, isNonStandard } from './rateClassification';
import { getMandatoryEligibilityRevision, mandatoryEligibleRows } from './eligibilityGate';
import { getSuitabilityRevision } from './suitabilityGate';
import { isExplicitTermDepositProduct } from './sectionIntegrity';
import { normalizeProfileFilters, profileFeaturesForSection, profileFilterRows, type ProfileFilters } from './profile';
import { featureEvidenceMatches, featureEvidenceScope } from './productFactsCore';
import { bankRateScope, snapshotBankRates, type BankRateScope, type BankRateSnapshot, type RateSummary } from './bankRateOverview';
import { HISTORICAL_CATALOGUE_LIMITS, validateHistoricalBankRateCatalogue, validateHistoricalBankRateCatalogueAsync, type HistoricalBankRateCatalogue, type HistoricalCatalogueTier } from './historicalBankRateCatalogueWire';
import { isValidCalendarDate } from '../lib/calendarDate';
import { historicalReadySnapshots, validateHistoricalBankRateReadyForApp, type ReadyHistorySource } from './historicalBankRateReady';
import type { HistoricalBankRateReady } from './historicalBankRateReadyWire';

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
  selection?: { dates: ReadonlySet<string>; fallback: PreparedHistoricalBankRateCatalogue | null };
  ready?: readonly ReadyHistorySource[];
  sections: Record<SectionKey, TierState[]>;
  snapshots: Map<string, Record<string, BankRateSnapshot>>;
  current: WeakMap<CorePayload, Map<string, Record<string, BankRateSnapshot>>>;
  broad: Map<string, boolean>;
  pendingSnapshots: Map<string, Promise<Record<string, BankRateSnapshot>>>;
  scopes: WeakMap<CorePayload, WeakMap<BankRateScope, Map<string, { revision: number; snapshots: Record<string, BankRateSnapshot> }>>>;
}
/** Ready inputs have already completed producer classification. Date ownership
 * is explicit, so a newer source cannot accidentally double-count a baseline. */
export function prepareHistoricalBankRateReadySources(inputs: readonly ReadyHistorySource[]): PreparedHistoricalBankRateCatalogue | null {
  if (!inputs.length || inputs.some(input => !validateHistoricalBankRateReadyForApp(input.ready))) return null;
  const sources: HistoricalBankRateCatalogue['sources'] = {}, unavailable: Record<string, string> = {};
  const selected = new Set<string>();
  const ready: ReadyHistorySource[] = [];
  let first = inputs[0].ready.run_dates[0], last = inputs[0].ready.run_dates.at(-1)!;
  for (const input of inputs) {
    first = first < input.ready.run_dates[0] ? first : input.ready.run_dates[0];
    last = last > input.ready.run_dates.at(-1)! ? last : input.ready.run_dates.at(-1)!;
    const axis = new Set(input.ready.run_dates);
    for (const day of input.acceptedDates) {
      if (!axis.has(day) || selected.has(day) || !Object.hasOwn(input.ready.sources, day) || Object.hasOwn(input.ready.unavailable_dates, day)) return null;
      selected.add(day); sources[day] = input.ready.sources[day];
    }
    ready.push({ ready: input.ready, acceptedDates: [...input.acceptedDates] });
  }
  const length = (Date.parse(last) - Date.parse(first)) / 86_400_000 + 1;
  if (length > HISTORICAL_CATALOGUE_LIMITS.days) return null;
  const run_dates = Array.from({ length }, (_, index) => new Date(Date.parse(first) + index * 86_400_000).toISOString().slice(0, 10));
  for (const day of run_dates) if (!selected.has(day)) unavailable[day] = inputs.map(input => input.ready.unavailable_dates[day]).find(Boolean) ?? 'No accepted historical source';
  const catalogue: HistoricalBankRateCatalogue = { schema_version: 2, run_dates, sources, unavailable_dates: unavailable,
    evidence: [{ status: 'unknown' }], sections: { Mortgage: [], Savings: [], TD: [] } };
  const result = installPrepared(catalogue, { Mortgage: [], Savings: [], TD: [] }, inputs.reduce((sum, input) => sum + input.ready.quarantined_tier_count, 0));
  states.get(result)!.ready = ready;
  return result;
}
const readyPrepared = new WeakMap<HistoricalBankRateReady, Map<string, PreparedHistoricalBankRateCatalogue>>();
export function prepareHistoricalBankRateReady(ready: HistoricalBankRateReady, acceptedDates: readonly string[] = Object.keys(ready.sources).filter(day => !Object.hasOwn(ready.unavailable_dates, day))): PreparedHistoricalBankRateCatalogue | null {
  const key = JSON.stringify(acceptedDates), cache = readyPrepared.get(ready) ?? new Map<string, PreparedHistoricalBankRateCatalogue>();
  if (cache.has(key)) return cache.get(key)!;
  const result = prepareHistoricalBankRateReadySources([{ ready, acceptedDates }]);
  if (result) {
    if (cache.size >= 8) cache.delete(cache.keys().next().value!);
    cache.set(key, result); readyPrepared.set(ready, cache);
  }
  return result;
}
export function preparedReadySources(value: PreparedHistoricalBankRateCatalogue): readonly ReadyHistorySource[] | null {
  return states.get(value)?.ready ?? null;
}
const prepared = new WeakMap<object, PreparedHistoricalBankRateCatalogue | null>();
const states = new WeakMap<PreparedHistoricalBankRateCatalogue, PreparedState>();
const selectedCatalogues = new WeakMap<PreparedHistoricalBankRateCatalogue, {
  fallback: PreparedHistoricalBankRateCatalogue | null; dates: string; prepared: PreparedHistoricalBankRateCatalogue;
}>();
export const isPreparedHistoricalBankRateCatalogue = (value: PreparedHistoricalBankRateCatalogue): boolean => states.has(value);
export const historicalCatalogueSelection = (value: PreparedHistoricalBankRateCatalogue) => states.get(value)?.selection;

/** Overlay verified legacy dates on the selected prepared fallback without
 * decoding or embedding the obsolete raw APK archive. Each request owns caches. */
export function selectHistoricalCatalogueDates(primary: PreparedHistoricalBankRateCatalogue,
  dates: ReadonlySet<string>, fallback: PreparedHistoricalBankRateCatalogue | null): PreparedHistoricalBankRateCatalogue {
  const state = states.get(primary);
  if (!state || (fallback && !states.has(fallback))) throw new Error('History was not prepared');
  const key = JSON.stringify([...dates].sort()), cached = selectedCatalogues.get(primary);
  if (cached?.fallback === fallback && cached.dates === key) return cached.prepared;
  const first = [primary.catalogue.run_dates[0], fallback?.catalogue.run_dates[0]].filter(Boolean).sort()[0];
  const last = [primary.catalogue.run_dates.at(-1)!, fallback?.catalogue.run_dates.at(-1)].filter(Boolean).sort().at(-1)!;
  if ((Date.parse(last) - Date.parse(first!)) / 86_400_000 >= HISTORICAL_CATALOGUE_LIMITS.days) throw new Error('History calendar exceeds budget');
  const result = Object.freeze({ ...primary });
  states.set(result, { ...state, selection: { dates: new Set(dates), fallback },
    snapshots: new Map(), current: new WeakMap(), pendingSnapshots: new Map(), scopes: new WeakMap() });
  selectedCatalogues.set(primary, { fallback, dates: key, prepared: result });
  return result;
}
const preparing = new WeakMap<object, Promise<PreparedHistoricalBankRateCatalogue | null>>();

function installPrepared(value: HistoricalBankRateCatalogue, sections: PreparedState['sections'], quarantinedTierCount: number): PreparedHistoricalBankRateCatalogue {
  const existing = prepared.get(value);
  if (existing) return existing;
  const result = Object.freeze({ catalogue: value, quarantinedTierCount });
  states.set(result, { sections, snapshots: new Map(), current: new WeakMap(), broad: new Map(), pendingSnapshots: new Map(), scopes: new WeakMap() });
  prepared.set(value, result);
  return result;
}

/** Render-safe lookup; validation and preparation belong outside rendering. */
export function cachedPreparedHistoricalBankRateCatalogue(value: unknown): PreparedHistoricalBankRateCatalogue | null {
  return value && typeof value === 'object' ? prepared.get(value) ?? null : null;
}

/** Carry the validation receipt across an immutable, append-only calendar
 * extension. Observations and evidence must retain their exact references.
 * New dates have no observations, so existing spans remain valid. Snapshot and
 * current-core caches start empty; only tier classification state is shared.
 * Null means the caller must use normal full validation/preparation. */
export function prepareHistoricalCatalogueAxisExtension(original: HistoricalBankRateCatalogue,
  runDates: readonly string[]): PreparedHistoricalBankRateCatalogue | null {
  const previous = cachedPreparedHistoricalBankRateCatalogue(original);
  const state = previous && states.get(previous);
  if (!previous || !state || !Array.isArray(runDates) ||
      runDates.length <= original.run_dates.length || runDates.length > HISTORICAL_CATALOGUE_LIMITS.days) return null;
  for (let index = 0; index < runDates.length; index++) {
    const day = runDates[index];
    if (index < original.run_dates.length) {
      if (day !== original.run_dates[index]) return null;
    } else if (!isValidCalendarDate(day) || Date.parse(day) - Date.parse(runDates[index - 1]) !== 86_400_000) return null;
  }
  const extension = { ...original, run_dates: [...runDates] };
  const result = installPrepared(extension, state.sections, previous.quarantinedTierCount);
  if (state.ready) states.get(result)!.ready = state.ready;
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

interface SectionSnapshot { banks: Record<string, RateSummary>; total?: RateSummary }
function* eventSnapshots(events: Changes[]): Generator<void, SectionSnapshot[]> {
  const banks = new Map<string, Map<number, number>>();
  const totalCounts = new Map<number, number>();
  let current: Record<string, RateSummary> = {};
  let total: RateSummary | undefined;
  const snapshots: SectionSnapshot[] = [];
  for (const changesByBank of events) {
    if (!changesByBank.size) { snapshots.push({ banks: current, total }); yield; continue; }
    current = { ...current };
    let totalChanged = false;
    for (const [provider, changes] of changesByBank) {
      const counts = banks.get(provider) ?? new Map<number, number>();
      let changed = false;
      for (const [rate, delta] of changes) if (delta) {
        changed = true;
        const count = (counts.get(rate) ?? 0) + delta;
        if (count) counts.set(rate, count); else counts.delete(rate);
        const totalCount = (totalCounts.get(rate) ?? 0) + delta;
        if (totalCount) totalCounts.set(rate, totalCount); else totalCounts.delete(rate);
        totalChanged = true;
      }
      banks.set(provider, counts);
      if (changed) {
        if (counts.size) Object.defineProperty(current, provider, { value: summarize(counts), enumerable: true, configurable: true, writable: true });
        else delete current[provider];
      }
      yield;
    }
    if (totalChanged) total = totalCounts.size ? summarize(totalCounts) : undefined;
    snapshots.push({ banks: current, total });
  }
  return snapshots;
}

function* historicalSnapshots(preparation: PreparedHistoricalBankRateCatalogue, state: PreparedState,
  filters: HistoricalCatalogueFilters, normalized: ReturnType<typeof normalizedFilters>): Generator<void, Record<string, BankRateSnapshot>> {
  if (state.snapshots.has(normalized.key)) return state.snapshots.get(normalized.key)!;
  const catalogue = preparation.catalogue;
  const snapshots: Record<string, BankRateSnapshot> = Object.fromEntries(catalogue.run_dates.map(day => [day, {}]));
  if (state.ready) {
    for (const day of catalogue.run_dates) snapshots[day] = Object.fromEntries(normalized.interests.map(section => [section, {}]));
    for (const source of state.ready) {
      const observed = yield* historicalReadySnapshots(source.ready, filters);
      for (const day of source.acceptedDates) snapshots[day] = observed[day];
    }
    if (state.snapshots.size >= 8) state.snapshots.delete(state.snapshots.keys().next().value!);
    state.snapshots.set(normalized.key, snapshots);
    return snapshots;
  }
  const structural = { ...normalized.profile, accountFeatures: [] };
  for (const section of normalized.interests) {
    const events: Changes[] = catalogue.run_dates.map(() => new Map());
    const features = profileFeaturesForSection(normalized.profile, section);
    for (const tierState of state.sections[section]) {
      yield;
      if (!profileFilterRows([tierState.tier.row as RateRow], structural, section).length) continue;
      for (const [start, count, rates, evidenceId] of tierState.tier.spans) {
        yield;
        if (!evidenceAllows(tierState, evidenceId, section, catalogue, features, filters.includeNonStandard, state.broad)) continue;
        addEvent(events, start, tierState.tier.row.provider, rates, 1);
        addEvent(events, start + count, tierState.tier.row.provider, rates, -1);
      }
    }
    (yield* eventSnapshots(events)).forEach(({ banks, total }, index) => {
      const snapshot = snapshots[catalogue.run_dates[index]];
      snapshot[section] = banks;
      if (total) (snapshot.sectionTotals ??= {})[section] = total;
    });
  }
  if (state.selection) {
    const { dates, fallback } = state.selection;
    const fallbackState = fallback && states.get(fallback);
    const needsFallback = fallback && fallback.catalogue.run_dates.some(day => !dates.has(day) && !!fallback.catalogue.sources[day]);
    const older = needsFallback && fallbackState
      ? yield* historicalSnapshots(fallback, fallbackState, filters, normalized) : {};
    for (const day of new Set([...catalogue.run_dates, ...Object.keys(older)])) {
      if (!dates.has(day)) snapshots[day] = older[day] ?? {};
    }
  }
  if (state.snapshots.size >= 8) state.snapshots.delete(state.snapshots.keys().next().value!);
  state.snapshots.set(normalized.key, snapshots);
  return snapshots;
}

function runSnapshots(generator: Generator<void, Record<string, BankRateSnapshot>>): Record<string, BankRateSnapshot> {
  let next = generator.next();
  while (!next.done) next = generator.next();
  return next.value;
}

const gateRevision = () => getMandatoryEligibilityRevision() + getSuitabilityRevision();
function rememberScope(state: PreparedState, core: CorePayload, scope: BankRateScope, key: string, snapshots: Record<string, BankRateSnapshot>) {
  const scopes = state.scopes.get(core) ?? new WeakMap();
  const cache = scopes.get(scope) ?? new Map();
  if (cache.size >= 8) cache.delete(cache.keys().next().value!);
  cache.set(key, { revision: gateRevision(), snapshots }); scopes.set(scope, cache); state.scopes.set(core, scopes);
  return snapshots;
}

/** No tier scan, current-row scan or aggregation. A changed gate fails closed. */
export function cachedHistoricalBankRateSnapshots(preparation: PreparedHistoricalBankRateCatalogue, core: CorePayload,
  currentScope: BankRateScope, filters: HistoricalCatalogueFilters): Record<string, BankRateSnapshot> | null {
  const cached = states.get(preparation)?.scopes.get(core)?.get(currentScope)?.get(normalizedFilters(filters).key);
  return cached?.revision === gateRevision() ? cached.snapshots : null;
}

/** Cooperative all-bank preparation. Equivalent historical requests share work;
 * current observations are gated again after the last asynchronous boundary. */
export async function historicalBankRateSnapshotsAsync(preparation: PreparedHistoricalBankRateCatalogue, core: CorePayload,
  currentScope: BankRateScope, filters: HistoricalCatalogueFilters,
  yieldWork: () => Promise<void> = async () => (await import('../lib/yieldToUi')).yieldToUi(0)): Promise<Record<string, BankRateSnapshot>> {
  const cached = cachedHistoricalBankRateSnapshots(preparation, core, currentScope, filters);
  if (cached) return cached;
  const state = states.get(preparation);
  if (!state) throw new Error('Historical catalogue was not prepared');
  const normalized = normalizedFilters(filters);
  let task = state.pendingSnapshots.get(normalized.key);
  if (!task) {
    task = (async () => {
      await yieldWork();
      const generator = historicalSnapshots(preparation, state, filters, normalized);
      let count = 0, started = Date.now(), next = generator.next();
      while (!next.done) {
        if (++count % 32 === 0 && Date.now() - started >= 8) { await yieldWork(); started = Date.now(); }
        next = generator.next();
      }
      return next.value;
    })();
    state.pendingSnapshots.set(normalized.key, task);
  }
  let history: Record<string, BankRateSnapshot>;
  try { history = await task; }
  finally { if (state.pendingSnapshots.get(normalized.key) === task) state.pendingSnapshots.delete(normalized.key); }
  return currentSnapshots(preparation, state, core, currentScope, normalized, history);
}

/** All banks are calculated together; provider selection never enters this key.
 * Historical predicates never borrow the installed current-core eligibility or details.
 * Current observations still require original core references and the live mandatory gate. */
export function historicalBankRateSnapshots(preparation: PreparedHistoricalBankRateCatalogue, core: CorePayload,
  currentScope: BankRateScope, filters: HistoricalCatalogueFilters): Record<string, BankRateSnapshot> {
  const state = states.get(preparation);
  if (!state) throw new Error('Historical catalogue was not prepared');
  const normalized = normalizedFilters(filters);
  return currentSnapshots(preparation, state, core, currentScope, normalized, runSnapshots(historicalSnapshots(preparation, state, filters, normalized)));
}

function currentSnapshots(preparation: PreparedHistoricalBankRateCatalogue, state: PreparedState, core: CorePayload,
  currentScope: BankRateScope, normalized: ReturnType<typeof normalizedFilters>, history: Record<string, BankRateSnapshot>): Record<string, BankRateSnapshot> {
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
  if (cache.has(key)) return rememberScope(state, core, currentScope, normalized.key, cache.get(key)!);
  const snapshots = Object.fromEntries(Object.entries(history).filter(([day]) => day < core.run_date));
  // A legacy current core can be newer than the last packed day. Retain real calendar gaps.
  const last = preparation.catalogue.run_dates.at(-1)!;
  let days = Object.keys(snapshots).length;
  for (let day = Date.parse(last) + 86_400_000; day < Date.parse(core.run_date); day += 86_400_000) {
    if (++days >= 5000) break;
    const date = new Date(day).toISOString().slice(0, 10);
    if (!Object.hasOwn(snapshots, date)) snapshots[date] = {};
  }
  snapshots[core.run_date] = snapshotBankRates(bankRateScope(currentRows));
  if (cache.size >= 8) cache.delete(cache.keys().next().value!);
  cache.set(key, snapshots); state.current.set(core, cache);
  return rememberScope(state, core, currentScope, normalized.key, snapshots);
}
