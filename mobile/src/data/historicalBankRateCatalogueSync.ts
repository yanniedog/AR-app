import { SECTION_KEYS, type CorePayload, type DetailsPayload, type Manifest } from '../types';
import { PAYLOAD_REPO } from '../config';
import { debugLog } from '../lib/debugLog';
import { yieldToUi } from '../lib/yieldToUi';
import { cache } from './cache';
import { parseDatesIndex, type DatesIndex } from './datesIndex';
import { verifiedDetailsSha } from './detailsIdentity';
import { historicalSourceIdentity } from './historyIdentity';
import { assertHistoryDatesIndexAdvances } from './historyDatesIndex';
import { assertRevisionManifest } from './payloadRevision';
import { prepareHistoricalBankRateCatalogue, prepareHistoricalBankRateCatalogueAsync } from './historicalBankRateCatalogue';
import { overlayHistoricalCatalogueDaysAsync, upsertHistoricalCatalogueDayAsync } from './historicalBankRateCatalogueMerge';
import { cachedHistoricalBankRateCatalogue, clearHistoricalBankRateCatalogue, historicalCatalogueOwner, installHistoricalBankRateCatalogue } from './historicalBankRateCatalogueStore';
import { compressCatalogueAsync, decompressCatalogue, decompressCatalogueAsync } from './historicalBankRateCatalogueCompression';
import { HISTORICAL_CATALOGUE_LIMITS,
  type HistoricalBankRateCatalogue, type HistoricalCatalogueSpan } from './historicalBankRateCatalogueWire';

interface SavedCatalogue {
  schema_version: 2 | 3;
  core_bindings: Record<string, { core_sha256: string; manifest_sha256: string }>;
  index: DatesIndex;
  /** Schema 2 migration only. Schema 3 restores this from the APK/current core. */
  catalogue?: HistoricalBankRateCatalogue;
  /** Public observations that cannot be restored from the bundled edition.
   * Keep these independently when a staged producer replaces the main catalogue. */
  public_fallback?: HistoricalBankRateCatalogue;
  /** Only this exact producer core may reuse the merged catalogue wholesale. */
  producer_core_sha256?: string;
}
const MAX_CACHE_CHARS = 24 * 1024 * 1024;
const SHA = /^[a-f0-9]{64}$/;
let preparation = Promise.resolve(false);
type DecodedCheckpoint = { text: string; value: SavedCatalogue };
let decodedCheckpoint: DecodedCheckpoint | null = null;
let lastPrepared: {
  core: CorePayload;
  embedded: unknown;
  receipt: string;
  catalogue: NonNullable<ReturnType<typeof cachedHistoricalBankRateCatalogue>>;
  checkpoint: DecodedCheckpoint | null;
} | null = null;
const yieldHistoryWork = () => yieldToUi(0);

function bundledHistory(): typeof import('./bundledHistoricalBankRateCatalogue') {
  // Metro keeps this module lazy: importing sync must not initialize the large
  // bundled JSON before the caller has scheduled history work after first paint.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./bundledHistoricalBankRateCatalogue');
}

export function decodeSavedHistoricalCatalogue(text: string | null): SavedCatalogue | null {
  try {
    if (!text || text.length > MAX_CACHE_CHARS) return null;
    if (text === decodedCheckpoint?.text) return decodedCheckpoint.value;
    const value = decompressCatalogue(JSON.parse(text)) as SavedCatalogue | null;
    return validateSavedCatalogue(value, text);
  } catch { return null; }
}

export async function decodeSavedHistoricalCatalogueAsync(text: string | null): Promise<SavedCatalogue | null> {
  try {
    if (!text || text.length > MAX_CACHE_CHARS) return null;
    if (text === decodedCheckpoint?.text) return decodedCheckpoint.value;
    const started = Date.now();
    const value = await decompressCatalogueAsync(JSON.parse(text), { yieldControl: yieldHistoryWork }) as SavedCatalogue | null;
    if (!value || (value.schema_version === 2 && !await prepareHistoricalBankRateCatalogueAsync(value.catalogue, yieldHistoryWork)) ||
      (value.public_fallback !== undefined && !await prepareHistoricalBankRateCatalogueAsync(value.public_fallback, yieldHistoryWork))) return null;
    const result = validateSavedCatalogue(value, text);
    debugLog.debug('bank-history-catalogue', `checkpoint decoded schema=${result?.schema_version ?? 'invalid'} elapsed_ms=${Date.now() - started}`);
    return result;
  } catch { return null; }
}

