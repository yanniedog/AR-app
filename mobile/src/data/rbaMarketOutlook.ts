import { isLocalAppHealthAudit } from '../lib/appHealthTransportGuard';
import { cache } from './cache';
import { ECONOMIC_RECHECK_MS, type CashRateForecast } from './economicOutlookTypes';
import {
  normalizeRbaMarketOutlook,
  parseRbaBondForwardsCsv,
  parseRbaEconomistsCsv,
} from './rbaMarketOutlookParse';
import type { RbaBondForwards, RbaMarketOutlook } from './rbaMarketOutlookTypes';

export type { RbaBondForwards, RbaMarketOutlook } from './rbaMarketOutlookTypes';
export { parseRbaBondForwardsCsv, parseRbaEconomistsCsv } from './rbaMarketOutlookParse';

export const RBA_F17_FORWARD_URL = 'https://www.rba.gov.au/statistics/tables/csv/f17-forward-rates.csv';
export const RBA_J1_FORECAST_URL = 'https://www.rba.gov.au/statistics/tables/csv/j1-cash-rate.csv';

let inFlight: { force: boolean; promise: Promise<RbaMarketOutlook> } | null = null;
let requestSequence = 0;
let latest: { sequence: number; payload: RbaMarketOutlook } | null = null;
let commitQueue: Promise<void> = Promise.resolve();
let generation = 0;
let clearing: Promise<void> | null = null;
const resetListeners = new Set<() => void>();

export function subscribeRbaMarketOutlookCacheReset(listener: () => void): () => void {
  resetListeners.add(listener);
  return () => { resetListeners.delete(listener); };
}

/** Invalidate old requests, drain existing writes, and hold new loads until storage is cleared. */
export function resetRbaMarketOutlookRuntimeCache(clearStorage: () => Promise<void>): Promise<void> {
  if (clearing) return clearing;
  generation += 1;
  latest = null;
  inFlight = null;
  const run = (async () => {
    await commitQueue;
    await clearStorage();
  })();
  const tracked = run.finally(() => { if (clearing === tracked) clearing = null; });
  clearing = tracked;
  for (const listener of resetListeners) listener();
  return tracked;
}

function assertCurrentGeneration(expected: number): void {
  if (expected !== generation) throw new Error('RBA market cache was cleared during this request.');
}

/** Test isolation only: clear pending state after all test requests have settled. */
export function resetRbaMarketOutlookRuntimeCacheForTests(): void {
  generation += 1;
  clearing = null;
  inFlight = null;
  requestSequence = 0;
  latest = null;
  commitQueue = Promise.resolve();
}

function freezePayload(payload: RbaMarketOutlook): RbaMarketOutlook {
  for (const series of [payload.bondForwards, payload.economists]) {
    if (!series) continue;
    series.points.forEach(Object.freeze);
    Object.freeze(series.points);
    Object.freeze(series);
  }
  return Object.freeze(payload);
}

function newer<T extends { publicationDate: string }>(
  incoming: T | null,
  previous: T | null,
  observation: (series: T) => string,
  preferIncoming: boolean,
): T | null {
  if (!incoming) return previous;
  if (!previous) return incoming;
  const order = observation(incoming).localeCompare(observation(previous))
    || incoming.publicationDate.localeCompare(previous.publicationDate);
  return order > 0 || (order === 0 && preferIncoming) ? incoming : previous;
}

const bondDate = (series: RbaBondForwards) => series.observationDate;
const surveyDate = (series: CashRateForecast) => series.surveyDate;

function mergeSources(incoming: RbaMarketOutlook, previous: RbaMarketOutlook, preferIncoming: boolean) {
  return {
    bondForwards: newer(incoming.bondForwards, previous.bondForwards, bondDate, preferIncoming),
    economists: newer(incoming.economists, previous.economists, surveyDate, preferIncoming),
  };
}

function mergeCached(stored: RbaMarketOutlook | null, memory: RbaMarketOutlook | null): RbaMarketOutlook | null {
  if (!memory) return stored;
  if (!stored) return memory;
  const storedIsNewer = stored.checkedAt > memory.checkedAt;
  return {
    ...(storedIsNewer ? stored : memory),
    ...mergeSources(stored, memory, storedIsNewer),
  };
}

async function readCached(expectedGeneration: number): Promise<RbaMarketOutlook | null> {
  // Validate stored public data before allowing an offline audit to rely on it.
  const stored = normalizeRbaMarketOutlook(await cache.readRbaMarketOutlook());
  assertCurrentGeneration(expectedGeneration);
  return mergeCached(stored, latest?.payload ?? null);
}

