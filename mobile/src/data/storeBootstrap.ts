import { DEFAULT_PREFS, type AppState, type StoreGet, type StoreSet } from './storeTypes';
import { cache } from './cache';
import {
  effectiveDeepSearch,
  effectiveHistoryRibbon,
} from '../lib/proAccess';
import { debugLog } from '../lib/debugLog';
import { useRegisterLogosStore } from '../lib/registerLogos';
import { logRetry, logSuitabilityExclusions } from '../lib/degradationLog';
import { yieldToUi } from '../lib/yieldToUi';
import { countSuitabilityExclusions } from './access';
import {
  sampleCore,
  sampleFallbackIsUsable,
  sampleManifestIsUsable,
  sampleManifest,
} from './sample';
import { sampleAgeErrorMessage } from './storeHelpers';
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

function deferSuitabilityReport(core: CorePayload, get: StoreGet): void {
  // Jest tears its RN module registry down immediately after assertions; do
  // not leave a diagnostic-only InteractionManager continuation behind.
  if (process.env.NODE_ENV === 'test') return;
  void yieldToUi().then(() => {
    if (get().core?.run_date === core.run_date) reportSuitabilityExclusions(core);
  });
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
        const cachedBundle = await cache.readBundle();
        const staleSample =
          cachedBundle?.meta.source === 'sample' &&
          (
            !sampleManifestIsUsable(cachedBundle.meta.manifest) ||
            cachedBundle.meta.coreSha !== sampleManifest.files.core.sha256 ||
            cachedBundle.meta.manifest.files.core.sha256 !== sampleManifest.files.core.sha256 ||
            cachedBundle.core.run_date !== sampleCore.run_date
          );
        const bundle = staleSample ? null : cachedBundle;
        if (staleSample) {
          debugLog.warn(
            'store',
            `ignoring stale or replaced bundled sample cache observed ${cachedBundle?.meta.manifest.run_date}`,
          );
        }
        const [cachedSearch, cachedHistory, cachedProductHistory] = await Promise.all([
          effectiveDeepSearch(prefs) ? cache.readSearchIndex() : Promise.resolve(null),
          effectiveHistoryRibbon(prefs) ? readValidatedHistoryBanks() : Promise.resolve(null),
          // Bank insights are free, but remain screen-lazy so first paint does
          // not hydrate product history unless the user enabled history charts.
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
          deferSuitabilityReport(bundle.core, get);
        } else if (sampleFallbackIsUsable()) {
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
          deferSuitabilityReport(sampleCore, get);
        } else {
          debugLog.warn(
            'store',
            `bundled sample observed ${sampleManifest.run_date} is too old; refreshing before display`,
          );
          set({ status: 'idle', error: null });
          if (!opts.skipRefresh) {
            void useRegisterLogosStore.getState().ensure();
            const refreshed = await get().refresh({});
            if (!refreshed && get().status !== 'ready' && get().status !== 'error') {
              set({ status: 'error', error: sampleAgeErrorMessage() });
            }
            return;
          }
          set({
            status: 'error',
            error: sampleAgeErrorMessage(),
          });
          return;
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
        // An expired bundled/cached sample is intentionally not displayable,
        // but Retry must still be able to recover online from an empty state.
        set({ status: 'idle', error: null });
        await get().refresh({ repairCache: true, manual: true });
      } else {
        await get().refresh({ repairCache: true, manual: true });
      }
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
      const sampleIsCurrent =
        bundle?.meta.source !== 'sample' ||
        (
          sampleManifestIsUsable(bundle.meta.manifest) &&
          bundle.meta.coreSha === sampleManifest.files.core.sha256 &&
          bundle.meta.manifest.files.core.sha256 === sampleManifest.files.core.sha256 &&
          bundle.core.run_date === sampleCore.run_date
        );
      if (bundle && sampleIsCurrent) {
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
  postRefreshWarming: false,
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
  savedRates: [],
  favorites: [] as string[],
  subscriptions: [],
};
