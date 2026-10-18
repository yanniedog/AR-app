import type { CorePayload, Manifest } from '../types';
import type { DatesIndex } from './datesIndex';
import type { HistoricalBankRateReady } from './historicalBankRateReadyWire';
import type { ReadyHistorySource } from './historicalBankRateReady';
import { prepareHistoricalBankRateReadySources, type PreparedHistoricalBankRateCatalogue } from './historicalBankRateCatalogue';
import { clearHistoricalBankRateCatalogue, historicalCatalogueOwner, installPreparedHistoricalBankRateCatalogue, markPreparedHistoricalBankRateHistory } from './historicalBankRateCatalogueStore';
import { cache } from './cache';
import { parseHistoryDatesIndex } from './historyDatesIndex';
import type { PayloadRevisionHead } from './payloadRevision';
import { backgroundPayloadWork } from '../lib/backgroundPayloadWork';
import { yieldToUi } from '../lib/yieldToUi';
import { compactPublicReadyHistory, decodeRetainedReadyHistory, encodeRetainedReadyHistory, needsRetainedReadyMigration, type RetainedReadyHistory } from './historicalBankRateReadyRetention';
import { debugLog } from '../lib/debugLog';

const installed = new WeakMap<CorePayload, { sources: HistoricalBankRateReady[]; receipt: string; prepared: PreparedHistoricalBankRateCatalogue;
  heads: ReadonlyMap<string, PayloadRevisionHead>; dates: ReadonlySet<string>; conflicts: ReadonlySet<string> }>();
export const selectedPreparedHistoryHeads = (core: CorePayload) => installed.get(historicalCatalogueOwner(core));

/** Select receipts and date masks only. Classification, tier merging and archive
 * rebuilding are producer work; missing or superseded dates remain gaps. */
