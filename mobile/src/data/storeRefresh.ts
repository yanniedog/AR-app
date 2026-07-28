import { cache } from './cache';
import type { PayloadProgressSnapshot } from './downloadProgress';
import { computeChanges, notify } from './notifications';
import {
  downloadCore,
  fetchManifest,
} from './payload';
import { needsDetailsForNotifications } from './optionalPrefs';
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
import { resolveFinalizedManifest } from './ingestFinalized';
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
  previous: AppState['manifest'],
  next: AppState['manifest'],
): OptionalRefreshWork {
  return {
    historyBanks:
      previous?.files.history_banks?.sha256 !== next?.files.history_banks?.sha256,
    bankInsights:
      previous?.files.bank_history?.sha256 !== next?.files.bank_history?.sha256,
    rbaCalendar:
      previous?.files.rba_calendar?.sha256 !== next?.files.rba_calendar?.sha256,
  };
}

export function createRefreshActions(set: StoreSet, get: StoreGet) {
  return {
    async refresh(
      opts: { manual?: boolean; repairCache?: boolean } = {},
    ) {
      const { manual = false, repairCache = false } = opts;
      const warmDetails = async () => {
        // Search/product screens request details on demand. Refresh only warms
        // the large asset when a background notification genuinely needs its
        // feature/eligibility fields.
        if (needsDetailsForNotifications(get().prefs, get().subscriptions)) {
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
          await yieldToUi();
          await Promise.all([
            optionalWork.historyBanks ? get().ensureHistoryBanks() : Promise.resolve(),
            optionalWork.bankInsights ? get().ensureBankInsights() : Promise.resolve(),
            optionalWork.rbaCalendar ? get().ensureRbaCalendar() : Promise.resolve(),
          ]);
          // A product screen may have started ensureDetails during the yield;
          // wait for that in-flight load so we do not race on detailsLoading.
          while (get().detailsLoading) await yieldToUi();
          await warmDetails();
          const afterWarm = get();
          const afterCoreSha = afterWarm.manifest?.files.core.sha256 ?? '';
          const afterDetailsSha = afterWarm.manifest?.files.details.sha256 ?? '';
          if (
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
          if (live.core && live.details && !getSuitabilityIndex()) {
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
            await yieldToUi();
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
              state.favorites,
              state.prefs.rateMoveThresholdBps,
              state.subscriptions,
              notifyCtx.previousDetailsProducts,
              state.details?.products ?? null,
              state.prefs.depositRankMetric,
            );
            await notify(messages);
            debugLog.info('store', `notified ${messages.length} rate-change message(s)`);
          }
        } catch (err) {
          debugLog.warn(
            'store',
            `post-refresh warm failed: ${String((err as Error)?.message ?? err)}`,
          );
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
        `refresh start manual=${manual} repairCache=${repairCache}`,
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
        await yieldToUi();
        const resolution = await resolveFinalizedManifest(rolling);
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
          optionalWork = optionalRefreshWork(live.manifest, remote);
          const liveMatches =
            live.core?.run_date === remote.run_date &&
            live.manifest?.files.core.sha256 === remote.files.core.sha256;
          if (!liveMatches) {
            onProgress({
              phase: 'parse',
              fileName: 'cached-core.json',
              bytesReceived: 0,
              totalBytes: null,
              startedAt: Date.now(),
              phaseComplete: false,
            });
            await yieldToUi();
          }
          const bundle = liveMatches ? null : await cache.readBundle();
          if (liveMatches || bundle) {
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
        set({ refreshing: false, payloadProgress: null });
        if (manual) hapticRefreshComplete();
        if (deferWarm) await runPostRefreshWork(notifyCtx, optionalWork);
      }
    },
  } satisfies Pick<AppState, 'refresh'>;
}
