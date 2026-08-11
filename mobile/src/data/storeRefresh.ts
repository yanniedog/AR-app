import { cache } from './cache';
import type { PayloadProgressSnapshot } from './downloadProgress';
import { computeChanges, notify } from './notifications';
import {
  downloadCore,
  fetchManifest,
} from './payload';
import {
  needsDetailsForNotifications,
  profileAccountFeaturesNeedDetails,
} from './optionalPrefs';
import { debugLog } from '../lib/debugLog';
import { logStoreRefreshSkipped } from '../lib/degradationLog';
import { hapticRefreshComplete } from '../lib/haptics';
import { yieldToUi } from '../lib/yieldToUi';
import type { AppState, StoreGet, StoreSet } from './storeTypes';
import { onWifi } from './storeHelpers';
import {
  closeSuitabilityGateUntilRebuild,
  getSuitabilityIndex,
  rebuildAndInstallSuitabilityIndex,
  suitabilityIndexMatches,
} from './suitabilityIndex';
import { mergeOptionalManifestFiles, OPTIONAL_MANIFEST_KEYS, resolveFinalizedManifest } from './ingestFinalized';
import type { CorePayload, DetailsPayload, Manifest } from '../types';

type NotifyContext = {
  previousCore: CorePayload | null;
  previousSource: AppState['source'];
  previousDetailsProducts: DetailsPayload['products'] | null;
  core: CorePayload;
  /** Stable identity for the installed core — object refs change across refreshes. */
  coreSha: string;
};

type OptionalRefreshWork = {
  historyBanks: boolean;
  bankInsights: boolean;
  rbaCalendar: boolean;
};

function optionalRefreshWork(
  state: Pick<AppState, 'manifest' | 'rbaCalendar' | 'rbaCalendarSha'>,
  next: AppState['manifest'],
): OptionalRefreshWork {
  const previous = state.manifest;
  const nextRbaSha = next?.files.rba_calendar?.sha256 ?? null;
  return {
    historyBanks:
      previous?.files.history_banks?.sha256 !== next?.files.history_banks?.sha256,
    bankInsights:
      previous?.files.bank_history?.sha256 !== next?.files.bank_history?.sha256,
    rbaCalendar: !!nextRbaSha && (
      previous?.files.rba_calendar?.sha256 !== nextRbaSha ||
      !state.rbaCalendar ||
      state.rbaCalendarSha !== nextRbaSha
    ),
  };
}

