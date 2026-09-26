import { SECTION_KEYS, type CorePayload, type DetailsPayload, type Manifest } from '../types';
import { debugLog } from '../lib/debugLog';
import { yieldToPaintFrames } from '../lib/yieldToUi';
import { cache } from './cache';
import type { DatesIndex } from './datesIndex';
import { prepareHistoricalBankRateHistory } from './historicalBankRateCatalogueSync';
import { historicalCatalogueOwner, warmHistoricalBankRateCatalogue } from './historicalBankRateCatalogueStore';
import { normalizeInterests } from './interests';
import { samePayloadIdentity } from './payloadRevision';
import type { StoreGet, StoreSet } from './storeTypes';

const requests = new WeakMap<StoreGet, object>();

/** Optional history must never hold the cached core, splash or download UI.
 * Claim ownership synchronously, then allow the usable screen to paint first.
 * Refresh/audit await this promise; bootstrap deliberately does not. */
export async function prepareBankRateHistoryAfterPaint(
  set: StoreSet, get: StoreGet, core: CorePayload, manifest: Manifest,
  index: DatesIndex | null = null, details: DetailsPayload | null = null,
  options: { warm?: boolean; readCachedDetails?: boolean } = {},
): Promise<void> {
  const request = {};
  requests.set(get, request);
  const isCurrent = () => requests.get(get) === request && !!get().core &&
    historicalCatalogueOwner(get().core!) === historicalCatalogueOwner(core) &&
    samePayloadIdentity(get().manifest, manifest) &&
    get().manifest?.files.core.sha256 === manifest.files.core.sha256 &&
    get().manifest?.files.details.sha256 === manifest.files.details.sha256;
  set({ bankRateHistoryLoading: true });
  const started = Date.now();
  try {
    await yieldToPaintFrames(2);
    if (!isCurrent()) return;
    const historyDetails = details ?? (options.readCachedDetails ? await cache.readDetails() : null);
    if (!isCurrent()) return;
    await prepareHistoricalBankRateHistory(core, manifest, index, historyDetails);
    if (!isCurrent()) return;
    const prefs = get().prefs;
    if (options.warm !== false) await warmHistoricalBankRateCatalogue(get().core!, {
      profileFilters: prefs.profileFilters, includeNonStandard: prefs.includeNonStandard,
      interests: prefs.onboarded ? normalizeInterests(prefs.interests) : SECTION_KEYS,
    });
    if (isCurrent()) debugLog.info('store', `bank history prepared after first paint elapsed_ms=${Date.now() - started}`);
  } catch (error) {
    debugLog.warn('store', `optional bank history preparation failed: ${String((error as Error)?.message ?? error)}`);
  } finally {
    // An old completion must not clear a newer core/revision's loading state.
    if (isCurrent()) set({ bankRateHistoryLoading: false,
      bankRateHistoryRevision: (get().bankRateHistoryRevision ?? 0) + 1 });
  }
}
