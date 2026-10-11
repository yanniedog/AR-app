import { cache } from './cache';
import { prepareBankRateHistoryAfterPaint } from './storeBankRateHistory';
import { parseHistoryDatesIndex } from './historyDatesIndex';
import type { PayloadProgressSnapshot } from './downloadProgress';
import { computeChanges, notify } from './notifications';
import {
  downloadCore,
  downloadDetails,
  downloadInflate,
  fetchManifest,
  BANK_SPREAD_MAX_COMPRESSED_BYTES,
  BANK_SPREAD_MAX_INFLATED_BYTES,
} from './payload';
import {
  needsDetailsForNotifications,
  profileAccountFeaturesNeedDetails,
} from './optionalPrefs';
import { backgroundPayloadWork, type BackgroundWorkOutcome } from '../lib/backgroundPayloadWork';
import { debugLog } from '../lib/debugLog';
import { logStoreRefreshSkipped } from '../lib/degradationLog';
import { hapticRefreshComplete } from '../lib/haptics';
import { parseJsonHeavy, yieldToUi } from '../lib/yieldToUi';
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
import { rbaCalendarCoverage } from './rbaCalendar';
import { savedRatesWithAlerts } from './subscriptions';
import {
  cachedAssetStateForProviderCoverage,
  liveAssetStateForProviderCoverage,
} from './assetState';
import { assertNoRevisionRollback, samePayloadIdentity } from './payloadRevision';
import { bindStagedSpread, normalizeStagedOptionalAsset, type StagedOptionalAssets } from './stagedOptionalAssets';

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
  bankSpreadHistory: boolean;
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
    bankSpreadHistory:
      previous?.files.core.sha256 !== next?.files.core.sha256 ||
      previous?.files.bank_spread_history?.sha256 !== next?.files.bank_spread_history?.sha256,
    rbaCalendar: !!nextRbaSha && (
      previous?.files.rba_calendar?.sha256 !== nextRbaSha ||
      !state.rbaCalendar ||
      state.rbaCalendarSha !== nextRbaSha ||
      rbaCalendarCoverage(state.rbaCalendar).status === 'awaiting-result'
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
        const work = backgroundPayloadWork.begin('Post-refresh warming', get().core?.run_date ?? null, 'Preparing optional history assets');
        const warmAsset = async (label: string, action: () => Promise<void>, error: () => string | null | undefined) => {
          const asset = backgroundPayloadWork.begin(label, get().core?.run_date ?? null, 'Loading and validating optional asset');
          try { await action(); asset.finish(error() ? 'failed' : 'completed'); }
          catch (caught) { asset.finish('failed'); throw caught; }
        };
        try {
          if (!background) {
            await yieldToUi();
            await Promise.all([
              optionalWork.historyBanks ? warmAsset('Bank summary history', () => get().ensureHistoryBanks(), () => get().historyBanksError) : Promise.resolve(),
              optionalWork.bankInsights ? warmAsset('Bank insights', () => get().ensureBankInsights(), () => get().bankInsightsError) : Promise.resolve(),
              optionalWork.bankSpreadHistory ? warmAsset('Bank spread history', () => get().ensureBankSpreadHistory(), () => get().bankSpreadHistoryError) : Promise.resolve(),
            ]);
          }
          // The calendar is tiny and drives decision alerts/countdowns. Keep it
          // current even in a bounded OS-scheduled refresh; heavy ledgers remain
          // foreground-only.
          if (optionalWork.rbaCalendar) {
            work.stage('Loading RBA calendar');
            await warmAsset('RBA calendar', () => get().ensureRbaCalendar(), () => get().rbaCalendarError);
          }
          // A product screen may have started ensureDetails during the yield;
          // wait for that in-flight load so we do not race on detailsLoading.
          if (!background) {
            work.stage('Waiting for in-flight product details');
            while (get().detailsLoading) await yieldToUi();
          }
          work.stage('Warming product details');
          await warmDetails();
          if (!background && get().prefs.enableDeepSearch && get().manifest?.files.search_index) {
            work.stage('Loading search index');
            await get().ensureSearchIndex();
          }
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
            work.stage('Rebuilding product suitability index');
            await get().ensureDetails({ force: true });
          }
          // Suitability index is built inside ensureDetails; if details were
          // already warm (up-to-date refresh), rebuild from the live pair.
          const live = get();
          if (!background && live.core && live.details && !getSuitabilityIndex()) {
            work.stage('Rebuilding product suitability index');
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
            work.stage('Computing rate-change notifications');
            const messages = computeChanges(
              notifyCtx.previousCore,
              notifyCtx.core,
              savedRatesWithAlerts(state.savedRates ?? [], state.subscriptions),
              state.prefs.rateMoveThresholdBps,
              state.subscriptions,
              notifyCtx.previousDetailsProducts,
              state.details?.products ?? null,
              state.prefs.depositRankMetric,
              state.prefs.mortgageRateMetric,
            );
            work.stage('Delivering rate-change notifications');
            await notify(messages);
            debugLog.info('store', `notified ${messages.length} rate-change message(s)`);
          }
        } catch (err) {
          work.finish('failed');
          debugLog.warn(
            'store',
            `post-refresh warm failed: ${String((err as Error)?.message ?? err)}`,
          );
          // WorkManager retries only when its task reports failure. Foreground
          // refresh remains resilient, while headless notification work must
          // reject so the task handler can return BackgroundTaskResult.Failed.
          if (background) throw err;
        } finally { work.finish(); }
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
      const work = backgroundPayloadWork.begin('Payload refresh', null, 'Fetching current manifest');
      let workOutcome: BackgroundWorkOutcome = 'completed';
      set({ refreshing: true });
      const onProgress = (snapshot: PayloadProgressSnapshot) => {
        work.stage(`${snapshot.phase}: ${snapshot.fileName}`);
        set({ payloadProgress: snapshot });
      };
      let deferWarm = false;
      let historyWork: Promise<void> | null = null;
      let notifyCtx: NotifyContext | null = null;
      let optionalWork: OptionalRefreshWork = {
        historyBanks: false,
        bankInsights: false,
        bankSpreadHistory: false,
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
          if (get().manifest?.payload_revision) throw new Error('Revision index unavailable; update pending');
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
        // Rolling is the authoritative same-core source for corrected optional
        // assets; it may carry a newer RBA calendar than a reused dated manifest.
        remote = mergeOptionalManifestFiles(remote, rolling, true);
        remote = mergeOptionalManifestFiles(remote, get().manifest);
        optionalWork = optionalRefreshWork(get(), remote);

        const meta = await cache.readMeta();
        assertNoRevisionRollback(meta?.manifest, remote);
        const historyDatesIndex = parseHistoryDatesIndex(resolution.datesIndex, remote);
        const upToDate =
          !repairCache &&
          meta?.source === 'remote' &&
          samePayloadIdentity(meta.manifest, remote) &&
          meta.coreSha === remote.files.core.sha256;
        if (upToDate) {
          debugLog.debug('store', `refresh up-to-date run_date=${remote.run_date}`);
          // Bootstrap has normally installed this exact core already. Re-reading
          // the bundle would parse ~11 MB of JSON a second time before the user
          // can navigate. Only touch disk for a cold/headless refresh or a
          // mismatched in-memory core.
          const live = get();
          const searchIndexChanged =
            live.manifest?.files.search_index?.sha256 !==
            remote.files.search_index?.sha256;
          // Persist enriched optional entries so the next cold start retains
          // both legacy files and corrected detached transport/schema metadata.
          // Its asset SHA can stay unchanged when bytes/enc/schema are repaired.
          const cachedOptionalChanged =
            !!meta?.manifest &&
            (OPTIONAL_MANIFEST_KEYS.some(
              (key) =>
                meta.manifest.files[key]?.sha256 !== remote.files[key]?.sha256,
            ) || JSON.stringify(meta.manifest.bank_rate_history_catalogue) !==
              JSON.stringify(remote.bank_rate_history_catalogue) ||
              JSON.stringify(meta.manifest.bank_rate_history_catalogue_packed) !== JSON.stringify(remote.bank_rate_history_catalogue_packed) ||
              JSON.stringify(meta.manifest.bank_rate_history_ready) !== JSON.stringify(remote.bank_rate_history_ready));
          const historyIndexChanged = historyDatesIndex &&
            JSON.stringify(historyDatesIndex) !== JSON.stringify(meta.historyDatesIndex);
          if (cachedOptionalChanged || historyIndexChanged) {
            await cache.updateMeta({
              coreSha: remote.files.core.sha256,
              manifest: remote,
              ...(historyDatesIndex ? { historyDatesIndex } : {}),
            });
            debugLog.info(
              'store',
              `refresh persisted assets and history selection onto cached manifest run_date=${remote.run_date}`,
            );
          }
          const liveMatches =
            samePayloadIdentity(live.manifest, remote) &&
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
            const adoptingRevision = !!remote.payload_revision && !samePayloadIdentity(live.manifest, remote);
            if (adoptingRevision) closeSuitabilityGateUntilRebuild();
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
              status: 'ready',
              bankRateHistoryLoading: true,
              source: 'remote',
              offline: false,
              pendingIngestRunDate,
              ...(adoptingRevision ? { details: null } : {}),
              ...(searchIndexChanged ? {
                // A corrected optional index can arrive without a core SHA
                // change. Never let Search keep filtering with the previous
                // edition while the new asset is loaded on demand.
                searchIndex: null,
                searchIndexStatus: 'idle',
                searchIndexError: null,
              } : {}),
              ...(bundle || optionalWork.bankSpreadHistory ? {
                bankSpreadHistory: null,
                bankSpreadHistoryError: null,
              } : {}),
              ...(bundle ? {
                core: bundle.core,
                coreIntegrity: bundle.integrity,
                coreAssetState: cachedAssetStateForProviderCoverage(
                  bundle.integrity,
                  bundle.core.coverage,
                ),
              } : live.coreIntegrity ? {
                coreAssetState: liveAssetStateForProviderCoverage(
                  live.coreIntegrity,
                  live.core?.coverage,
                ),
              } : {}),
            });
            if (get().core) historyWork = prepareBankRateHistoryAfterPaint(
              set, get, get().core!, remote, resolution.datesIndex, liveMatches ? live.details : null,
              { warm: !background, readCachedDetails: true },
            );
            deferWarm = true;
            set({ refreshOutcome: pendingIngestRunDate ? null : 'success' });
            return false;
          }
          debugLog.warn('store', 'matching cache metadata had no readable core; repairing');
        }

        const adoptionOwner = get().manifest;
        const canAdopt = () => get().manifest === adoptionOwner;
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
        const { text, core, integrity } = await downloadCore(
          remote.files.core.url,
          remote.files.core.sha256,
          {
            fileName: remote.files.core.name,
            expectedBytes: remote.files.core.bytes,
            requireExactBytes: !!remote.payload_revision,
            ...(remote.payload_revision ? { maxCompressedBytes: 64 * 1024 * 1024, maxInflatedBytes: 192 * 1024 * 1024 } : {}),
            onProgress,
          },
        );
        if (core.run_date !== remote.run_date) throw new Error('Core publication date mismatch');
        // Verify the entire immutable edition before advertising it. Staging
        // details by content hash keeps the installed offline edition usable if
        // any subsequent asset download or cache write fails.
        let stagedDetails: DetailsPayload | null = null;
        const stagedOptional: StagedOptionalAssets = {};
        if (remote.payload_revision) {
          const downloaded = await downloadDetails(remote.files.details.url, remote.files.details.sha256, {
            expectedBytes: remote.files.details.bytes, requireExactBytes: true,
            maxCompressedBytes: 64 * 1024 * 1024, maxInflatedBytes: 192 * 1024 * 1024,
          });
          if (downloaded.details.run_date !== remote.run_date) throw new Error('Details publication date mismatch');
          for (const [key, file] of Object.entries(remote.files)) {
            if (key === 'core' || key === 'details') continue;
            const assetText = await downloadInflate(file.url, file.sha256, {
              expectedBytes: file.bytes, requireExactBytes: true,
              maxCompressedBytes: 64 * 1024 * 1024, maxInflatedBytes: 192 * 1024 * 1024,
              ...(key === 'bank_spread_history' ? { maxCompressedBytes: BANK_SPREAD_MAX_COMPRESSED_BYTES,
                maxInflatedBytes: BANK_SPREAD_MAX_INFLATED_BYTES, expectedEncoding: 'gzip' as const, allowEncrypted: false } : {}),
            });
            const decoded = await parseJsonHeavy<Record<string, unknown>>(assetText);
            if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded) ||
                (key !== 'rba_calendar' && decoded.run_date !== remote.run_date)) {
              throw new Error(`Revision ${key} publication date or structure mismatch`);
            }
            Object.assign(stagedOptional, normalizeStagedOptionalAsset(key, decoded, remote));
            if (key === 'search_index') await cache.writeSearchIndex(assetText, file.sha256);
            if (key === 'history_banks') await cache.writeHistoryBanks(JSON.stringify(stagedOptional.historyBanks), file.sha256);
            if (key === 'bank_history') await cache.writeBankInsights(JSON.stringify(stagedOptional.bankInsights), file.sha256);
          }
          await cache.writeDetails(downloaded.text, remote.files.details.sha256);
          stagedDetails = downloaded.details;
        }
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
        if (!canAdopt()) return false;
        await cache.writeBundle(
          {
            manifest: remote,
            source: 'remote',
            savedAt: new Date().toISOString(),
            coreSha: remote.files.core.sha256,
            detailsSha: stagedDetails || detailsUnchanged ? remote.files.details.sha256 : null,
            ...(historyDatesIndex ? { historyDatesIndex } : {}),
          },
          text,
        );
        if (!canAdopt()) return false;
        // Publish the exact asset bindings after the core commits, but before
        // exposing its values: an on-screen ensure must not race a missing sidecar.
        if (stagedOptional.searchIndex || stagedOptional.historyBanks || stagedOptional.bankInsights) {
          try {
            await cache.writeOptionalMeta({ coreSha: remote.files.core.sha256,
              ...(stagedOptional.searchIndex ? { searchIndexSha: remote.files.search_index!.sha256 } : {}),
              ...(stagedOptional.historyBanks ? { historyBanksSha: remote.files.history_banks!.sha256 } : {}),
              ...(stagedOptional.bankInsights ? { bankInsightsSha: remote.files.bank_history!.sha256 } : {}),
            }, canAdopt);
          } catch { /* Live values remain verified; future ensures can repair the optional sidecar. */ }
        }
        if (!canAdopt()) return false;
        if (stagedOptional.bankSpreadHistory) bindStagedSpread(remote, stagedOptional.bankSpreadHistory);
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
          coreIntegrity: integrity,
          coreAssetState: liveAssetStateForProviderCoverage(integrity, core.coverage),
          manifest: remote,
          source: 'remote',
          status: 'ready',
          bankRateHistoryLoading: true,
          error: null,
          pendingIngestRunDate,
          details: stagedDetails ?? (detailsUnchanged ? get().details : null),
          ...(remote.payload_revision ? {
            historyBanks: optionalWork.historyBanks ? null : get().historyBanks, historyBanksError: null,
            bankInsights: optionalWork.bankInsights ? null : get().bankInsights, bankInsightsError: null,
            rbaCalendar: optionalWork.rbaCalendar ? null : get().rbaCalendar,
            rbaCalendarSha: optionalWork.rbaCalendar ? null : get().rbaCalendarSha, rbaCalendarError: null,
          } : {}),
          searchIndex: null,
          searchIndexStatus: 'idle',
          searchIndexError: null,
          ...(optionalWork.bankSpreadHistory ? {
            bankSpreadHistory: null,
            bankSpreadHistoryError: null,
          } : {}),
          ...stagedOptional,
          ...(stagedOptional.searchIndex ? { searchIndexStatus: 'ready' as const } : {}),
        });
        historyWork = prepareBankRateHistoryAfterPaint(set, get, core, remote, resolution.datesIndex, stagedDetails, { warm: !background });
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
        workOutcome = 'failed';
        const msg = String((err as Error)?.message ?? err);
        debugLog.error('store', `refresh failed: ${msg}`);
        const hasData = !!get().core;
        const retainedIntegrity = get().coreIntegrity;
        set({
          offline: true,
          status: hasData ? 'ready' : 'error',
          error: hasData ? null : msg,
          coreAssetState: { status: 'error', data: retainedIntegrity, error: msg },
          lastCheckedAt: new Date().toISOString(),
          refreshOutcome: 'failure',
          ...(get().manifest?.payload_revision ? { pendingIngestRunDate: get().manifest?.run_date } : {}),
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
          if (deferWarm) {
            work.stage('Waiting for post-refresh warming');
            await runPostRefreshWork(notifyCtx, optionalWork);
          }
        } finally {
          work.stage('Waiting for bank rate history preparation');
          await historyWork;
          work.finish(workOutcome);
          if (deferWarm) set({ postRefreshWarming: false });
        }
      }
    },
  } satisfies Pick<AppState, 'refresh'>;
}
