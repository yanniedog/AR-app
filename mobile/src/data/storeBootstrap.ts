import { DEFAULT_PREFS, type AppState, type StoreGet, type StoreSet } from './storeTypes';
import { cache } from './cache';
import { effectiveDeepSearch, effectiveHistoryRibbon } from '../lib/proAccess';
import { debugLog } from '../lib/debugLog';
import { useRegisterLogosStore } from '../lib/registerLogos';
import { logRetry, logSuitabilityExclusions } from '../lib/degradationLog';
import { yieldToUi } from '../lib/yieldToUi';
import { countSuitabilityExclusions } from './access';
import { sampleCore, sampleManifest } from './sample';
import { installSampleSeed, readValidatedHistoryBanks } from './storeHelpers';
import { SECTION_ORDER } from '../constants';
import type { CorePayload } from '../types';
import { normalizeProductHistoryPayload } from './productHistory';
import {
  clearSuitabilityIndex,
  closeSuitabilityGateUntilRebuild,
  hydrateSuitabilityIndex,
} from './suitabilityIndex';

function reportSuitabilityExclusions(core: CorePayload | null | undefined): void {
  if (!core) return;
  const rows = SECTION_ORDER.flatMap((section) => core.sections[section]?.rates ?? []);
  logSuitabilityExclusions(core.run_date, countSuitabilityExclusions(rows));
}

