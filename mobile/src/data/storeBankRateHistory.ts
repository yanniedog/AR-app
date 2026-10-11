import { SECTION_KEYS, type CorePayload, type DetailsPayload, type Manifest } from '../types';
import { backgroundPayloadWork, type BackgroundWorkOutcome } from '../lib/backgroundPayloadWork';
import { debugLog } from '../lib/debugLog';
import { yieldToPaintFrames } from '../lib/yieldToUi';
import { isLocalAppHealthAudit } from '../lib/appHealthTransportGuard';
import { cache } from './cache';
import type { DatesIndex } from './datesIndex';
import { prepareHistoricalBankRateHistory } from './historicalBankRateCatalogueSync';
import { historicalCatalogueOwner, warmHistoricalBankRateCatalogue } from './historicalBankRateCatalogueStore';
import { normalizeInterests } from './interests';
import { samePayloadIdentity } from './payloadRevision';
import type { StoreGet, StoreSet } from './storeTypes';

const requests = new WeakMap<StoreGet, { completion: Promise<void>; work: ReturnType<typeof backgroundPayloadWork.begin> }>();

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
  let finish!: () => void;
  requests.get(get)?.work.finish('superseded');
  const work = backgroundPayloadWork.begin('Bank rate history preparation', core.run_date, 'Waiting for first paint');
  const request = { work, completion: new Promise<void>(resolve => { finish = resolve; }) };
  requests.set(get, request);
  const isAssetCurrent = () => !!get().core &&
    historicalCatalogueOwner(get().core!) === historicalCatalogueOwner(core) &&
    samePayloadIdentity(get().manifest, manifest) &&
    get().manifest?.files.core.sha256 === manifest.files.core.sha256 &&
    get().manifest?.files.details.sha256 === manifest.files.details.sha256 &&
    JSON.stringify(get().manifest?.bank_rate_history_catalogue) === JSON.stringify(manifest.bank_rate_history_catalogue);
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
    work.stage('Reading cached product details');
    const historyDetails = details ?? (options.readCachedDetails ? await cache.readDetails() : null);
    if (!isCurrent()) return;
    // Keep transport, cache and archive decoding outside the first-paint path.
    // The loader authenticates the detached asset without changing sealed core.
    let detached = null;
    if (manifest.bank_rate_history_catalogue) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { loadDetachedHistoricalBankRateCatalogue } = require('./detachedHistoricalBankRateCatalogue') as typeof import('./detachedHistoricalBankRateCatalogue');
      work.stage('Loading detached historical catalogue');
      detached = await loadDetachedHistoricalBankRateCatalogue(manifest, {
        allowNetwork: !isLocalAppHealthAudit(), isCurrent, isAssetCurrent,
      });
    }
    if (!isCurrent()) return;
    work.stage(detached ? 'Preparing verified historical catalogue' : 'Preparing fallback historical catalogue');
    const ready = detached
      ? await prepareHistoricalBankRateHistory(core, manifest, index, historyDetails, detached)
      : await prepareHistoricalBankRateHistory(core, manifest, index, historyDetails);
    if (!isCurrent()) return;
    const prefs = get().prefs;
    if (options.warm !== false) {
      work.stage('Warming bank/section/profile history views');
      await warmHistoricalBankRateCatalogue(get().core!, {
        profileFilters: prefs.profileFilters, includeNonStandard: prefs.includeNonStandard,
        interests: prefs.onboarded ? normalizeInterests(prefs.interests) : SECTION_KEYS,
      });
    }
    if (isCurrent()) outcome = !ready ? 'unavailable' : detached ? 'completed' : 'fallback';
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
