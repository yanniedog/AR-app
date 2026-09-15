import { HISTORY_DERIVATION_VERSION, historyDateStatuses } from './historyDerivation';
import { resolveLegacyPublications } from './historicalPublication';
import type { CorePayload } from '../types';
import { debugLog } from '../lib/debugLog';
import { yieldToUi } from '../lib/yieldToUi';
import type { DatesIndex } from './datesIndex';
import { normalizeTimelineDates } from './bankHistoryTransform';
import { assertHistoricalIdentitiesAdvance, historicalRevisionHighWater, historicalSourceIdentity, normalizeHistoryIdentities } from './historyIdentity';
import { bestRatesForCore, productKeysForCore, buildProductHistoryFromRates, type ProductHistoryPayload } from './productHistoryModel';
import {
  createDatedFetchCircuit,
  DATED_FETCH_CIRCUIT_LIMIT,
  downloadDatedCore,
  fetchDatesIndexJson,
  historyDatesUpTo,
} from './historyDaily';

export interface SyncProductHistoryOpts {
  targetRunDate: string;
  currentCore: CorePayload;
  coreSha?: string;
  existing?: ProductHistoryPayload | null;
  /** Override circuit trip threshold (tests). */
  circuitLimit?: number;
  /** Successful dated cores between durable checkpoints. Defaults to five. */
  checkpointEvery?: number;
  /** Publish a usable recent-history checkpoint while older dates keep warming. */
  onCheckpoint?: (
    payload: ProductHistoryPayload,
    progress: ProductHistorySyncProgress,
  ) => void | Promise<void>;
  /** Stops work when the core revision that requested the sync is no longer current. */
  isCurrent?: () => boolean;
}

export interface ProductHistorySyncProgress {
  successfulDates: number;
  attemptedDates: number;
  totalMissingDates: number;
  lastRunDate: string | null;
  done: boolean;
  circuitOpen: boolean;
}

/**
 * Incrementally download the dated cores missing from `existing` and (re)build the
 * per-product history. The current day is always recomputed from `currentCore`.
 *
 * Version 3 retains every downloaded product, so catalogue growth needs no full
 * re-download. Older caches migrate progressively once; corrected publication
 * identities invalidate only their affected dates.
 */