export function createBootstrapActions(
  set: StoreSet,
  get: StoreGet,
  getStore: () => { persist?: { rehydrate?: () => void | Promise<void> } },
) {
  return {
    async bootstrap(opts: { skipRefresh?: boolean } = {}) {
      if (get().status === 'ready' || get().status === 'loading') return;
      debugLog.info('store', 'bootstrap');
      set({ status: 'loading', error: null });

      try {
        await getStore().persist?.rehydrate?.();
      } catch (err) {
        debugLog.warn('store', `prefs rehydrate failed: ${String((err as Error)?.message ?? err)}`);
      }

      try {
        const prefs = get().prefs;
        const bundle = await cache.readBundle();
        const [cachedSearch, cachedHistory, cachedProductHistory] = await Promise.all([
          effectiveDeepSearch(prefs) ? cache.readSearchIndex() : Promise.resolve(null),
          effectiveHistoryRibbon(prefs) ? readValidatedHistoryBanks() : Promise.resolve(null),
          effectiveHistoryRibbon(prefs)
            ? cache.readProductHistory().then((raw) => {
                const normalized = normalizeProductHistoryPayload(raw);
                if (!normalized) return null;
                // Only hydrate when the cache matches today's core — a killed
                // mid-refresh must not show yesterday's product series.
                const coreSha = bundle?.meta.coreSha ?? '';
                const runOk = normalized.run_date === bundle?.core.run_date;
                const shaOk = !normalized.core_sha || !coreSha || normalized.core_sha === coreSha;
                return runOk && shaOk ? normalized : null;
              })
            : Promise.resolve(null),
        ]);
        if (bundle) {
          debugLog.info('store', `cache hit run_date=${bundle.core.run_date} source=${bundle.meta.source}`);
          clearSuitabilityIndex();
          const suitabilityIndex = await hydrateSuitabilityIndex(
            bundle.core.run_date,
            bundle.meta.coreSha,
            bundle.meta.manifest.files.details.sha256,
          );
          if (!suitabilityIndex) {
            // A fresh core can reach disk before its exact details-derived
            // suitability index. Never expose the core-only fallback during
            // that startup window: eligibility-only restrictions would appear
            // on Home until the background details warm completed.
            closeSuitabilityGateUntilRebuild();
          }
          set({
            core: bundle.core,
            manifest: bundle.meta.manifest,
            source: bundle.meta.source,
            status: 'ready',
            error: null,
            ...(cachedSearch ? { searchIndex: cachedSearch } : {}),
            ...(cachedHistory ? { historyBanks: cachedHistory } : {}),
            ...(cachedProductHistory ? { productHistory: cachedProductHistory } : {}),
          });
          if (!suitabilityIndex) {
            // Start with matching cached details when available, independent of
            // the manifest refresh/network. ensureDetails claims the load
            // synchronously, so the normal refresh warm safely coalesces.
            void get().ensureDetails({ force: true });
          }
          // Defer diagnostics so the first paint is not blocked by ~3.6k regex scans.
          const readyCore = bundle.core;
          void yieldToUi().then(() => {
            if (get().core?.run_date === readyCore.run_date) reportSuitabilityExclusions(readyCore);
          });
        } else {
          debugLog.info('store', 'cache miss — seeding bundled sample');
          clearSuitabilityIndex();
          await installSampleSeed();
          set({
            core: sampleCore,
            manifest: sampleManifest,
            source: 'sample',
            status: 'ready',
            error: null,
          });
          // Defer diagnostics so the first paint is not blocked by ~3.6k regex scans.
          const seeded = sampleCore;
          void yieldToUi().then(() => {
            if (get().core?.run_date === seeded.run_date) reportSuitabilityExclusions(seeded);
          });
        }
      } catch (err) {
        const msg = String((err as Error)?.message ?? err);
        debugLog.error('store', `bootstrap failed: ${msg}`);
        set({ status: 'error', error: msg });
        return;
      }

      void useRegisterLogosStore.getState().ensure();
      if (!opts.skipRefresh) void get().refresh({});
    },

    async retryDataLoad() {
      logRetry('retryDataLoad', 'start');
      debugLog.info('store', 'retryDataLoad');
      set({ status: 'idle', error: null });
      await get().bootstrap({ skipRefresh: true });
      if (get().status !== 'ready') {
        logRetry('retryDataLoad', 'failure', get().error ?? undefined);
        return;
      }
      await get().refresh({ repairCache: true, manual: true });
      if (get().refreshOutcome === 'failure') {
        logRetry('retryDataLoad', 'failure', get().error ?? 'refresh failed');
      } else {
        logRetry('retryDataLoad', 'success');
      }
    },

    async loadSampleFallback() {
      debugLog.info('store', 'loadSampleFallback');
      set({ status: 'loading', error: null, refreshing: false, payloadProgress: null });
      try {
        await installSampleSeed();
        clearSuitabilityIndex();
        set({
          core: sampleCore,
          manifest: sampleManifest,
          source: 'sample',
          status: 'ready',
          error: null,
          offline: true,
          details: null,
          searchIndex: null,
          historyBanks: null,
          historyBanksError: null,
          bankInsights: null,
          bankInsightsError: null,
          rbaCalendar: null,
          rbaCalendarSha: null,
          rbaCalendarError: null,
          productHistory: null,
          productHistoryError: null,
          pendingIngestRunDate: null,
        });
      } catch (err) {
        const msg = String((err as Error)?.message ?? err);
        debugLog.error('store', `loadSampleFallback failed: ${msg}`);
        set({ status: 'error', error: msg });
      }
    },

    async ensureCoreLoaded() {
      if (get().core) return;
      const bundle = await cache.readBundle();
      if (bundle) {
        set({ core: bundle.core, manifest: bundle.meta.manifest, source: bundle.meta.source });
      }
    },
  } satisfies Pick<
    AppState,
    'bootstrap' | 'retryDataLoad' | 'loadSampleFallback' | 'ensureCoreLoaded'
  >;
}

export const bootstrapInitialState = {
  status: 'idle' as const,
  refreshing: false,
  source: 'sample' as const,
  manifest: null,
  core: null,
  details: null,
  searchIndex: null,
  historyBanks: null,
  historyBanksError: null,
  bankInsights: null,
  bankInsightsError: null,
  rbaCalendar: null,
  rbaCalendarSha: null,
  rbaCalendarError: null,
  productHistory: null,
  productHistoryError: null,
  detailsLoading: false,
  error: null,
  offline: false,
  lastCheckedAt: null,
  payloadProgress: null,
  refreshOutcome: null,
  pendingIngestRunDate: null,
  hydrated: false,
  activeSection: DEFAULT_PREFS.defaultSection,
  prefs: DEFAULT_PREFS,
  favorites: [] as string[],
  subscriptions: [],
};