export function createRefreshActions(set: StoreSet, get: StoreGet) {
  return {
    async refresh(
      opts: { manual?: boolean; repairCache?: boolean; background?: boolean } = {},
    ) {
      const { manual = false, repairCache = false, background = false } = opts;
      const warmDetails = async () => {
        // Search/product screens request details on demand. Refresh only warms
        // the large asset when profile feature picks or notification search
        // filters need feature/eligibility fields.
        const prefs = get().prefs;
        const notificationDetailsNeeded = needsDetailsForNotifications(
          prefs,
          get().subscriptions,
        );
        if (
          notificationDetailsNeeded ||
          (!background && profileAccountFeaturesNeedDetails(prefs.profileFilters))
        ) {
          await get().ensureDetails();
        }
      };
      /**
       * Heavy post-install work after refreshing=false so the UI can accept
       * touches. Still awaited by refresh() so background fetch keeps the task
       * alive until warm/notify finish.
       */
      const runPostRefreshWork = async (
        notifyCtx: NotifyContext | null,
        optionalWork: OptionalRefreshWork,
      ) => {
        try {
          if (!background) {
            await yieldToUi();
            await Promise.all([
              optionalWork.historyBanks ? get().ensureHistoryBanks() : Promise.resolve(),
              optionalWork.bankInsights ? get().ensureBankInsights() : Promise.resolve(),
            ]);
          }
          // The calendar is tiny and drives decision alerts/countdowns. Keep it
          // current even in a bounded OS-scheduled refresh; heavy ledgers remain
          // foreground-only.
          if (optionalWork.rbaCalendar) await get().ensureRbaCalendar();
          // A product screen may have started ensureDetails during the yield;
          // wait for that in-flight load so we do not race on detailsLoading.
          if (!background) {
            while (get().detailsLoading) await yieldToUi();
          }
          await warmDetails();
          const afterWarm = get();
          const afterCoreSha = afterWarm.manifest?.files.core.sha256 ?? '';
          const afterDetailsSha = afterWarm.manifest?.files.details.sha256 ?? '';
          if (
            !background &&
            afterWarm.core &&
            !suitabilityIndexMatches(
              getSuitabilityIndex(),
              afterWarm.core.run_date,
              afterCoreSha,
              afterDetailsSha,
            )
          ) {
            // The suitability gate is required for standard-only product
            // integrity. Build it after refreshing=false; subsequent startups
            // hydrate the small persisted Set instead of parsing details again.
            await get().ensureDetails({ force: true });
          }
          // Suitability index is built inside ensureDetails; if details were
          // already warm (up-to-date refresh), rebuild from the live pair.
          const live = get();
          if (!background && live.core && live.details && !getSuitabilityIndex()) {
            await rebuildAndInstallSuitabilityIndex(
              live.core,
              live.details,
              live.manifest?.files.details.sha256 ?? '',
              () =>
                get().core?.run_date === live.core?.run_date &&
                (get().manifest?.files.core.sha256 ?? '') ===
                  (live.manifest?.files.core.sha256 ?? ''),
              live.manifest?.files.core.sha256 ?? '',
            );
          }
          if (notifyCtx && notifyCtx.previousSource === 'remote') {
            if (!background) await yieldToUi();
            const state = get();
            // Compare SHA, not object identity — an up-to-date refresh re-parses
            // the same payload into a new object and must not suppress notify.
            const liveSha = state.manifest?.files.core.sha256;
            if (liveSha && liveSha !== notifyCtx.coreSha) {
              debugLog.debug('store', 'skip notify; core superseded by newer refresh');
              return;
            }
            if (!state.prefs.notificationsEnabled) return;
            // Re-read favorites/subscriptions at notify time so a user who
            // unsubscribes during the yield window is not notified for them.
            const messages = computeChanges(
              notifyCtx.previousCore,
              notifyCtx.core,
              state.savedRates?.length ? state.savedRates : state.favorites,
              state.prefs.rateMoveThresholdBps,
              state.subscriptions,
              notifyCtx.previousDetailsProducts,
              state.details?.products ?? null,
              state.prefs.depositRankMetric,
              state.prefs.mortgageRateMetric,
            );
            await notify(messages);
            debugLog.info('store', `notified ${messages.length} rate-change message(s)`);
          }
        } catch (err) {
          debugLog.warn(
            'store',
            `post-refresh warm failed: ${String((err as Error)?.message ?? err)}`,
          );
          // WorkManager retries only when its task reports failure. Foreground
          // refresh remains resilient, while headless notification work must
          // reject so the task handler can return BackgroundTaskResult.Failed.
          if (background) throw err;
        }
      };

      if (get().refreshing) {
        logStoreRefreshSkipped('already_refreshing');
        return false;
      }
      const prefs = get().prefs;
      if (prefs.wifiOnly && !manual && !(await onWifi())) {
        logStoreRefreshSkipped('wifi_only');
        debugLog.debug('store', 'refresh skipped (wifi-only, not on Wi-Fi)');
        set({ lastCheckedAt: new Date().toISOString(), refreshOutcome: 'wifi-skip' });
        return false;
      }
      debugLog.info(
        'store',
        `refresh start manual=${manual} repairCache=${repairCache} background=${background}`,
      );
      set({ refreshing: true });
      const onProgress = (snapshot: PayloadProgressSnapshot) => set({ payloadProgress: snapshot });
      let deferWarm = false;
      let notifyCtx: NotifyContext | null = null;
      let optionalWork: OptionalRefreshWork = {
        historyBanks: false,
        bankInsights: false,
        rbaCalendar: false,
      };
      try {
        const rolling = await fetchManifest(undefined, onProgress);
        set({ offline: false, lastCheckedAt: new Date().toISOString() });

        const finalizeStarted = Date.now();
        onProgress({
          phase: 'finalize',
          fileName: 'dates-index.json',
          bytesReceived: 0,
          totalBytes: null,
          startedAt: finalizeStarted,
          phaseComplete: false,
        });
        if (!background) await yieldToUi();
        const resolution = await resolveFinalizedManifest(rolling, {
          verifiedDated: get().manifest,
        });
        onProgress({
          phase: 'finalize',
          fileName: 'dates-index.json',
          bytesReceived: 1,
          totalBytes: 1,
          startedAt: finalizeStarted,
          phaseComplete: true,
        });
        let remote: Manifest = rolling;
        let pendingIngestRunDate: string | null = null;

        if (resolution.status === 'finalized') {
          remote = resolution.manifest;
          pendingIngestRunDate = null;
        } else if (resolution.status === 'pending') {
          pendingIngestRunDate = resolution.pendingIngestRunDate;
          if (resolution.manifest) {
            remote = resolution.manifest;
          } else {
            // In-flight rolling day is not safe yet and we could not load a
            // finalized fallback — keep the installed day fully usable.
            const live = get();
            const hasUsable =
              !!live.core && (live.source === 'remote' || live.source === 'cache');
            if (hasUsable) {
              debugLog.info(
                'store',
                `refresh holding installed run_date=${live.core?.run_date} pending=${pendingIngestRunDate}`,
              );
              set({
                pendingIngestRunDate,
                offline: false,
                refreshOutcome: null,
              });
              return false;
            }
            // Cold start with nothing installed: refuse the in-flight rolling
            // day rather than half-adopt it.
            throw new Error(
              `today's ingest (${pendingIngestRunDate}) is still uploading; try again shortly`,
            );
          }
        } else {
          // dates-index unreachable — do not jump to a newer rolling day than
          // what we already trust on disk.
          const live = get();
          const liveDate = live.core?.run_date?.slice(0, 10) ?? '';
          const rollingDate = String(rolling.run_date || '').slice(0, 10);
          const hasUsable =
            !!live.core && (live.source === 'remote' || live.source === 'cache');
          if (hasUsable && liveDate && rollingDate && rollingDate > liveDate) {
            debugLog.warn(
              'store',
              `dates-index down; holding run_date=${liveDate} (rolling=${rollingDate})`,
            );
            set({
              pendingIngestRunDate: rollingDate,
              offline: false,
              refreshOutcome: null,
            });
            return false;
          }
          if (!hasUsable) {
            // Cold start with no trusted day: refuse rolling until dates-index
            // can confirm finalisation (same posture as pending cold start).
            throw new Error(
              rollingDate
                ? `cannot verify ingest finalisation for ${rollingDate}; try again shortly`
                : 'cannot verify ingest finalisation; try again shortly',
            );
          }
          remote = rolling;
          pendingIngestRunDate = null;
        }

        // Dated tags often omit optional assets. Prefer rolling (same day) then
        // the already-installed day so bank history / RBA calendar survive.
        remote = mergeOptionalManifestFiles(remote, rolling);
        remote = mergeOptionalManifestFiles(remote, get().manifest);
        optionalWork = optionalRefreshWork(get(), remote);

        const meta = await cache.readMeta();
        const upToDate =
          !repairCache &&
          meta?.source === 'remote' &&
          meta.manifest.run_date === remote.run_date &&
          meta.coreSha === remote.files.core.sha256;
        if (upToDate) {
          debugLog.debug('store', `refresh up-to-date run_date=${remote.run_date}`);
          // Bootstrap has normally installed this exact core already. Re-reading
          // the bundle would parse ~11 MB of JSON a second time before the user
          // can navigate. Only touch disk for a cold/headless refresh or a
          // mismatched in-memory core.
          const live = get();
          // Persist enriched optional file entries so the next cold start does
          // not re-load a core/details-only dated manifest from cache meta.
          const cachedOptionalChanged =
            !!meta?.manifest &&
            OPTIONAL_MANIFEST_KEYS.some(
              (key) =>
                meta.manifest.files[key]?.sha256 !== remote.files[key]?.sha256,
            );
          if (cachedOptionalChanged) {
            await cache.updateMeta({
              coreSha: remote.files.core.sha256,
              manifest: remote,
            });
            debugLog.info(
              'store',
              `refresh persisted optional assets onto cached manifest run_date=${remote.run_date}`,
            );
          }
          const liveMatches =
            live.core?.run_date === remote.run_date &&
            live.manifest?.files.core.sha256 === remote.files.core.sha256;
          if (!liveMatches) {
            // Stay in finalize band while probing cache — do not enter the parse
            // band until a readable bundle is known (failed probes fall through
            // to downloadCore which must start at the download band).
            onProgress({
              phase: 'finalize',
              fileName: 'cached-core.json',
              bytesReceived: 0,
              totalBytes: null,
              startedAt: Date.now(),
              phaseComplete: false,
            });
            if (!background) await yieldToUi();
          }
          const bundle = liveMatches ? null : await cache.readBundle();
          if (liveMatches || bundle) {
            if (bundle) {
              onProgress({
                phase: 'parse',
                fileName: 'cached-core.json',
                bytesReceived: 1,
                totalBytes: 1,
                startedAt: Date.now(),
                phaseComplete: true,
              });
            }
            set({
              manifest: remote,
              source: 'remote',
              offline: false,
              pendingIngestRunDate,
              ...(bundle ? { core: bundle.core } : {}),
            });
            deferWarm = true;
            set({ refreshOutcome: pendingIngestRunDate ? null : 'success' });
            return false;
          }
          debugLog.warn('store', 'matching cache metadata had no readable core; repairing');
        }

        const previousCore = get().core;
        const previousSource = get().source;
        let previousDetailsProducts = get().details?.products ?? null;
        const needPreviousDetails = needsDetailsForNotifications(
          get().prefs,
          get().subscriptions,
        );
        if (!previousDetailsProducts && previousCore && needPreviousDetails) {
          const cachedDetails = await cache.readDetails();
          if (cachedDetails && cachedDetails.run_date === previousCore.run_date) {
            previousDetailsProducts = cachedDetails.products ?? null;
            if (!get().details) set({ details: cachedDetails });
          }
        }
        const { text, core } = await downloadCore(
          remote.files.core.url,
          remote.files.core.sha256,
          {
            fileName: remote.files.core.name,
            expectedBytes: remote.files.core.bytes,
            onProgress,
          },
        );
        const detailsUnchanged = !!meta && meta.detailsSha === remote.files.details.sha256;
        onProgress({
          phase: 'install',
          fileName: remote.files.core.name,
          bytesReceived: 0,
          totalBytes: text.length,
          startedAt: Date.now(),
          phaseComplete: false,
        });
        if (!background) await yieldToUi();
        await cache.writeBundle(
          {
            manifest: remote,
            source: 'remote',
            savedAt: new Date().toISOString(),
            coreSha: remote.files.core.sha256,
            detailsSha: detailsUnchanged ? remote.files.details.sha256 : null,
          },
          text,
        );
        onProgress({
          phase: 'install',
          fileName: remote.files.core.name,
          bytesReceived: text.length,
          totalBytes: text.length,
          startedAt: Date.now(),
          phaseComplete: true,
        });
        // Publish core and clear the download UI immediately so touches are not
        // blocked by details warm / optional assets / change-diff work.
        const currentIndex = getSuitabilityIndex();
        if (
          !suitabilityIndexMatches(
            currentIndex,
            core.run_date,
            remote.files.core.sha256,
            remote.files.details.sha256,
          )
        ) {
          // Never apply a previous payload pair's eligibility decisions to a
          // replacement core. Keep standard-only surfaces closed until the
          // post-refresh details rebuild installs the exact matching index.
          closeSuitabilityGateUntilRebuild();
        }
        set({
          core,
          manifest: remote,
          source: 'remote',
          status: 'ready',
          error: null,
          pendingIngestRunDate,
          details: detailsUnchanged ? get().details : null,
        });
        notifyCtx = {
          previousCore,
          previousSource,
          previousDetailsProducts,
          core,
          coreSha: remote.files.core.sha256,
        };
        deferWarm = true;
        debugLog.info(
          'store',
          `refresh ok run_date=${core.run_date} changed=true pending=${pendingIngestRunDate ?? 'none'}`,
        );
        set({ refreshOutcome: pendingIngestRunDate ? null : 'success' });
        return true;
      } catch (err) {
        const msg = String((err as Error)?.message ?? err);
        debugLog.error('store', `refresh failed: ${msg}`);
        const hasData = !!get().core;
        set({
          offline: true,
          status: hasData ? 'ready' : 'error',
          error: hasData ? null : msg,
          lastCheckedAt: new Date().toISOString(),
          refreshOutcome: 'failure',
        });
        return false;
      } finally {
        // Clear refreshing before post-warm so the UI is interactive even while
        // awaiters (background fetch) still wait for warm/notify to finish.
        set({
          refreshing: false,
          postRefreshWarming: deferWarm,
          payloadProgress: null,
        });
        if (manual) hapticRefreshComplete();
        try {
          if (deferWarm) await runPostRefreshWork(notifyCtx, optionalWork);
        } finally {
          if (deferWarm) set({ postRefreshWarming: false });
        }
      }
    },
  } satisfies Pick<AppState, 'refresh'>;
}