function validateSavedCatalogue(value: SavedCatalogue | null, text: string): SavedCatalogue | null {
  if (!value || (value.schema_version !== 2 && value.schema_version !== 3)) return null;
  if (value.schema_version === 2 ? !prepareHistoricalBankRateCatalogue(value.catalogue) :
    value.catalogue !== undefined || value.producer_core_sha256 !== undefined) return null;
  if (value.producer_core_sha256 !== undefined && !SHA.test(value.producer_core_sha256)) return null;
  const index = parseDatesIndex(value.index);
  if (!index?.revision_heads || index.dates.length > HISTORICAL_CATALOGUE_LIMITS.days ||
      !value.core_bindings || typeof value.core_bindings !== 'object' || Array.isArray(value.core_bindings)) return null;
  const bindings = Object.entries(value.core_bindings);
  if (!bindings.length || bindings.length > HISTORICAL_CATALOGUE_LIMITS.days || bindings.some(([day, binding]) =>
    !binding || typeof binding.core_sha256 !== 'string' || !SHA.test(binding.core_sha256) ||
    typeof binding.manifest_sha256 !== 'string' || !SHA.test(binding.manifest_sha256) ||
    index.revision_heads![day]?.manifest_sha256 !== binding.manifest_sha256)) return null;
  if (value.catalogue && Object.entries(value.catalogue.sources).some(([day, source]) => source.kind === 'published_core' &&
    index.revision_heads![day]?.manifest_sha256 !== source.manifest_sha256)) return null;
  if (value.public_fallback !== undefined && (!prepareHistoricalBankRateCatalogue(value.public_fallback) ||
    !Object.keys(value.public_fallback.sources).length || Object.keys(value.public_fallback.unavailable_dates).length ||
    Object.entries(value.public_fallback.sources).some(([day, source]) => source.kind !== 'published_core' ||
      index.revision_heads![day]?.manifest_sha256 !== source.manifest_sha256))) return null;
  const result = { ...value, index };
  decodedCheckpoint = { text, value: result };
  return result;
}

function currentMatches(core: CorePayload, manifest: Manifest, index: DatesIndex): boolean {
  try {
    const head = index.revision_heads?.[core.run_date];
    if (!head || core.run_date !== manifest.run_date) return false;
    assertRevisionManifest(manifest, head, core.run_date, PAYLOAD_REPO);
    return true;
  } catch { return false; }
}

function sameHeads(left: DatesIndex, right: DatesIndex): boolean {
  return left.dates.length === right.dates.length && left.dates.every(day =>
    right.dates.includes(day) && historicalSourceIdentity(left, day) === historicalSourceIdentity(right, day));
}

/** Clip the archive to independently selected public editions, excluding dates
 * the bundle can restore. Overlaying into an empty catalogue copies only the
 * requested tiers, spans and evidence, not another complete baseline. */
async function retainPublicFallback(previous: HistoricalBankRateCatalogue | undefined, index: DatesIndex,
  bundledIndex: DatesIndex | null, ...candidates: (HistoricalBankRateCatalogue | undefined)[]): Promise<HistoricalBankRateCatalogue | undefined> {
  const needed = (candidate: HistoricalBankRateCatalogue, day: string) => {
    const source = candidate.sources[day];
    return source.kind === 'published_core' && !candidate.unavailable_dates[day] &&
      source.manifest_sha256 === index.revision_heads?.[day]?.manifest_sha256 &&
      bundledIndex?.revision_heads?.[day]?.manifest_sha256 !== source.manifest_sha256;
  };
  const empty = (day: string): HistoricalBankRateCatalogue => ({ schema_version: 2, run_dates: [day],
    sources: {}, unavailable_dates: {}, evidence: [{ status: 'unknown' }], sections: { Mortgage: [], Savings: [], TD: [] } });
  let result = previous;
  if (previous) {
    const dates = Object.keys(previous.sources).filter(day => needed(previous, day));
    if (dates.length !== Object.keys(previous.sources).length) {
      result = dates.length ? await overlayHistoricalCatalogueDaysAsync(empty(dates[0]), previous, dates, yieldHistoryWork) : undefined;
    }
  }
  for (const candidate of candidates) if (candidate) {
    const dates = Object.keys(candidate.sources).filter(day => !result?.sources[day] && needed(candidate, day));
    if (dates.length) result = await overlayHistoricalCatalogueDaysAsync(result ?? empty(dates[0]), candidate, dates, yieldHistoryWork);
  }
  return result;
}

