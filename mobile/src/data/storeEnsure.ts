import type { DetailsPayload } from '../types';
import { cache } from './cache';
import {
  downloadBankInsights,
  downloadDetails,
  downloadHistoryBanks,
  downloadRbaCalendar,
  downloadSearchIndex,
} from './payload';
import { shouldWarmDetails } from './optionalPrefs';
import { dailyHistorySha, syncHistoryFromDailyPayloads } from './historyDaily';
import { normalizeHistoryBanksPayload } from './historyPayload';
import type { HistoryBanksPayload } from './historyPayload';
import { normalizeBankInsightsPayload } from './bankInsights';
import {
  normalizeProductHistoryPayload,
  syncProductHistoryFromDailyPayloads,
  type ProductHistoryPurpose,
  type ProductHistoryPayload,
} from './productHistory';
import { effectiveBankInsights, effectiveDeepSearch, effectiveHistoryRibbon } from '../lib/proAccess';
import { debugLog } from '../lib/debugLog';
import { logDegradation, logEnsureSkipped } from '../lib/degradationLog';
import { sampleDetails } from './sample';
import type { AppState, StoreGet, StoreSet } from './storeTypes';
import { yieldToUi } from '../lib/yieldToUi';
import {
  historyBanksSyncState,
  productHistorySyncState,
  readValidatedHistoryBanks,
} from './storeHelpers';
import {
  buildSuitabilityIndex,
  installSuitabilityIndex,
  rebuildAndInstallSuitabilityIndex,
  getSuitabilityIndex,
  suitabilityIndexMatches,
} from './suitabilityIndex';
import { isSuitabilityFilterReady } from './suitabilityGate';

/** Coalesce concurrent ensureDetails callers onto one in-flight load. */
let detailsEnsureInFlight: Promise<void> | null = null;
/** Bumped when a force warm abandons a hung/stale in-flight ensure. */
let detailsEnsureGeneration = 0;