export async function prepareReadyBankRateHistory(core: CorePayload, manifest: Manifest,
  freshIndex: DatesIndex | null, detached: HistoricalBankRateReady | null,
  isCurrent: () => boolean = () => true): Promise<boolean> {
  const work = backgroundPayloadWork.begin('Prepared bank history', core.run_date, 'Opening prepared fallback', isCurrent);
  markPreparedHistoricalBankRateHistory(core);
  try {
    if (!isCurrent()) return false;
    clearHistoricalBankRateCatalogue(core);
    if (core.run_date !== manifest.run_date) { work.finish('unavailable'); return false; }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getBundledHistoricalBankRateReady, bundledHistoricalReadyBinding } = require('./bundledHistoricalBankRateReady') as typeof import('./bundledHistoricalBankRateReady');
    const checkpoint = async () => { await yieldToUi(0); if (!isCurrent()) throw new Error('Prepared history superseded'); work.checkpoint(); };
    // Shared immutable fallback decoding may outlive this core owner. Let a
    // successor join it; ownership is checked after the shared result resolves.
    const baseline = await getBundledHistoricalBankRateReady({ yieldControl: async () => {
      await yieldToUi(0); work.checkpoint();
    } });
    if (!isCurrent()) return false;
    work.stage('Selecting exact historical publications');
    const meta = await cache.readMeta?.().catch(() => null) ?? null;
    if (!isCurrent()) return false;
    const savedIndex = meta ? parseHistoryDatesIndex(meta.historyDatesIndex, meta.manifest) : null;
    const retained = await cache.readRetainedReadyHistory?.(text => decodeRetainedReadyHistory(text, checkpoint)).catch(() => null) ?? null;
    if (!isCurrent()) return false;
    const baselineIndex = bundledHistoricalReadyBinding.index;
    // Keep the greatest known revision independently for every date. Choosing
    // one entire index can lose corrections when two indexes advance different
    // dates. Equal-revision equivocation fails closed for that date.
    const heads = new Map<string, PayloadRevisionHead>(Object.entries(retained?.heads ?? {})), conflicts = new Set<string>(retained?.conflicts ?? []);
    const selectedDates = new Set<string>(heads.keys());
    for (const index of [baselineIndex, savedIndex, freshIndex]) if (index) {
      for (const day of index.dates) selectedDates.add(day);
      for (const [day, head] of Object.entries(index.revision_heads ?? {})) {
        const previous = heads.get(day);
        if (!previous || head.revision > previous.revision) { heads.set(day, head); conflicts.delete(day); }
        else if (head.revision === previous.revision && (head.manifest_sha256 !== previous.manifest_sha256 ||
          head.bundle_sha256 !== previous.bundle_sha256 || head.generation_id !== previous.generation_id)) conflicts.add(day);
      }
    }
    const covered = new Set<string>();
    const inputs: ReadyHistorySource[] = [];
    for (const ready of [detached, retained?.ready, baseline]) if (ready) {
      const acceptedDates = ready.run_dates.filter(day => {
        const source = ready.sources[day];
        if (day > core.run_date || covered.has(day) || !source || ready.unavailable_dates[day]) return false;
        if (source.kind === 'published_core' && (conflicts.has(day) || source.manifest_sha256 !== heads.get(day)?.manifest_sha256)) return false;
        covered.add(day);
        return true;
      });
      inputs.push({ ready, acceptedDates });
    }
    const receipt = JSON.stringify([inputs.map(input => input.acceptedDates), [...selectedDates].sort()]);
    const previous = installed.get(historicalCatalogueOwner(core));
    const prepared = previous?.receipt === receipt && previous.sources.length === inputs.length &&
      previous.sources.every((ready, index) => ready === inputs[index].ready)
      ? previous.prepared : prepareHistoricalBankRateReadySources(inputs);
    if (!prepared || !isCurrent()) { work.finish('unavailable'); return false; }
    const calendar = [...prepared.catalogue.run_dates];
    for (let date = Date.parse(calendar.at(-1)!) + 86_400_000; date < Date.parse(core.run_date) && calendar.length < 5000; date += 86_400_000) {
      calendar.push(new Date(date).toISOString().slice(0, 10));
    }
    const missing = [...new Set([...calendar, ...selectedDates])]
      .filter(day => day < core.run_date && !covered.has(day)).sort();
    clearHistoricalBankRateCatalogue(core);
    installPreparedHistoricalBankRateCatalogue(core, prepared, missing);
    installed.set(historicalCatalogueOwner(core), { sources: inputs.map(input => input.ready), receipt, prepared, heads, dates: selectedDates, conflicts });
    // Retain only public observations the APK cannot restore. Independent
    // selected-contract observations belong to their current core's payload.
    const retainedDates = new Set<string>();
    const retentionInputs: ReadyHistorySource[] = [];
    for (const ready of [detached, retained?.ready]) if (ready) {
      const acceptedDates = Object.entries(ready.sources).filter(([day, source]) => {
        const bundled = baseline?.sources[day];
        if (day > core.run_date || retainedDates.has(day) || source.kind !== 'published_core' || ready.unavailable_dates[day] ||
          conflicts.has(day) || source.manifest_sha256 !== heads.get(day)?.manifest_sha256 ||
          (bundled?.kind === 'published_core' && !baseline!.unavailable_dates[day] && bundled.manifest_sha256 === source.manifest_sha256)) return false;
        retainedDates.add(day); return true;
      }).map(([day]) => day);
      if (acceptedDates.length) retentionInputs.push({ ready, acceptedDates });
    }
    const sourceReceipt = (values: readonly ReadyHistorySource[]) => JSON.stringify(values.flatMap(input => input.acceptedDates.map(day =>
      [day, input.ready.sources[day]])).sort(([a], [b]) => String(a).localeCompare(String(b))));
    const retainedInputs = retained?.ready ? [{ ready: retained.ready, acceptedDates: Object.keys(retained.ready.sources) }] : [];
    const nextHeads = Object.fromEntries([...heads].sort(([a], [b]) => a.localeCompare(b)));
    const nextConflicts = [...conflicts].sort();
    if (needsRetainedReadyMigration(retained) || sourceReceipt(retentionInputs) !== sourceReceipt(retainedInputs) ||
        JSON.stringify(nextHeads) !== JSON.stringify(retained?.heads ?? {}) ||
        JSON.stringify(nextConflicts) !== JSON.stringify(retained?.conflicts ?? [])) {
      try {
        work.stage('Retaining verified prepared public dates');
        const ready = await compactPublicReadyHistory(retentionInputs, checkpoint);
        const checkpointValue: RetainedReadyHistory = { schema_version: 1, ready, heads: nextHeads, conflicts: nextConflicts };
        const text = await encodeRetainedReadyHistory(checkpointValue, checkpoint);
        if (!isCurrent()) return false;
        await cache.writeRetainedReadyHistory?.(text, isCurrent);
      } catch (error) {
        if (!isCurrent()) return false;
        debugLog.warn('bank-history-ready', `Public retention checkpoint unavailable; previous cache preserved: ${String((error as Error)?.message ?? error)}`);
      }
    }
    if (!isCurrent()) return false;
    work.finish(detached ? 'completed' : 'fallback');
    return true;
  } catch (error) {
    work.finish('failed');
    throw error;
  } finally {
    if (!isCurrent()) work.finish('superseded');
  }
}