/** Public-core observations use app publication revisions. Producer contracts
 * and retained exports have independent provenance and never borrow those heads. */
async function discardSupersededPublicDates(catalogue: HistoricalBankRateCatalogue, index: DatesIndex,
  knownDatesOnly = false): Promise<HistoricalBankRateCatalogue> {
  const invalid = new Set(Object.entries(catalogue.sources).flatMap(([day, source]) =>
    source.kind === 'published_core' && (!knownDatesOnly || day <= index.latest_date) &&
      index.revision_heads?.[day]?.manifest_sha256 !== source.manifest_sha256 ? [day] : []));
  if (!invalid.size) return catalogue;
  const sources = Object.fromEntries(Object.entries(catalogue.sources).filter(([day]) => !invalid.has(day)));
  const unavailable_dates = { ...catalogue.unavailable_dates,
    ...Object.fromEntries([...invalid].map(day => [day, 'Selected publication changed; replacement history is not available.'])) };
  const sections: HistoricalBankRateCatalogue['sections'] = { Mortgage: [], Savings: [], TD: [] };
  let count = 0, started = Date.now();
  for (const section of SECTION_KEYS) for (const tier of catalogue.sections[section]) {
    sections[section].push({ ...tier, spans: tier.spans.flatMap(([start, count, rates, evidenceId]) => {
      const spans: HistoricalCatalogueSpan[] = [];
      let segment = start;
      for (let day = start; day <= start + count; day++) {
        if (day < start + count && !invalid.has(catalogue.run_dates[day])) continue;
        if (day > segment) spans.push([segment, day - segment, rates, evidenceId]);
        segment = day + 1;
      }
      return spans;
    }) });
    if (++count % 8 === 0 && Date.now() - started >= 8) { await yieldHistoryWork(); started = Date.now(); }
  }
  return { ...catalogue, sources, unavailable_dates, sections };
}

/** One rich cache prepares every bank and filter. It never fetches dated cores. */
export function prepareHistoricalBankRateHistory(core: CorePayload, manifest: Manifest,
  index: DatesIndex | null = null, details: DetailsPayload | null = null): Promise<boolean> {
  const work = preparation.then(async () => {
    // Only the last serialized successful preparation can be reused. An
    // intervening core/index may advance the revision high-water mark, even if
    // its adoption fails, so never retain a per-core collection of shortcuts.
    const receipt = JSON.stringify([manifest, index, details ? [details.run_date, verifiedDetailsSha(details)] : null]);
    if (lastPrepared && historicalCatalogueOwner(lastPrepared.core) === historicalCatalogueOwner(core) &&
        lastPrepared.embedded === core.bank_rate_history_catalogue &&
        lastPrepared.receipt === receipt && lastPrepared.checkpoint === decodedCheckpoint &&
        lastPrepared.catalogue === cachedHistoricalBankRateCatalogue(core)) return true;
    lastPrepared = null;
    const completion = { reusable: false };
    const ready = await prepare(core, manifest, index, details, completion);
    const catalogue = ready ? cachedHistoricalBankRateCatalogue(core) : null;
    if (catalogue && completion.reusable) lastPrepared = { core, embedded: core.bank_rate_history_catalogue, receipt, catalogue, checkpoint: decodedCheckpoint };
    return ready;
  });
  preparation = work.catch(() => false);
  return preparation;
}