export function createEnsureActions(set: StoreSet, get: StoreGet) {
  const datasetStillCurrent = (
    runDate: string,
    coreSha: string,
    detailsSha: string,
    detailsRunDate: string | null | undefined,
  ): boolean => {
    const cur = get();
    return (
      cur.core?.run_date === runDate &&
      (cur.manifest?.files.core.sha256 ?? '') === coreSha &&
      (cur.manifest?.files.details.sha256 ?? '') === detailsSha &&
      (cur.details?.run_date ?? null) === (detailsRunDate ?? null)
    );
  };

  return {
    async ensureDetails(
      opts: { forProductView?: boolean; force?: boolean; abandonInFlight?: boolean } = {},
    ) {
      const { forProductView = false, force = false, abandonInFlight = false } = opts;
      if (!get().core) return;

      // Wait for the in-flight load instead of silently no-oping — Home's
      // force-warm used to miss the post-ingest rebuild when bootstrap/refresh
      // had already claimed detailsLoading. Same-frame force callers still
      // coalesce; abandonInFlight escapes a hung owner (Home Retry).
      if (detailsEnsureInFlight) {
        if (!abandonInFlight) {
          await detailsEnsureInFlight;
          return;
        }
        detailsEnsureGeneration += 1;
        detailsEnsureInFlight = null;
      }

      const { details, core, manifest, source, detailsLoading, prefs, subscriptions } = get();
      if (!core) return;
      if (!abandonInFlight && detailsLoading) return;
      if (!forProductView && !force && !shouldWarmDetails(prefs, subscriptions)) return;

      const wantSha = manifest?.files.details.sha256 ?? null;
      const detailsSha = wantSha ?? '';
      const coreSha = manifest?.files.core.sha256 ?? '';
      const runDate = core.run_date;
      const myGeneration = detailsEnsureGeneration;
      let reensureAfter = false;

      const run = (async () => {
        // Claim the load before the first await. Home, Browse, and product screens
        // can request details in the same frame; without this synchronous claim
        // they can all pass the initial guard and parse/download the large asset.
        set({ detailsLoading: true });
        try {
          const meta = await cache.readMeta();
          if (myGeneration !== detailsEnsureGeneration) return;
          const shaOk = !wantSha || meta?.detailsSha === wantSha;
          if (details && details.run_date === core.run_date && shaOk) {
            if (!suitabilityIndexMatches(getSuitabilityIndex(), runDate, coreSha, detailsSha)) {
              await rebuildAndInstallSuitabilityIndex(
                core,
                details,
                detailsSha,
                () => datasetStillCurrent(runDate, coreSha, detailsSha, details.run_date),
                coreSha,
              );
            }
            return;
          }

          const datasetUnchanged = () => {
            if (myGeneration !== detailsEnsureGeneration) return false;
            const cur = get();
            return (
              cur.core?.run_date === core.run_date &&
              cur.manifest?.files.core.sha256 === manifest?.files.core.sha256 &&
              cur.manifest?.files.details.sha256 === manifest?.files.details.sha256
            );
          };

          // A stale details file expands to several megabytes. Its hash mismatch
          // already proves it cannot satisfy this core, so do not parse it merely
          // to throw it away before downloading the current asset.
          const cached = shaOk ? await cache.readDetails() : null;
          if (cached && cached.run_date === core.run_date) {
            if (datasetUnchanged()) {
              set({ details: cached });
              await rebuildAndInstallSuitabilityIndex(
                core,
                cached,
                detailsSha,
                () => datasetStillCurrent(runDate, coreSha, detailsSha, cached.run_date),
                coreSha,
              );
            }
            return;
          }
          if (source === 'remote' && manifest) {
            const { text, details: fresh } = await downloadDetails(
              manifest.files.details.url,
              manifest.files.details.sha256,
            );
            if (!datasetUnchanged()) return;
            await cache.writeDetails(text);
            if (!datasetUnchanged()) return;
            await cache.updateMeta({
              manifest,
              source: 'remote',
              savedAt: new Date().toISOString(),
              coreSha: manifest.files.core.sha256,
              detailsSha: manifest.files.details.sha256,
            });
            if (!datasetUnchanged()) return;
            set({ details: fresh });
            await rebuildAndInstallSuitabilityIndex(
              core,
              fresh,
              manifest.files.details.sha256,
              () =>
                datasetStillCurrent(
                  runDate,
                  coreSha,
                  manifest.files.details.sha256,
                  fresh.run_date,
                ),
              coreSha,
            );
            return;
          }
          if (get().source === 'sample') {
            set({ details: sampleDetails as DetailsPayload });
            const seeded = sampleDetails as DetailsPayload;
            await rebuildAndInstallSuitabilityIndex(
              core,
              seeded,
              '',
              () => datasetStillCurrent(runDate, coreSha, '', seeded.run_date),
              coreSha,
            );
          }
        } catch (err) {
          if (myGeneration !== detailsEnsureGeneration) return;
          const msg = String((err as Error)?.message ?? err);
          debugLog.warn('store', `ensureDetails failed: ${msg}`);
          logDegradation('warn', 'store.ensureFailed', { fn: 'ensureDetails', error: msg });
          if (get().source === 'sample') set({ details: sampleDetails as DetailsPayload });
        } finally {
          if (myGeneration !== detailsEnsureGeneration) return;
          set({ detailsLoading: false });
          const cur = get();
          const movedOn =
            cur.core?.run_date !== core.run_date ||
            cur.manifest?.files.core.sha256 !== manifest?.files.core.sha256 ||
            cur.manifest?.files.details.sha256 !== manifest?.files.details.sha256;
          if (cur.core && movedOn) {
            // Defer until after detailsEnsureInFlight clears in tracked.finally —
            // calling ensureDetails here would coalesce onto this same promise.
            reensureAfter = true;
            return;
          }
          // Last resort: if details for this manifest are already trusted on disk
          // but the suitability index is still sealed, rebuild from those details.
          // Never open a core-only / stale-details gate here — that can mark
          // restricted products as broadly available after a transient details
          // failure. Home's retry UI covers a still-closed gate once loading settles.
          if (cur.core && !isSuitabilityFilterReady(false)) {
            const liveCoreSha = cur.manifest?.files.core.sha256 ?? '';
            const wantDetailsSha = cur.manifest?.files.details.sha256 ?? '';
            const meta = await cache.readMeta();
            const detailsShaTrusted =
              !!wantDetailsSha && meta?.detailsSha === wantDetailsSha;
            const liveDetails =
              detailsShaTrusted && cur.details?.run_date === cur.core.run_date
                ? cur.details
                : null;
            if (!liveDetails) {
              debugLog.warn(
                'store',
                'ensureDetails leaving suitability gate closed (no trusted matching details)',
              );
              return;
            }
            const liveRunDate = cur.core.run_date;
            const stillThisCore = () =>
              get().core?.run_date === liveRunDate &&
              (get().manifest?.files.core.sha256 ?? '') === liveCoreSha &&
              (get().manifest?.files.details.sha256 ?? '') === wantDetailsSha;
            debugLog.warn(
              'store',
              'ensureDetails rebuilding suitability index from trusted details',
            );
            const installed = await rebuildAndInstallSuitabilityIndex(
              cur.core,
              liveDetails,
              wantDetailsSha,
              stillThisCore,
              liveCoreSha,
            );
            if (!installed && stillThisCore() && !isSuitabilityFilterReady(false)) {
              const built = await buildSuitabilityIndex(
                cur.core,
                liveDetails,
                wantDetailsSha,
                liveCoreSha,
              );
              if (stillThisCore()) installSuitabilityIndex(built);
            }
          }
        }
      })();

      const tracked = run.finally(() => {
        if (detailsEnsureInFlight === tracked) detailsEnsureInFlight = null;
        if (reensureAfter && myGeneration === detailsEnsureGeneration) {
          void get().ensureDetails(opts);
        }
      });
      detailsEnsureInFlight = tracked;
      return tracked;
    },

    async ensureSearchIndex() {
      if (!effectiveDeepSearch(get().prefs)) {
        logEnsureSkipped('ensureSearchIndex', 'proGate');
        return;
      }
      const { core, manifest, source, searchIndex } = get();
      if (!core || !manifest?.files.search_index) return;
      const asset = manifest.files.search_index;
      const coreSha = manifest.files.core.sha256;
      const meta = await cache.readOptionalMeta();
      const shaFresh = meta?.coreSha === coreSha && meta?.searchIndexSha === asset.sha256;
      if (searchIndex && searchIndex.run_date === core.run_date && shaFresh) {
        return;
      }
      const cached = await cache.readSearchIndex();
      if (cached && cached.run_date === core.run_date && shaFresh) {
        set({ searchIndex: cached });
        return;
      }
      if (source !== 'remote') return;
      try {
        const { text, searchIndex: fresh } = await downloadSearchIndex(asset.url, asset.sha256);
        await cache.writeSearchIndex(text);
        await cache.writeOptionalMeta({ coreSha, searchIndexSha: asset.sha256 });
        set({ searchIndex: fresh });
      } catch (err) {
        const msg = String((err as Error)?.message ?? err);
        debugLog.warn('store', `ensureSearchIndex failed: ${msg}`);
        logDegradation('warn', 'store.ensureFailed', { fn: 'ensureSearchIndex', error: msg });
      }
    },

    async ensureHistoryBanks(opts: { force?: boolean } = {}) {
      const { force = false } = opts;
      if (!effectiveHistoryRibbon(get().prefs)) {
        logEnsureSkipped('ensureHistoryBanks', 'proGate');
        return;
      }
      // Trends + refresh + product screens all call this; coalesce so we never
      // download the compact asset (or fan out dated cores) three times at once.
      // Key on core + history asset revision so a same-core manifest that only
      // bumps history_banks.sha256 starts a fresh ensure instead of joining stale work.
      const currentCoreSha = get().manifest?.files.core.sha256 ?? '';
      const currentHistorySha = get().manifest?.files.history_banks?.sha256 ?? '';
      if (
        !force &&
        historyBanksSyncState.inFlight &&
        historyBanksSyncState.inFlightCoreSha === currentCoreSha &&
        historyBanksSyncState.inFlightHistorySha === currentHistorySha
      ) {
        return historyBanksSyncState.inFlight;
      }
      const run = (async () => {
        if (force) set({ historyBanksError: null });
        debugLog.info('store', 'ensureHistoryBanks start');
        // #region agent log
        const _hbT0 = Date.now();
        debugLog.debug(
          'perf',
          `ensureHistoryBanks start force=${force} coreSha=${currentCoreSha.slice(0, 12)}`,
        );
        // #endregion
        const { core, manifest, source, historyBanks } = get();
        if (!core) {
          debugLog.debug('store', 'ensureHistoryBanks skipped (no core)');
          return;
        }
        if (source !== 'remote' || !manifest) {
          set({ historyBanks: null, historyBanksError: null });
          return;
        }

        const coreSha = manifest.files.core.sha256;
        const meta = await cache.readOptionalMeta();
        const shaMatches = (sha?: string) => meta?.coreSha === coreSha && meta?.historyBanksSha === sha;
        const cached = historyBanks ?? (await readValidatedHistoryBanks());

        const installHistory = async (validated: HistoryBanksPayload, sha: string) => {
          await yieldToUi();
          const text = JSON.stringify(validated);
          await cache.writeHistoryBanks(text);
          await cache.writeOptionalMeta({ coreSha, historyBanksSha: sha });
          set({ historyBanks: validated, historyBanksError: null });
          debugLog.info(
            'store',
            `ensureHistoryBanks ok run_date=${validated.run_date} slices=${validated.run_dates.length}`,
          );
          // #region agent log
          debugLog.debug(
            'perf',
            `ensureHistoryBanks ok ms=${Date.now() - _hbT0} slices=${validated.run_dates.length}`,
          );
          // #endregion
        };

        const compactAsset = manifest.files.history_banks;
        if (compactAsset) {
          if (!force && cached && cached.run_date === core.run_date && shaMatches(compactAsset.sha256)) {
            set({ historyBanks: cached, historyBanksError: null });
            // #region agent log
            debugLog.debug(
              'perf',
              `ensureHistoryBanks cacheHit ms=${Date.now() - _hbT0} slices=${cached.run_dates.length}`,
            );
            // #endregion
            return;
          }
          try {
            const { historyBanks: fresh } = await downloadHistoryBanks(
              compactAsset.url,
              compactAsset.sha256,
            );
            const validated = normalizeHistoryBanksPayload(fresh);
            if (!validated) {
              debugLog.error(
                'store',
                'ensureHistoryBanks rejected payload after download (validation failed)',
              );
              throw new Error('history_banks payload failed validation');
            }
            await installHistory(validated, compactAsset.sha256);
            return;
          } catch (err) {
            const msg = String((err as Error)?.message ?? err);
            debugLog.warn(
              'store',
              `ensureHistoryBanks compact asset failed: ${msg}`,
            );
            // #region agent log
            debugLog.debug(
              'perf',
              `ensureHistoryBanks compactFail ms=${Date.now() - _hbT0} err=${msg}`,
            );
            // #endregion
            // A transient failure of the tiny compact asset must not fan out to
            // dozens of dated 11 MB cores. Keep any usable cache and let the
            // explicit Retry action try this asset again.
            set({
              historyBanks: cached?.run_dates.length ? cached : null,
              historyBanksError: msg,
            });
            return;
          }
        }

        if (!force && cached && cached.run_date === core.run_date && cached.run_dates.length > 1) {
          set({ historyBanks: cached, historyBanksError: null });
          return;
        }

        try {
          const synced = await syncHistoryFromDailyPayloads({
            targetRunDate: core.run_date,
            currentCore: core,
            existing: cached,
            cachedDates: new Set(cached?.run_dates ?? []),
          });
          if (synced.run_dates.length > 1) {
            await installHistory(synced, dailyHistorySha(synced.run_dates));
            return;
          }
        } catch (err) {
          debugLog.warn(
            'store',
            `ensureHistoryBanks daily sync failed: ${String((err as Error)?.message ?? err)}`,
          );
        }

        const asset = manifest.files.history_banks;
        if (!asset) {
          if (cached && cached.run_dates.length > 1) {
            set({ historyBanks: cached, historyBanksError: null });
            return;
          }
          set({ historyBanks: null, historyBanksError: 'history dates unavailable' });
          return;
        }

        if (!force && cached && cached.run_date === core.run_date && shaMatches(asset.sha256)) {
          set({ historyBanks: cached, historyBanksError: null });
          return;
        }

        try {
          const { historyBanks: fresh } = await downloadHistoryBanks(asset.url, asset.sha256);
          const validated = normalizeHistoryBanksPayload(fresh);
          if (!validated) {
            debugLog.error('store', 'ensureHistoryBanks rejected payload after download (validation failed)');
            set({ historyBanks: null, historyBanksError: 'history_banks payload failed validation' });
            return;
          }
          await installHistory(validated, asset.sha256);
        } catch (err) {
          const msg = String((err as Error)?.message ?? err);
          debugLog.error('store', `ensureHistoryBanks failed: ${msg}`);
          set({ historyBanks: cached?.run_dates.length ? cached : null, historyBanksError: msg });
        }
      })();
      historyBanksSyncState.inFlightCoreSha = currentCoreSha;
      historyBanksSyncState.inFlightHistorySha = currentHistorySha;
      const promise = run.finally(() => {
        if (historyBanksSyncState.inFlight === promise) {
          historyBanksSyncState.inFlight = null;
          historyBanksSyncState.inFlightCoreSha = null;
          historyBanksSyncState.inFlightHistorySha = null;
        }
      });
      historyBanksSyncState.inFlight = promise;
      return promise;
    },

    async ensureBankInsights(opts: { force?: boolean } = {}) {
      const { force = false } = opts;
      if (!effectiveBankInsights(get().prefs)) {
        logEnsureSkipped('ensureBankInsights', 'proGate');
        return;
      }
      const { core, manifest, source, bankInsights } = get();
      if (!core) return;
      if (source !== 'remote' || !manifest) {
        set({
          bankInsights: null,
          bankInsightsError: 'Bank response analysis needs the latest online dataset.',
        });
        return;
      }
      const asset = manifest.files.bank_history;
      if (!asset) {
        logDegradation('warn', 'store.ensureUnavailable', { fn: 'ensureBankInsights', reason: 'manifest_missing_asset' });
        set({ bankInsightsError: 'bank history unavailable' });
        return;
      }
      if (force) set({ bankInsightsError: null });
      const coreSha = manifest.files.core.sha256;
      const meta = await cache.readOptionalMeta();
      const fresh = (p: ReturnType<StoreGet>['bankInsights']) =>
        !!p && p.run_date === core.run_date && meta?.coreSha === coreSha && meta?.bankInsightsSha === asset.sha256;
      if (!force && fresh(bankInsights)) {
        set({ bankInsightsError: null });
        return;
      }
      const cached = force ? null : normalizeBankInsightsPayload(await cache.readBankInsights());
      if (!force && fresh(cached)) {
        set({ bankInsights: cached, bankInsightsError: null });
        return;
      }
      try {
        const { bankInsights: downloaded } = await downloadBankInsights(asset.url, asset.sha256);
        await cache.writeBankInsights(JSON.stringify(downloaded));
        await cache.writeOptionalMeta({ coreSha, bankInsightsSha: asset.sha256 });
        set({ bankInsights: downloaded, bankInsightsError: null });
        debugLog.info(
          'store',
          `ensureBankInsights ok run_date=${downloaded.run_date} banks=${Object.keys(downloaded.banks).length} events=${downloaded.events.length}`,
        );
      } catch (err) {
        const msg = String((err as Error)?.message ?? err);
        debugLog.warn('store', `ensureBankInsights failed: ${msg}`);
        logDegradation('warn', 'store.ensureFailed', { fn: 'ensureBankInsights', error: msg });
        const fallback = force ? bankInsights : cached ?? bankInsights ?? null;
        set({ bankInsights: fallback, bankInsightsError: msg });
      }
    },

    async ensureRbaCalendar() {
      const { core, manifest, source, rbaCalendar, rbaCalendarSha } = get();
      if (!core || source !== 'remote' || !manifest) {
        if (source !== 'remote' || !manifest) {
          set({ rbaCalendar: null, rbaCalendarSha: null, rbaCalendarError: null });
        }
        return;
      }
      const asset = manifest.files.rba_calendar;
      if (!asset) {
        set({ rbaCalendar: null, rbaCalendarSha: null, rbaCalendarError: 'rba calendar unavailable' });
        return;
      }
      if (rbaCalendar && rbaCalendarSha === asset.sha256) return;
      try {
        const { rbaCalendar: downloaded } = await downloadRbaCalendar(asset.url, asset.sha256);
        set({ rbaCalendar: downloaded, rbaCalendarSha: asset.sha256, rbaCalendarError: null });
        debugLog.info(
          'store',
          `ensureRbaCalendar ok decisions=${downloaded.decisions.length} schedule=${downloaded.schedule.length}`,
        );
      } catch (err) {
        const msg = String((err as Error)?.message ?? err);
        debugLog.warn('store', `ensureRbaCalendar failed: ${msg}`);
        set({ rbaCalendarError: msg });
      }
    },

    async retryHistoryBanks() {
      if (!effectiveHistoryRibbon(get().prefs)) return;
      set({ historyBanksError: null });
      const { manifest } = get();
      if (!manifest?.files.history_banks) {
        await get().refresh({ manual: true });
      }
      await get().ensureHistoryBanks({ force: true });
    },

    async retryBankInsights() {
      if (!effectiveBankInsights(get().prefs)) {
        logEnsureSkipped('retryBankInsights', 'proGate');
        return;
      }
      set({ bankInsightsError: null });
      const { manifest } = get();
      if (!manifest?.files.bank_history) {
        await get().refresh({ manual: true });
      }
      await get().ensureBankInsights({ force: true });
    },

    async ensureProductHistory(
      opts: { force?: boolean; purpose?: ProductHistoryPurpose } = {},
    ) {
      const { force = false, purpose = 'history_ribbon' } = opts;
      const prefs = get().prefs;
      const permitted =
        purpose === 'bank_move'
          ? effectiveBankInsights(prefs)
          : effectiveHistoryRibbon(prefs);
      if (!permitted) {
        logEnsureSkipped('ensureProductHistory', `${purpose}Gate`);
        return;
      }
      const currentCoreSha = get().manifest?.files.core.sha256 ?? '';
      if (
        !force &&
        productHistorySyncState.inFlight &&
        productHistorySyncState.inFlightCoreSha === currentCoreSha
      ) {
        return productHistorySyncState.inFlight;
      }
      const run = (async () => {
        if (force) set({ productHistoryError: null });
        const { core, manifest, source, productHistory } = get();
        if (!core) return;
        if (source !== 'remote') {
          set({ productHistory: null, productHistoryError: null });
          return;
        }
        const cached = productHistory ?? normalizeProductHistoryPayload(await cache.readProductHistory());
        const coreSha = manifest?.files.core.sha256 ?? '';
        const requestId = ++productHistorySyncState.request;
        let lastPublished = cached ?? null;
        const revisionIsCurrent = () => {
          const current = get();
          return (
            requestId === productHistorySyncState.request &&
            current.source === 'remote' &&
            current.core?.run_date === core.run_date &&
            (current.manifest?.files.core.sha256 ?? '') === coreSha
          );
        };
        try {
          let finalCheckpointPublished = false;
          const persistCheckpoint = async (
            checkpoint: ProductHistoryPayload,
            logSuffix: string,
          ): Promise<boolean> => {
            if (!revisionIsCurrent()) return false;
            // ~2.7k products × dozens of dates — stringify can stall the JS
            // thread, so every durable checkpoint yields around the work.
            await yieldToUi();
            const text = JSON.stringify(checkpoint);
            await yieldToUi();
            if (!revisionIsCurrent()) return false;
            await cache.writeProductHistory(text);
            if (!revisionIsCurrent()) return false;
            set({ productHistory: checkpoint, productHistoryError: null });
            lastPublished = checkpoint;
            debugLog.info(
              'store',
              `ensureProductHistory checkpoint run_date=${checkpoint.run_date} slices=${checkpoint.run_dates.length} ${logSuffix}`,
            );
            return true;
          };
          const synced = await syncProductHistoryFromDailyPayloads({
            targetRunDate: core.run_date,
            currentCore: core,
            coreSha,
            existing: cached,
            isCurrent: revisionIsCurrent,
            onCheckpoint: async (checkpoint, progress) => {
              const published = await persistCheckpoint(
                checkpoint,
                `ok=${progress.successfulDates}/${progress.totalMissingDates} done=${progress.done}`,
              );
              if (published && progress.done) finalCheckpointPublished = true;
            },
          });
          if (!revisionIsCurrent()) {
            debugLog.info('store', `ensureProductHistory superseded run_date=${synced.run_date}`);
            return;
          }
          // Keep callers robust if a custom/test sync implementation returns a
          // final payload without invoking the progressive callback.
          if (!finalCheckpointPublished) {
            await persistCheckpoint(synced, 'done=true');
          }
          debugLog.info(
            'store',
            `ensureProductHistory ok run_date=${synced.run_date} slices=${synced.run_dates.length} products=${Object.keys(synced.products).length}`,
          );
        } catch (err) {
          const msg = String((err as Error)?.message ?? err);
          debugLog.warn('store', `ensureProductHistory failed: ${msg}`);
          logDegradation('warn', 'store.ensureFailed', { fn: 'ensureProductHistory', error: msg });
          if (!revisionIsCurrent()) return;
          set({ productHistory: lastPublished, productHistoryError: msg });
        }
      })();
      productHistorySyncState.inFlightCoreSha = currentCoreSha;
      const promise = run.finally(() => {
        if (productHistorySyncState.inFlight === promise) {
          productHistorySyncState.inFlight = null;
          productHistorySyncState.inFlightCoreSha = null;
        }
      });
      productHistorySyncState.inFlight = promise;
      return promise;
    },
  } satisfies Pick<
    AppState,
    | 'ensureDetails'
    | 'ensureSearchIndex'
    | 'ensureHistoryBanks'
    | 'ensureBankInsights'
    | 'ensureRbaCalendar'
    | 'ensureProductHistory'
    | 'retryHistoryBanks'
    | 'retryBankInsights'
  >;
}
