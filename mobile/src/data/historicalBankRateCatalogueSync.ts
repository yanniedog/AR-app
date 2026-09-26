import { SECTION_KEYS, type CorePayload, type DetailsPayload, type Manifest } from '../types';
import { PAYLOAD_REPO } from '../config';
import { debugLog } from '../lib/debugLog';
import { yieldToUi } from '../lib/yieldToUi';
import { cache } from './cache';
import { parseDatesIndex, type DatesIndex } from './datesIndex';
import { verifiedDetailsSha } from './detailsIdentity';
import { assertHistoricalIdentitiesAdvance, historicalSourceIdentity } from './historyIdentity';
import { assertRevisionManifest } from './payloadRevision';
import { prepareHistoricalBankRateCatalogue } from './historicalBankRateCatalogue';
import { upsertHistoricalCatalogueDay } from './historicalBankRateCatalogueMerge';
import { clearHistoricalBankRateCatalogue, installHistoricalBankRateCatalogue } from './historicalBankRateCatalogueStore';
import { compressCatalogue, decompressCatalogue } from './historicalBankRateCatalogueCompression';
import { bundledHistoricalCatalogueBinding, getBundledHistoricalBankRateCatalogue } from './bundledHistoricalBankRateCatalogue';
import { HISTORICAL_CATALOGUE_LIMITS,
  type HistoricalBankRateCatalogue, type HistoricalCatalogueSpan } from './historicalBankRateCatalogueWire';

interface SavedCatalogue {
  schema_version: 2;
  core_bindings: Record<string, { core_sha256: string; manifest_sha256: string }>;
  index: DatesIndex;
  catalogue: HistoricalBankRateCatalogue;
}
const MAX_CACHE_CHARS = 24 * 1024 * 1024;
const SHA = /^[a-f0-9]{64}$/;
let preparation = Promise.resolve(false);
let decodedCheckpoint: { text: string; value: SavedCatalogue } | null = null;

export function decodeSavedHistoricalCatalogue(text: string | null): SavedCatalogue | null {
  try {
    if (!text || text.length > MAX_CACHE_CHARS) return null;
    if (text === decodedCheckpoint?.text) return decodedCheckpoint.value;
    const value = decompressCatalogue(JSON.parse(text)) as SavedCatalogue | null;
    if (!value || value.schema_version !== 2 || !prepareHistoricalBankRateCatalogue(value.catalogue)) return null;
    const index = parseDatesIndex(value.index);
    if (!index?.revision_heads || index.dates.length > HISTORICAL_CATALOGUE_LIMITS.days ||
        !value.core_bindings || typeof value.core_bindings !== 'object' || Array.isArray(value.core_bindings)) return null;
    const bindings = Object.entries(value.core_bindings);
    if (!bindings.length || bindings.length > HISTORICAL_CATALOGUE_LIMITS.days || bindings.some(([day, binding]) =>
      !binding || typeof binding.core_sha256 !== 'string' || !SHA.test(binding.core_sha256) ||
      typeof binding.manifest_sha256 !== 'string' || !SHA.test(binding.manifest_sha256) ||
      index.revision_heads![day]?.manifest_sha256 !== binding.manifest_sha256)) return null;
    if (Object.entries(value.catalogue.sources).some(([day, source]) => source.kind === 'published_core' &&
      index.revision_heads![day]?.manifest_sha256 !== source.manifest_sha256)) return null;
    const result = { ...value, index };
    decodedCheckpoint = { text, value: result };
    return result;
  } catch { return null; }
}

function currentMatches(core: CorePayload, manifest: Manifest, index: DatesIndex): boolean {
  try {
    const head = index.revision_heads?.[core.run_date];
    if (!head || core.run_date !== manifest.run_date) return false;
    assertRevisionManifest(manifest, head, core.run_date, PAYLOAD_REPO);
    return true;
  } catch { return false; }
}

function assertIndexAdvances(index: DatesIndex, previous: DatesIndex): void {
  const dates = Object.keys(previous.revision_heads ?? {}).filter(day => day <= index.latest_date);
  assertHistoricalIdentitiesAdvance(index, dates, Object.fromEntries(
    dates.map(day => [day, historicalSourceIdentity(previous, day)]),
  ));
}

function sameHeads(left: DatesIndex, right: DatesIndex): boolean {
  return left.dates.length === right.dates.length && left.dates.every(day =>
    right.dates.includes(day) && historicalSourceIdentity(left, day) === historicalSourceIdentity(right, day));
}

/** Public-core observations use app publication revisions. Producer contracts
 * and retained exports have independent provenance and never borrow those heads. */