async function prepare(core: CorePayload, manifest: Manifest, freshIndex: DatesIndex | null, details: DetailsPayload | null,
  completion: { reusable: boolean }): Promise<boolean> {
  const started = Date.now();
  let stageStarted = started;
  const stage = (name: string) => {
    const now = Date.now();
    debugLog.debug('bank-history-catalogue', `${name} run_date=${core.run_date} stage_ms=${now - stageStarted} elapsed_ms=${now - started}`);
    stageStarted = now;
  };
  stage('prepare start');
  clearHistoricalBankRateCatalogue(core);
  const embedded = (await prepareHistoricalBankRateCatalogueAsync(core.bank_rate_history_catalogue, yieldHistoryWork))?.catalogue;
  const { bundledHistoricalCatalogueBinding, getBundledHistoricalBankRateCatalogueAsync } = bundledHistory();
  const selected = freshIndex ?? bundledHistoricalCatalogueBinding.index;
  if (embedded && !Object.values(embedded.sources).some(source => source.kind === 'published_core') &&
      !embedded.run_dates.some(day => day < core.run_date && (!embedded.sources[day] || embedded.unavailable_dates[day])) &&
      !selected?.dates.some(day => day < core.run_date && !embedded.sources[day])) {
    completion.reusable = true; stage('embedded ready'); return true;
  }
  if (!manifest.payload_revision) return !!embedded;
  let knownIndex = bundledHistoricalCatalogueBinding.index;
  const fallback = async () => {
    if (!embedded) return false;
    let catalogue = embedded;
    // A rejected refresh cannot resurrect public observations already known to
    // be superseded. Raw producer provenance remains independent of app heads.
    for (const index of [knownIndex, freshIndex]) if (index) catalogue = await discardSupersededPublicDates(catalogue, index, true);
    if (!await prepareHistoricalBankRateCatalogueAsync(catalogue, yieldHistoryWork)) return false;
    if (catalogue !== embedded) installHistoricalBankRateCatalogue(core, catalogue, catalogue.run_dates.filter(day =>
      day < core.run_date && (!catalogue.sources[day] || catalogue.unavailable_dates[day])));
    return true;
  };
  try {
    const saved = await cache.readBankRateHistory?.(decodeSavedHistoricalCatalogueAsync).catch(() => null) ?? null;
    stage('checkpoint read');
    knownIndex = saved?.index ?? knownIndex;
    const baselineIndex = bundledHistoricalCatalogueBinding.index;
    const binding = saved?.core_bindings[core.run_date];
    const cachedMatches = binding?.core_sha256 === manifest.files.core.sha256 &&
      binding.manifest_sha256 === saved?.index.revision_heads?.[core.run_date]?.manifest_sha256 &&
      currentMatches(core, manifest, saved!.index);
    const bundledMatches = !!baselineIndex && bundledHistoricalCatalogueBinding.core_sha256 === manifest.files.core.sha256 &&
      currentMatches(core, manifest, baselineIndex);
    const index = freshIndex ?? (cachedMatches ? saved!.index : bundledMatches ? baselineIndex : null);
    if (!index?.revision_heads || index.dates.length > HISTORICAL_CATALOGUE_LIMITS.days || !currentMatches(core, manifest, index)) return fallback();
    if (baselineIndex) assertHistoryDatesIndexAdvances(index, baselineIndex);
    if (saved) assertHistoryDatesIndexAdvances(index, saved.index);
    const savedCatalogue = saved?.catalogue;
    const savedCompatible = savedCatalogue && (!saved?.producer_core_sha256 || saved.producer_core_sha256 === manifest.files.core.sha256);
    // A fully covered compatible checkpoint already contains every baseline
    // observation that this selected index could restore. Its receipts suffice;
    // avoid inflating and retaining another complete catalogue on each restart.
    const savedCoversBaseline = saved && savedCatalogue && cachedMatches && baselineIndex &&
      (embedded ? saved.producer_core_sha256 === manifest.files.core.sha256 : savedCompatible) &&
      baselineIndex.dates.every(day => day > core.run_date ||
        baselineIndex.revision_heads?.[day]?.manifest_sha256 !== index.revision_heads![day]?.manifest_sha256 ||
        (savedCatalogue.sources[day] && !savedCatalogue.unavailable_dates[day] &&
          (savedCatalogue.sources[day].kind !== 'published_core' ||
            savedCatalogue.sources[day].manifest_sha256 === index.revision_heads![day]?.manifest_sha256)));
    stage('baseline begin');
    const baseline = savedCoversBaseline ? null : await getBundledHistoricalBankRateCatalogueAsync({ yieldControl: yieldHistoryWork });
    stage('baseline ready; merge begin');
    const restorableIndex = baseline || savedCoversBaseline ? baselineIndex : null;
    let public_fallback = await retainPublicFallback(saved?.public_fallback, index, restorableIndex, savedCatalogue);
    const usableDates = (catalogue: HistoricalBankRateCatalogue) => Object.entries(catalogue.sources).filter(([day, source]) =>
      day <= core.run_date && !catalogue.unavailable_dates[day] &&
      (source.kind !== 'published_core' || source.manifest_sha256 === index.revision_heads![day]?.manifest_sha256)).length;
    let catalogue = embedded
      ? savedCatalogue && saved?.producer_core_sha256 === manifest.files.core.sha256 && cachedMatches ? savedCatalogue : embedded
      : savedCatalogue && savedCompatible && (!baseline || usableDates(savedCatalogue) >= usableDates(baseline)) ? savedCatalogue : baseline;
    if (!catalogue) return false;
    catalogue = await discardSupersededPublicDates(catalogue, index);
    if (!await prepareHistoricalBankRateCatalogueAsync(catalogue, yieldHistoryWork)) return false;
    // Fill blanks only from independently verified public observations. This
    // also restores legacy cores without adopting a different producer's data.
    for (const fallback of [public_fallback, savedCatalogue, baseline]) if (fallback) {
      const dates = index.dates.filter(day => (embedded ? day < core.run_date : day <= core.run_date) && !catalogue!.sources[day] &&
        fallback.sources[day]?.kind === 'published_core' && !fallback.unavailable_dates[day] &&
        fallback.sources[day].manifest_sha256 === index.revision_heads![day]?.manifest_sha256);
      catalogue = await overlayHistoricalCatalogueDaysAsync(catalogue, fallback, dates, yieldHistoryWork);
    }
    if (!embedded && (!catalogue.sources[core.run_date] || catalogue.unavailable_dates[core.run_date]) && details?.run_date === core.run_date &&
        verifiedDetailsSha(details) === manifest.files.details.sha256) {
      catalogue = await upsertHistoricalCatalogueDayAsync(catalogue, core, details, {
        kind: 'published_core', core_sha256: manifest.files.core.sha256,
        details_sha256: manifest.files.details.sha256, manifest_sha256: index.revision_heads[core.run_date].manifest_sha256,
      }, yieldHistoryWork);
    }
    public_fallback = await retainPublicFallback(public_fallback, index, restorableIndex, catalogue);
    const missing = [...new Set([...catalogue.run_dates, ...index.dates].filter(day => day < core.run_date &&
      (!catalogue.sources[day] || catalogue.unavailable_dates[day])))].sort();
    await yieldToUi();
    if (!installHistoricalBankRateCatalogue(core, catalogue, missing)) return false;
    stage('merge installed');
    completion.reusable = true;
    const bundledReusable = catalogue === baseline && bundledMatches && baselineIndex && sameHeads(index, baselineIndex) &&
      !public_fallback && !saved?.public_fallback;
    const savedReusable = saved?.schema_version === 3 && cachedMatches && sameHeads(index, saved.index) &&
      public_fallback === saved.public_fallback;
    if (freshIndex && !bundledReusable && !savedReusable) {
      try {
        const core_bindings: SavedCatalogue['core_bindings'] = Object.fromEntries(Object.entries({
          ...(baselineIndex?.revision_heads ? {
            [baselineIndex.latest_date]: { core_sha256: bundledHistoricalCatalogueBinding.core_sha256,
              manifest_sha256: baselineIndex.revision_heads[baselineIndex.latest_date].manifest_sha256 },
          } : {}),
          ...saved?.core_bindings,
        }).filter(([day, entry]) => index.revision_heads![day]?.manifest_sha256 === entry.manifest_sha256));
        core_bindings[core.run_date] = { core_sha256: manifest.files.core.sha256,
          manifest_sha256: index.revision_heads[core.run_date].manifest_sha256 };
        if (Object.keys(core_bindings).length > HISTORICAL_CATALOGUE_LIMITS.days) throw new Error('History binding budget exceeded');
        // The APK baseline and embedded producer archive are already durable.
        // Re-encoding their ~43 MB on Hermes delayed usable history by minutes.
        // Retain only independently verified observations those sources cannot restore.
        const value: SavedCatalogue = { schema_version: 3, core_bindings, index,
          ...(public_fallback ? { public_fallback } : {}),
        };
        stage(`persist begin archive_dates=${Object.keys(public_fallback?.sources ?? {}).length}`);
        const text = JSON.stringify(await compressCatalogueAsync(value, { yieldControl: yieldHistoryWork }));
        stage(`persist encoded characters=${text.length}`);
        await cache.writeBankRateHistory(text);
        decodedCheckpoint = { text, value };
        stage('persist saved');
      } catch {
        completion.reusable = false;
        debugLog.warn('bank-history-catalogue', 'History is ready; its offline cache could not be saved.');
      }
    }
    return true;
  } catch (error) {
    clearHistoricalBankRateCatalogue(core);
    debugLog.warn('bank-history-catalogue', `Historical catalogue unavailable: ${String((error as Error)?.message ?? error)}`);
    return fallback();
  }
}