function offline(cached: RbaMarketOutlook | null): RbaMarketOutlook {
  if (!cached) throw new Error('RBA market context is not cached. Connect to load official data.');
  return freezePayload({ ...cached, refreshStatus: 'offline' });
}

async function fetchCsv(url: string): Promise<string> {
  if (isLocalAppHealthAudit()) throw new Error('Official RBA data is unavailable in this local audit');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, { headers: { Accept: 'text/csv' }, signal: controller.signal });
    if (!response.ok) throw new Error(`Official RBA data request failed (${response.status})`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function commit(
  sequence: number,
  expectedGeneration: number,
  incoming: RbaMarketOutlook,
  cached: RbaMarketOutlook | null,
): Promise<RbaMarketOutlook> {
  let accepted = incoming;
  const run = commitQueue.then(async () => {
    assertCurrentGeneration(expectedGeneration);
    const previous = mergeCached(cached, latest?.payload ?? null);
    const isNewerRequest = sequence >= (latest?.sequence ?? 0);
    const sources = previous ? mergeSources(incoming, previous, isNewerRequest) : incoming;
    if (!sources.bondForwards && !sources.economists) {
      throw new Error('Official RBA market context could not be loaded. Try again when connected.');
    }
    if (!isNewerRequest && previous
      && sources.bondForwards === previous.bondForwards && sources.economists === previous.economists) {
      accepted = previous;
      return;
    }
    const acceptedFresh = (incoming.bondForwards != null && sources.bondForwards === incoming.bondForwards)
      || (incoming.economists != null && sources.economists === incoming.economists);
    const bothFresh = incoming.bondForwards != null && sources.bondForwards === incoming.bondForwards
      && incoming.economists != null && sources.economists === incoming.economists;
    accepted = freezePayload({
      schema_version: 1,
      fetchedAt: acceptedFresh ? [incoming.fetchedAt, previous?.fetchedAt ?? ''].sort().at(-1)!
        : previous!.fetchedAt,
      checkedAt: [incoming.checkedAt, previous?.checkedAt ?? ''].sort().at(-1)!,
      refreshStatus: bothFresh ? 'current'
        : !incoming.bondForwards && !incoming.economists ? 'offline' : 'partial',
      bondForwards: sources.bondForwards,
      economists: sources.economists,
    });
    // A storage failure must not erase successfully fetched public information.
    try {
      await cache.writeRbaMarketOutlook(accepted);
    } catch { /* This session can still use the validated in-memory copy. */ }
    assertCurrentGeneration(expectedGeneration);
    latest = { sequence: Math.max(sequence, latest?.sequence ?? 0), payload: accepted };
  });
  commitQueue = run.catch(() => undefined);
  await run;
  return accepted;
}

/** Public RBA context only: no personal preferences or portfolio data leave the device. */
export async function loadRbaMarketOutlook(force = false): Promise<RbaMarketOutlook> {
  const localOnly = isLocalAppHealthAudit();
  if (clearing) await clearing;
  const expectedGeneration = generation;
  // Do not join a network refresh that began before a local audit installed its guard.
  if (localOnly || isLocalAppHealthAudit()) return offline(await readCached(expectedGeneration));
  if (inFlight && (!force || inFlight.force)) return inFlight.promise;
  const sequence = ++requestSequence;
  const run = (async () => {
    const cached = await readCached(expectedGeneration);
    if (isLocalAppHealthAudit()) return offline(cached);
    const age = cached ? Date.now() - Date.parse(cached.checkedAt) : Infinity;
    if (!force && cached?.refreshStatus === 'current' && age >= 0 && age < ECONOMIC_RECHECK_MS) return freezePayload(cached);
    const checkedAt = new Date().toISOString();
    const [bonds, economists] = await Promise.allSettled([
      fetchCsv(RBA_F17_FORWARD_URL).then((text) => parseRbaBondForwardsCsv(text)),
      fetchCsv(RBA_J1_FORECAST_URL).then((text) => parseRbaEconomistsCsv(text)),
    ]);
    return commit(sequence, expectedGeneration, {
      schema_version: 1,
      fetchedAt: checkedAt,
      checkedAt,
      refreshStatus: 'current',
      bondForwards: bonds.status === 'fulfilled' ? bonds.value : null,
      economists: economists.status === 'fulfilled' ? economists.value : null,
    }, cached);
  })();
  const tracked = run.finally(() => { if (inFlight?.promise === tracked) inFlight = null; });
  inFlight = { force, promise: tracked };
  return tracked;
}