function discardSupersededPublicDates(catalogue: HistoricalBankRateCatalogue, index: DatesIndex): HistoricalBankRateCatalogue {
  const invalid = new Set(Object.entries(catalogue.sources).flatMap(([day, source]) =>
    source.kind === 'published_core' && index.revision_heads?.[day]?.manifest_sha256 !== source.manifest_sha256 ? [day] : []));
  if (!invalid.size) return catalogue;
  const sources = Object.fromEntries(Object.entries(catalogue.sources).filter(([day]) => !invalid.has(day)));
  const unavailable_dates = { ...catalogue.unavailable_dates,
    ...Object.fromEntries([...invalid].map(day => [day, 'Selected publication changed; replacement history is not available.'])) };
  const sections = Object.fromEntries(SECTION_KEYS.map(section => [section, catalogue.sections[section].map(tier => ({
    ...tier,
    spans: tier.spans.flatMap(([start, count, rates, evidenceId]) => {
      const spans: HistoricalCatalogueSpan[] = [];
      let segment = start;
      for (let day = start; day <= start + count; day++) {
        if (day < start + count && !invalid.has(catalogue.run_dates[day])) continue;
        if (day > segment) spans.push([segment, day - segment, rates, evidenceId]);
        segment = day + 1;
      }
      return spans;
    }),
  }))])) as HistoricalBankRateCatalogue['sections'];
  return { ...catalogue, sources, unavailable_dates, sections };
}

/** One rich cache prepares every bank and filter. It never fetches dated cores. */
export function prepareHistoricalBankRateHistory(core: CorePayload, manifest: Manifest,
  index: DatesIndex | null = null, details: DetailsPayload | null = null): Promise<boolean> {
  if (prepareHistoricalBankRateCatalogue(core.bank_rate_history_catalogue)) return Promise.resolve(true);
  if (!manifest.payload_revision) { clearHistoricalBankRateCatalogue(core); return Promise.resolve(false); }
  const work = preparation.then(() => prepare(core, manifest, index, details));
  preparation = work.catch(() => false);
  return preparation;
}

async function prepare(core: CorePayload, manifest: Manifest, freshIndex: DatesIndex | null, details: DetailsPayload | null): Promise<boolean> {
  clearHistoricalBankRateCatalogue(core);
  try {
    const saved = await cache.readBankRateHistory?.(decodeSavedHistoricalCatalogue).catch(() => null) ?? null;
    const baselineIndex = bundledHistoricalCatalogueBinding.index;
    const binding = saved?.core_bindings[core.run_date];
    const cachedMatches = binding?.core_sha256 === manifest.files.core.sha256 &&
      binding.manifest_sha256 === saved?.index.revision_heads?.[core.run_date]?.manifest_sha256 &&
      currentMatches(core, manifest, saved!.index);
    const bundledMatches = !!baselineIndex && bundledHistoricalCatalogueBinding.core_sha256 === manifest.files.core.sha256 &&
      currentMatches(core, manifest, baselineIndex);
    const index = freshIndex ?? (cachedMatches ? saved!.index : bundledMatches ? baselineIndex : null);
    if (!index?.revision_heads || index.dates.length > HISTORICAL_CATALOGUE_LIMITS.days || !currentMatches(core, manifest, index)) return false;
    if (baselineIndex) assertIndexAdvances(index, baselineIndex);
    if (saved) assertIndexAdvances(index, saved.index);
    const baseline = getBundledHistoricalBankRateCatalogue();
    const usableDates = (catalogue: HistoricalBankRateCatalogue) => Object.entries(catalogue.sources).filter(([day, source]) =>
      day <= core.run_date && !catalogue.unavailable_dates[day] &&
      (source.kind !== 'published_core' || source.manifest_sha256 === index.revision_heads![day]?.manifest_sha256)).length;
    let catalogue = saved && (!baseline || usableDates(saved.catalogue) >= usableDates(baseline)) ? saved.catalogue : baseline;
    if (!catalogue) return false;
    catalogue = discardSupersededPublicDates(catalogue, index);
    if ((!catalogue.sources[core.run_date] || catalogue.unavailable_dates[core.run_date]) && details?.run_date === core.run_date &&
        verifiedDetailsSha(details) === manifest.files.details.sha256) {
      catalogue = upsertHistoricalCatalogueDay(catalogue, core, details, {
        kind: 'published_core', core_sha256: manifest.files.core.sha256,
        details_sha256: manifest.files.details.sha256, manifest_sha256: index.revision_heads[core.run_date].manifest_sha256,
      });
    }
    const missing = [...new Set([...catalogue.run_dates, ...index.dates].filter(day => day < core.run_date &&
      (!catalogue.sources[day] || catalogue.unavailable_dates[day])))].sort();
    await yieldToUi();
    if (!installHistoricalBankRateCatalogue(core, catalogue, missing)) return false;
    const bundledReusable = catalogue === baseline && bundledMatches && baselineIndex && sameHeads(index, baselineIndex);
    const savedReusable = saved && catalogue === saved.catalogue && cachedMatches && sameHeads(index, saved.index);
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
        const value: SavedCatalogue = { schema_version: 2, core_bindings, index, catalogue };
        const text = JSON.stringify(compressCatalogue(value));
        await cache.writeBankRateHistory(text);
        decodedCheckpoint = { text, value };
      } catch { debugLog.warn('bank-history-catalogue', 'History is ready; its offline cache could not be saved.'); }
    }
    return true;
  } catch (error) {
    clearHistoricalBankRateCatalogue(core);
    debugLog.warn('bank-history-catalogue', `Historical catalogue unavailable: ${String((error as Error)?.message ?? error)}`);
    return false;
  }
}
