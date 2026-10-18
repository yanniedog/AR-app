import type { CorePayload, Manifest } from '../types';
import type { DatesIndex } from './datesIndex';
import type { HistoricalBankRateCatalogue } from './historicalBankRateCatalogueWire';
import { prepareHistoricalBankRateCatalogueAsync, selectHistoricalCatalogueDates } from './historicalBankRateCatalogue';
import { prepareReadyBankRateHistory, selectedPreparedHistoryHeads } from './historicalBankRateReadySync';
import { installPreparedHistoricalBankRateCatalogue } from './historicalBankRateCatalogueStore';
import { yieldToUi } from '../lib/yieldToUi';

/** Use only a transport-verified archive. Reuse the ready path's revision
 * high-water selection, public fallback and durable receipts; never load the
 * old raw APK snapshot or download dated cores. */
export async function prepareLegacyBankRateHistory(core: CorePayload, manifest: Manifest, index: DatesIndex | null,
  archive: HistoricalBankRateCatalogue, isCurrent: () => boolean): Promise<boolean> {
  let fallbackReady = false;
  try { fallbackReady = await prepareReadyBankRateHistory(core, manifest, index, null, isCurrent); }
  catch { /* Independent verified observations do not require the signed fallback. */ }
  if (!isCurrent()) return false;
  const selected = fallbackReady ? selectedPreparedHistoryHeads(core) : null;
  // Without selected heads only independent producer observations are usable.
  const dates = new Set(archive.run_dates.filter(day => {
    const source = archive.sources[day];
    return day <= core.run_date && source && !archive.unavailable_dates[day] &&
      (source.kind !== 'published_core' || (selected && !selected.conflicts.has(day) &&
        source.manifest_sha256 === selected.heads.get(day)?.manifest_sha256));
  }));
  // Validation is shared by archive identity. One retired consumer must not
  // cancel a live successor joining the same immutable archive.
  const primary = await prepareHistoricalBankRateCatalogueAsync(archive, () => yieldToUi(0));
  if (!primary || !isCurrent()) return false;
  const fallback = selected?.prepared ?? null;
  const knownDates = [...(selected?.dates ?? selected?.heads.keys() ?? [])].sort();
  const selectedIndex: DatesIndex | undefined = knownDates.length ? {
    schema_version: 1, revision_protocol: 1, dates: knownDates, count: knownDates.length,
    min_date: knownDates[0], latest_date: knownDates.at(-1)!, revision_heads: Object.fromEntries(selected!.heads),
  } : undefined;
  const combined = selectHistoricalCatalogueDates(primary, dates, fallback, selectedIndex, selected?.conflicts);
  const covered = new Set([...dates, ...Object.keys(fallback?.catalogue.sources ?? {})]);
  const calendar = new Set([...archive.run_dates, ...(fallback?.catalogue.run_dates ?? []), ...(selectedIndex?.dates ?? []), ...(index?.dates ?? [])]);
  for (let time = Date.parse(archive.run_dates.at(-1)!) + 86_400_000; time < Date.parse(core.run_date) && calendar.size < 5000; time += 86_400_000) {
    calendar.add(new Date(time).toISOString().slice(0, 10));
  }
  const missing = [...calendar].filter(day => day < core.run_date && !covered.has(day)).sort();
  if (!isCurrent()) return false;
  installPreparedHistoricalBankRateCatalogue(core, combined, missing);
  return true;
}
