import { SECTION_KEYS, type CorePayload, type DetailsPayload, type Manifest } from '../types';
import { backgroundPayloadWork, type BackgroundWorkOutcome } from '../lib/backgroundPayloadWork';
import { debugLog } from '../lib/debugLog';
import { yieldToPaintFrames } from '../lib/yieldToUi';
import { isLocalAppHealthAudit } from '../lib/appHealthTransportGuard';
import type { DatesIndex } from './datesIndex';
import { prepareReadyBankRateHistory } from './historicalBankRateReadySync';
import { historicalCatalogueOwner, markPreparedHistoricalBankRateHistory, warmHistoricalBankRateCatalogue } from './historicalBankRateCatalogueStore';
import { samePayloadIdentity } from './payloadRevision';
import { validateDetachedHistoricalCatalogueDescriptor } from './detachedHistoricalBankRateCatalogueWire';
import type { StoreGet, StoreSet } from './storeTypes';

const requests = new WeakMap<StoreGet, { completion: Promise<void>; finish: () => void; work: ReturnType<typeof backgroundPayloadWork.begin> }>();

/** Product history shares the prepared catalogue instead of racing it with a
 * second download of every historical core. Follow a superseding request too. */
export async function waitForBankRateHistoryPreparation(get: StoreGet): Promise<void> {
  let request;
  while ((request = requests.get(get))) await request.completion;
}

/** Optional history must never hold the cached core, splash or download UI.
 * Claim ownership synchronously, then allow the usable screen to paint first.
 * Refresh/audit await this promise; bootstrap deliberately does not. */
export async function prepareBankRateHistoryAfterPaint(
  set: StoreSet, get: StoreGet, core: CorePayload, manifest: Manifest,
  index: DatesIndex | null = null, details: DetailsPayload | null = null,
  options: { warm?: boolean; readCachedDetails?: boolean } = {},
): Promise<void> {
  markPreparedHistoricalBankRateHistory(core);
  let finish!: () => void;
  const work = backgroundPayloadWork.begin('Bank rate history preparation', core.run_date, 'Waiting for first paint', () => isCurrent());
  const completion = new Promise<void>(resolve => { finish = resolve; });
  const request = { completion, finish, work };
  const previous = requests.get(get);
  previous?.work.finish('superseded');
  requests.set(get, request);
  // Wake existing consumers so they follow the successor even if the retired
  // native/cache operation never settles. Only the successor owns loading state.
  previous?.finish();
  const isAssetCurrent = () => !!get().core &&
    historicalCatalogueOwner(get().core!) === historicalCatalogueOwner(core) &&
    samePayloadIdentity(get().manifest, manifest) &&
    get().manifest?.files.core.sha256 === manifest.files.core.sha256 &&
    get().manifest?.files.details.sha256 === manifest.files.details.sha256 &&
    JSON.stringify(get().manifest?.bank_rate_history_catalogue) === JSON.stringify(manifest.bank_rate_history_catalogue) &&
    JSON.stringify(get().manifest?.bank_rate_history_catalogue_packed) === JSON.stringify(manifest.bank_rate_history_catalogue_packed) &&
    JSON.stringify(get().manifest?.bank_rate_history_ready) === JSON.stringify(manifest.bank_rate_history_ready);
  const isCurrent = () => requests.get(get) === request && isAssetCurrent();
  set({ bankRateHistoryLoading: true });
  const started = Date.now();
  let outcome: BackgroundWorkOutcome = 'superseded';
  try {
    await yieldToPaintFrames(2);
    if (!isCurrent()) return;
    // Resolve only after first paint; a literal require also works in the
    // repository's Jest runtime without enabling experimental VM modules.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { configureNativeHistoricalCatalogueCodec } = require('./historicalBankRateCatalogueNative') as typeof import('./historicalBankRateCatalogueNative');
    work.stage('Configuring native history decoder');
    await configureNativeHistoricalCatalogueCodec();
    if (!isCurrent()) return;
    // Prefer producer-prepared charts. A legacy publisher can still supply a
    // verified full history archive; ignoring it strands every graph at the
    // APK fallback's last date. Never rebuild history by fetching dated cores.
    let detached = null;
    if (manifest.bank_rate_history_ready) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { loadDetachedHistoricalBankRateReady } = require('./detachedHistoricalBankRateReady') as typeof import('./detachedHistoricalBankRateReady');
      work.stage('Loading prepared bank history');
      detached = await loadDetachedHistoricalBankRateReady(manifest, {
        allowNetwork: !isLocalAppHealthAudit(), isCurrent, isAssetCurrent,
      });
    }
    if (!isCurrent()) return;
    work.stage('Selecting verified prepared history');
    let ready = false;
    if (detached) {
      try { ready = await prepareReadyBankRateHistory(core, manifest, index, detached, isCurrent); }
      catch (error) { debugLog.warn('store', `prepared history unavailable; trying compatible archive: ${String(error)}`); }
    }
    let publishedHistory = !!detached;
    if (!isCurrent()) return;
    if (!ready && validateDetachedHistoricalCatalogueDescriptor(manifest)) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { loadDetachedHistoricalBankRateCatalogue } = require('./detachedHistoricalBankRateCatalogue') as typeof import('./detachedHistoricalBankRateCatalogue');
      work.stage('Loading compatible bank history');
      const legacy = await loadDetachedHistoricalBankRateCatalogue(manifest, {
        allowNetwork: !isLocalAppHealthAudit(), isCurrent, isAssetCurrent,
      });
      if (!isCurrent()) return;
      if (legacy) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { prepareLegacyBankRateHistory } = require('./historicalBankRateLegacyCompatibility') as typeof import('./historicalBankRateLegacyCompatibility');
        ready = await prepareLegacyBankRateHistory(core, manifest, index, legacy, isCurrent);
        publishedHistory = ready;
      }
    }
    if (!isCurrent()) return;
    if (!ready) ready = await prepareReadyBankRateHistory(core, manifest, index, null, isCurrent);
    if (!isCurrent()) return;
    const prefs = get().prefs;
    if (options.warm !== false) {
      work.stage('Warming bank/section/profile history views');
      await warmHistoricalBankRateCatalogue(get().core!, {
        profileFilters: prefs.profileFilters, includeNonStandard: prefs.includeNonStandard,
        interests: SECTION_KEYS,
      });
    }
    if (isCurrent()) outcome = !ready ? 'unavailable' : publishedHistory ? 'completed' : 'fallback';
    if (isCurrent()) debugLog.info('store', `bank history prepared after first paint elapsed_ms=${Date.now() - started}`);
  } catch (error) {
    outcome = 'failed';
    debugLog.warn('store', `optional bank history preparation failed: ${String((error as Error)?.message ?? error)}`);
  } finally {
    work.finish(outcome);
    // An old completion must not clear a newer core/revision's loading state.
    // A cancelled request without a successor must still release its own flag.
    if (requests.get(get) === request) {
      const current = isCurrent();
      requests.delete(get);
      set({ bankRateHistoryLoading: false,
        ...(current ? { bankRateHistoryRevision: (get().bankRateHistoryRevision ?? 0) + 1 } : {}) });
    }
    finish();
  }
}