export async function syncProductHistoryFromDailyPayloads(
  opts: SyncProductHistoryOpts,
): Promise<ProductHistoryPayload> {
  const targetRunDate = String(opts.targetRunDate || '').slice(0, 10);
  if (!targetRunDate) throw new Error('syncProductHistoryFromDailyPayloads: missing targetRunDate');

  let indexedDates: string[] = [];
  let selectedIndex: DatesIndex | undefined;
  const revisionHighWater = historicalRevisionHighWater(
    opts.existing?.revision_high_water, opts.existing?.source_identities,
  );
  try {
    const candidateIndex = await fetchDatesIndexJson();
    const candidateDates = historyDatesUpTo(candidateIndex, targetRunDate);
    assertHistoricalIdentitiesAdvance(candidateIndex, candidateDates, revisionHighWater);
    selectedIndex = candidateIndex;
    indexedDates = candidateDates;
  } catch (err) {
    debugLog.warn(
      'productHistory',
      `dates index failed; using cached/current dates: ${String((err as Error)?.message ?? err)}`,
    );
  }
  const wantedDates = normalizeTimelineDates([
    ...indexedDates,
    ...(opts.existing?.run_dates ?? []),
    targetRunDate,
  ]);

  const keys = productKeysForCore(opts.currentCore);
  const sameDerivation = opts.existing?.derivation_version === HISTORY_DERIVATION_VERSION;
  const publications = selectedIndex ? await resolveLegacyPublications(selectedIndex, indexedDates.filter(d => d !== targetRunDate), opts.isCurrent) : new Map();
  const selectedIdentity = (date: string): string | undefined => selectedIndex?.revision_heads?.[date]
    ? historicalSourceIdentity(selectedIndex, date) : publications.get(date)?.identity;
  const reusableDates = new Set((opts.existing?.run_dates ?? []).filter(date => sameDerivation && !!opts.existing?.source_identities?.[date] &&
    (!selectedIndex || !indexedDates.includes(date) || (opts.existing?.schema_version === 3 && opts.existing.source_identities[date] === selectedIdentity(date)))));
  const sourceIdentities = Object.fromEntries([...reusableDates].map(date => [date, opts.existing!.source_identities![date]]));
  // Recent dates are useful to product charts immediately; older dates continue
  // warming in the same background task after progressive checkpoints land.
  const toFetch = wantedDates
    .filter((d) => d !== targetRunDate && !reusableDates.has(d) && indexedDates.includes(d) && !!selectedIdentity(d))
    .sort((a, b) => b.localeCompare(a));

  // Matching immutable core identity and date axis prove today's point and all
  // retained history are already exact. Avoid rebuilding thousands of
  // product/date cells merely to return and persist the same ledger.
  if (
    opts.existing &&
    !!selectedIndex &&
    opts.existing.schema_version === 3 &&
    sameDerivation &&
    !!opts.coreSha &&
    opts.existing.core_sha === opts.coreSha &&
    opts.existing.run_date === targetRunDate &&
    toFetch.length === 0 &&
    wantedDates.every(date => date === targetRunDate || reusableDates.has(date)) &&
    wantedDates.length === opts.existing.run_dates.length &&
    wantedDates.every((date, index) => date === opts.existing!.run_dates[index]) &&
    (opts.isCurrent?.() ?? true)
  ) {
    return opts.existing;
  }
  const bestByDate = new Map<string, Map<string, number>>([
    [targetRunDate, bestRatesForCore(opts.currentCore, keys)],
  ]);
  // The installed core may precede a newly selected revision for today. Its hash
  // remains authoritative; do not label it with an unacquired index head.
  if (opts.coreSha) sourceIdentities[targetRunDate] = `core:${opts.coreSha}`;

  debugLog.info(
    'productHistory',
    `sync start target=${targetRunDate} want=${wantedDates.length} fetch=${toFetch.length}`,
  );
  // #region agent log
  const _syncT0 = Date.now();
  debugLog.debug(
    'perf',
    `productHistory syncStart want=${wantedDates.length} fetch=${toFetch.length} existing=${opts.existing?.run_dates?.length ?? 0}`,
  );
  // #endregion

  const isCurrent = opts.isCurrent ?? (() => true);
  const checkpointEvery = Math.max(1, Math.floor(opts.checkpointEvery ?? 5));
  let fetchedOk = 0;
  let attempted = 0;
  let lastRunDate: string | null = null;
  let circuitOpen = false;
  let superseded = false;
  let terminalCheckpointPublished = false;

  const buildAvailable = (): ProductHistoryPayload => {
    // An empty authoritative map clears stale rates on failed/unselected dates,
    // while preserving those dates as explicit null gaps in every series.
    const availableRates = new Map(bestByDate);
    for (const date of wantedDates) if (!availableRates.has(date) && !reusableDates.has(date)) availableRates.set(date, new Map());
    const built = buildProductHistoryFromRates(
      availableRates,
      keys,
      wantedDates,
      targetRunDate,
      opts.existing,
      opts.coreSha,
    );
    built.source_identities = normalizeHistoryIdentities(sourceIdentities, wantedDates);
    built.date_status = historyDateStatuses(wantedDates, built.source_identities);
    built.revision_high_water = historicalRevisionHighWater(revisionHighWater, sourceIdentities);
    if (!Object.keys(built.products).length) {
      throw new Error('product history sync produced no series');
    }
    return built;
  };

  const publishCheckpoint = async (
    done: boolean,
  ): Promise<ProductHistoryPayload | null> => {
    if (!isCurrent()) {
      superseded = true;
      return null;
    }
    const built = buildAvailable();
    await opts.onCheckpoint?.(built, {
      successfulDates: fetchedOk,
      attemptedDates: attempted,
      totalMissingDates: toFetch.length,
      lastRunDate,
      done,
      circuitOpen,
    });
    return built;
  };

  if (toFetch.length) {
    const circuit = createDatedFetchCircuit(opts.circuitLimit ?? DATED_FETCH_CIRCUIT_LIMIT);
    for (let fetchIndex = 0; fetchIndex < toFetch.length; fetchIndex += 1) {
      const runDate = toFetch[fetchIndex];
      if (!isCurrent()) {
        superseded = true;
        break;
      }
      if (circuit.isOpen) break;
      attempted += 1;
      let datedRates: Map<string, number>;
      try {
        const datedCore = await downloadDatedCore(runDate, selectedIndex, publications.get(runDate));
        if (!isCurrent()) {
          superseded = true;
          break;
        }
        datedRates = bestRatesForCore(datedCore, productKeysForCore(datedCore));
      } catch (err) {
        circuit.failure();
        debugLog.warn(
          'productHistory',
          `dated core failed run_date=${runDate}: ${String((err as Error)?.message ?? err)}`,
        );
        if (circuit.isOpen) {
          circuitOpen = true;
          debugLog.warn(
            'productHistory',
            `dated fetch circuit open after ${opts.circuitLimit ?? DATED_FETCH_CIRCUIT_LIMIT} consecutive failures; skipping remaining`,
          );
          break;
        }
        continue;
      }
      bestByDate.set(runDate, datedRates);
      sourceIdentities[runDate] = selectedIdentity(runDate)!;
      circuit.success();
      fetchedOk += 1;
      lastRunDate = runDate;
      // Yield after every dated core so tab presses stay responsive during
      // the one-time ~60-day warm (production logs showed multi-minute JS stalls).
      await yieldToUi();
      if (fetchedOk % checkpointEvery === 0) {
        const isLastAttempt = fetchIndex === toFetch.length - 1;
        const published = await publishCheckpoint(isLastAttempt);
        terminalCheckpointPublished = !!published && isLastAttempt;
        if (superseded) break;
      }
      // #region agent log
      if (fetchedOk === 1 || fetchedOk % 10 === 0 || fetchedOk === toFetch.length) {
        debugLog.debug(
          'perf',
          `productHistory fetchProgress ok=${fetchedOk}/${toFetch.length} elapsedMs=${Date.now() - _syncT0} last=${runDate}`,
        );
      }
      // #endregion
    }
  }

  const built = buildAvailable();
  if (superseded) {
    debugLog.info(
      'productHistory',
      `sync superseded run_date=${targetRunDate} ok=${fetchedOk}/${toFetch.length}`,
    );
  } else if (!terminalCheckpointPublished) {
    await publishCheckpoint(true);
  }
  debugLog.info(
    'productHistory',
    `sync ok run_date=${built.run_date} slices=${built.run_dates.length} products=${Object.keys(built.products).length}`,
  );
  return built;
}
