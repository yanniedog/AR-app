import { SECTIONS } from '../constants';
import { debugLog } from '../lib/debugLog';
import type { CorePayload, SectionKey } from '../types';
import { SECTION_KEYS } from '../types';
import { normalizeTimelineDates } from './bankHistoryTransform';
import { toFraction } from './format';
import { yieldToUi } from '../lib/yieldToUi';
import {
  createDatedFetchCircuit,
  DATED_FETCH_CIRCUIT_LIMIT,
  downloadDatedCore,
  fetchDatesIndexJson,
  historyDatesUpTo,
} from './historyDaily';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Compact per-product rate history, derived on-device from the immutable dated `core`
 * payloads. Each product's representative (section-best) rate is stored per run_date,
 * aligned to `run_dates`; missing days are `null`. Restricted to the current catalog
 * (keys present in the latest core) to bound size.
 */
export interface ProductHistoryPayload {
  schema_version: number;
  run_date: string;
  /** SHA of the rolling core used for the current catalog and latest rates. */
  core_sha?: string;
  run_dates: string[];
  products: Record<string, (number | null)[]>;
}

function productKeysForCore(core: CorePayload): Set<string> {
  const keys = new Set<string>();
  for (const section of SECTION_KEYS) {
    for (const row of core.sections?.[section]?.rates ?? []) {
      if (row.product_key) keys.add(row.product_key);
    }
  }
  return keys;
}

/** Best (section-aware) rate per product_key for one core; current-catalog keys only. */
function bestRatesForCore(core: CorePayload, keys: Set<string>): Map<string, number> {
  const best = new Map<string, number>();
  for (const section of SECTION_KEYS) {
    const lowerIsBetter = SECTIONS[section].lowerIsBetter;
    for (const row of core.sections?.[section]?.rates ?? []) {
      const key = row.product_key;
      if (!key || !keys.has(key)) continue;
      const rate = toFraction(row.rate);
      if (rate == null || rate <= 0) continue;
      const prev = best.get(key);
      if (prev == null) best.set(key, rate);
      else best.set(key, lowerIsBetter ? Math.min(prev, rate) : Math.max(prev, rate));
    }
  }
  return best;
}

/**
 * Build a `ProductHistoryPayload` from dated cores. Dates without a downloaded core fall
 * back to `existing` (so an incremental sync only needs to fetch new days).
 */
export function buildProductHistoryFromCores(
  coresByDate: Map<string, CorePayload>,
  orderedDates: string[],
  latestRunDate: string,
  existing?: ProductHistoryPayload | null,
  coreSha = '',
): ProductHistoryPayload {
  const run_dates = normalizeTimelineDates(orderedDates);
  const target = String(latestRunDate || '').slice(0, 10);
  const latestCore = coresByDate.get(target) ?? coresByDate.get(run_dates.at(-1) ?? '');

  // Current catalog = the keys a product page can actually open today.
  const keys = latestCore ? productKeysForCore(latestCore) : new Set<string>();
  const bestByDate = new Map<string, Map<string, number>>();
  for (const date of run_dates) {
    const core = coresByDate.get(date);
    if (core) bestByDate.set(date, bestRatesForCore(core, keys));
  }
  return buildProductHistoryFromRates(bestByDate, keys, run_dates, target, existing, coreSha);
}

function buildProductHistoryFromRates(
  bestByDate: Map<string, Map<string, number>>,
  keys: Set<string>,
  orderedDates: string[],
  target: string,
  existing?: ProductHistoryPayload | null,
  coreSha = '',
): ProductHistoryPayload {
  const run_dates = normalizeTimelineDates(orderedDates);
  // Reuse already-computed rates for days we didn't re-download.
  const existingByKey = new Map<string, Map<string, number | null>>();
  if (existing) {
    for (const [key, arr] of Object.entries(existing.products)) {
      const m = new Map<string, number | null>();
      existing.run_dates.forEach((d, i) => m.set(d, arr[i] ?? null));
      existingByKey.set(key, m);
    }
  }

  const products: Record<string, (number | null)[]> = {};
  for (const key of keys) {
    const series = run_dates.map((d) => {
      const fromCore = bestByDate.get(d)?.get(key);
      if (fromCore != null) return fromCore;
      const fromExisting = existingByKey.get(key)?.get(d);
      return fromExisting != null ? fromExisting : null;
    });
    if (series.some((v) => v != null)) products[key] = series;
  }

  // Keep series for products temporarily absent from today's catalog so a later
  // reappearance can reuse cached rates without re-downloading dated cores.
  for (const [key, byDate] of existingByKey) {
    if (products[key]) continue;
    const series = run_dates.map((d) => {
      const fromExisting = byDate.get(d);
      return fromExisting != null ? fromExisting : null;
    });
    if (series.some((v) => v != null)) products[key] = series;
  }

  return {
    schema_version: 2,
    run_date: target,
    ...(coreSha ? { core_sha: coreSha } : {}),
    run_dates,
    products,
  };
}

/** A product's series aligned to an arbitrary `dates` axis (e.g. the chart's sliced dates). */
export function extractProductSeries(
  payload: ProductHistoryPayload | null | undefined,
  productKey: string,
  dates: string[],
): (number | null)[] {
  const series = payload?.products?.[productKey];
  if (!payload || !series) return dates.map(() => null);
  const byDate = new Map<string, number | null>();
  payload.run_dates.forEach((d, i) => byDate.set(d, series[i] ?? null));
  return dates.map((d) => byDate.get(d) ?? null);
}

/** Date→value record for `BankHistoryChart`'s `highlightSeries.values`. */
export function productSeriesRecord(
  payload: ProductHistoryPayload | null | undefined,
  productKey: string,
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  const series = payload?.products?.[productKey];
  if (!payload || !series) return out;
  payload.run_dates.forEach((d, i) => {
    out[d] = series[i] ?? null;
  });
  return out;
}

/**
 * Chart highlight values with today's rate seeded when daily history has not yet
 * landed a point for `runDate`. Keeps the product line visible while
 * `syncProductHistoryFromDailyPayloads` warms dated cores.
 */
export function productSeriesRecordWithCurrent(
  payload: ProductHistoryPayload | null | undefined,
  productKey: string,
  runDate: string | undefined,
  currentRate: number | null | undefined,
): Record<string, number | null> {
  const out = productSeriesRecord(payload, productKey);
  const date = String(runDate || '').slice(0, 10);
  if (
    date &&
    typeof currentRate === 'number' &&
    Number.isFinite(currentRate) &&
    currentRate > 0 &&
    out[date] == null
  ) {
    out[date] = currentRate;
  }
  return out;
}

export function hasProductSeries(
  payload: ProductHistoryPayload | null | undefined,
  productKey: string,
): boolean {
  const series = payload?.products?.[productKey];
  return !!series && series.some((v) => v != null);
}

/** Count finite observations in a date→value record (for chart empty-state copy). */
export function countFiniteSeriesPoints(values: Record<string, number | null> | null | undefined): number {
  if (!values) return 0;
  let n = 0;
  for (const v of Object.values(values)) {
    if (typeof v === 'number' && Number.isFinite(v)) n += 1;
  }
  return n;
}

/**
 * Carry the last known rate forward across null gaps so a product highlight
 * renders as a continuous step line while daily history is still warming.
 * Does not invent history before the first observation.
 */
export function forwardFillSeriesRecord(
  values: Record<string, number | null>,
  orderedDates: string[],
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  let last: number | null = null;
  for (const date of orderedDates) {
    const raw = values[date];
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
      last = raw;
      out[date] = raw;
    } else if (last != null) {
      out[date] = last;
    } else {
      out[date] = raw ?? null;
    }
  }
  return out;
}

/**
 * Chart-ready product highlight: seed today's rate if needed, then forward-fill
 * across the chart's date axis so sparse daily history still reads as a line.
 */
export function productSeriesRecordForChart(
  payload: ProductHistoryPayload | null | undefined,
  productKey: string,
  chartDates: string[],
  runDate: string | undefined,
  currentRate: number | null | undefined,
): Record<string, number | null> {
  const seeded = productSeriesRecordWithCurrent(payload, productKey, runDate, currentRate);
  if (!chartDates.length) return seeded;
  return forwardFillSeriesRecord(seeded, chartDates);
}

export interface ProductRateMove {
  productKey: string;
  productName: string;
  rateIndex: number | null;
  date: string;
  fromRate: number;
  toRate: number;
  /** Signed basis-point change (to − from). */
  bps: number;
}

function lastFiniteBefore(series: (number | null)[], beforeIndex: number): number | null {
  for (let i = beforeIndex - 1; i >= 0; i -= 1) {
    const v = series[i];
    if (v != null && Number.isFinite(v)) return v;
  }
  return null;
}

/**
 * Reconstruct which products drove a provider rate-move event by diffing the
 * on-device product-history ledger (same ≥5 bps rule the Pi uses for events).
 */
export function productMovesForBankEvent(
  core: CorePayload | null | undefined,
  history: ProductHistoryPayload | null | undefined,
  opts: {
    provider: string;
    section: SectionKey;
    date: string;
    thresholdBps?: number;
  },
): ProductRateMove[] {
  if (!core || !history?.run_dates?.length) return [];
  const date = String(opts.date || '').slice(0, 10);
  if (!date) return [];
  const thresholdBps = opts.thresholdBps ?? 5;
  const dateIndex = history.run_dates.indexOf(date);
  if (dateIndex < 0) return [];

  const catalog = new Map<string, { productName: string; rateIndex: number | null }>();
  for (const row of core.sections?.[opts.section]?.rates ?? []) {
    if (row.provider !== opts.provider || !row.product_key) continue;
    if (catalog.has(row.product_key)) continue;
    catalog.set(row.product_key, {
      productName: row.product_name || row.product_key,
      rateIndex: typeof row.rate_index === 'number' ? row.rate_index : null,
    });
  }

  const moves: ProductRateMove[] = [];
  for (const [productKey, meta] of catalog) {
    const series = history.products[productKey];
    if (!series) continue;
    const toRate = series[dateIndex];
    if (toRate == null || !Number.isFinite(toRate)) continue;
    const fromRate = lastFiniteBefore(series, dateIndex);
    if (fromRate == null) continue;
    // Compare in rounded bps space — fraction subtraction can land just under
    // 0.0005 for a true 5 bps move (e.g. 0.0600 − 0.0595 → 0.0004999…).
    const bps = Math.round((toRate - fromRate) * 10000 * 10) / 10;
    if (Math.abs(bps) < thresholdBps) continue;
    moves.push({
      productKey,
      productName: meta.productName,
      rateIndex: meta.rateIndex,
      date,
      fromRate,
      toRate,
      bps,
    });
  }
  moves.sort((a, b) => Math.abs(b.bps) - Math.abs(a.bps) || a.productName.localeCompare(b.productName));
  return moves;
}

/** Validate a cached/parsed payload before it reaches chart code. */
export function normalizeProductHistoryPayload(raw: unknown): ProductHistoryPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const run_date = typeof obj.run_date === 'string' ? obj.run_date.slice(0, 10) : '';
  if (!run_date) return null;
  const run_dates = Array.isArray(obj.run_dates) ? obj.run_dates.map((d) => String(d).slice(0, 10)) : [];
  // Strict: every date valid so `products` arrays stay index-aligned to `run_dates`.
  if (!run_dates.length || !run_dates.every((d) => YMD.test(d))) return null;
  const productsRaw = obj.products;
  if (!productsRaw || typeof productsRaw !== 'object') return null;

  const products: Record<string, (number | null)[]> = {};
  for (const [key, value] of Object.entries(productsRaw as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    const aligned = run_dates.map((_, i) => {
      const n = Number(value[i]);
      return Number.isFinite(n) && n > 0 ? n : null;
    });
    if (aligned.some((v) => v != null)) products[key] = aligned;
  }
  if (!Object.keys(products).length) return null;

  return {
    schema_version: typeof obj.schema_version === 'number' ? obj.schema_version : 1,
    run_date,
    ...(typeof obj.core_sha === 'string' && obj.core_sha ? { core_sha: obj.core_sha } : {}),
    run_dates,
    products,
  };
}

export interface SyncProductHistoryOpts {
  targetRunDate: string;
  currentCore: CorePayload;
  coreSha?: string;
  existing?: ProductHistoryPayload | null;
  maxConcurrent?: number;
  /** Override circuit trip threshold (tests). */
  circuitLimit?: number;
}

/**
 * Incrementally download the dated cores missing from `existing` and (re)build the
 * per-product history. The current day is always recomputed from `currentCore`.
 *
 * Catalog growth/shrink does **not** invalidate already-fetched dates — new products
 * keep `null` for historical days until those dates are missing from cache for another
 * reason. Re-fetching ~60 full cores on every product add/remove was a multi-minute
 * JS/network stall in production logs.
 */
export async function syncProductHistoryFromDailyPayloads(
  opts: SyncProductHistoryOpts,
): Promise<ProductHistoryPayload> {
  const targetRunDate = String(opts.targetRunDate || '').slice(0, 10);
  if (!targetRunDate) throw new Error('syncProductHistoryFromDailyPayloads: missing targetRunDate');

  let indexedDates: string[] = [];
  try {
    indexedDates = historyDatesUpTo(await fetchDatesIndexJson(), targetRunDate);
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
  // Reuse every date already present in the cached payload. Catalog churn must not
  // force a full historical re-download (see sync start fetch= count in debug logs).
  const reusableDates = new Set(opts.existing?.run_dates ?? []);
  const toFetch = wantedDates.filter((d) => d !== targetRunDate && !reusableDates.has(d));
  const bestByDate = new Map<string, Map<string, number>>([
    [targetRunDate, bestRatesForCore(opts.currentCore, keys)],
  ]);

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

  if (toFetch.length) {
    const circuit = createDatedFetchCircuit(opts.circuitLimit ?? DATED_FETCH_CIRCUIT_LIMIT);
    let next = 0;
    let fetchedOk = 0;
    const workers = Array.from(
      { length: Math.min(opts.maxConcurrent ?? 2, toFetch.length) },
      async () => {
        while (next < toFetch.length) {
          if (circuit.isOpen) return;
          const runDate = toFetch[next];
          next += 1;
          try {
            const core = await downloadDatedCore(runDate);
            bestByDate.set(runDate, bestRatesForCore(core, keys));
            circuit.success();
            fetchedOk += 1;
            // Yield after every dated core so tab presses stay responsive during
            // the one-time ~60-day warm (production logs showed multi-minute JS stalls).
            await yieldToUi();
            // #region agent log
            if (fetchedOk === 1 || fetchedOk % 10 === 0 || fetchedOk === toFetch.length) {
              debugLog.debug(
                'perf',
                `productHistory fetchProgress ok=${fetchedOk}/${toFetch.length} elapsedMs=${Date.now() - _syncT0} last=${runDate}`,
              );
            }
            // #endregion
          } catch (err) {
            circuit.failure();
            debugLog.warn(
              'productHistory',
              `dated core failed run_date=${runDate}: ${String((err as Error)?.message ?? err)}`,
            );
            if (circuit.isOpen) {
              debugLog.warn(
                'productHistory',
                `dated fetch circuit open after ${opts.circuitLimit ?? DATED_FETCH_CIRCUIT_LIMIT} consecutive failures; skipping remaining`,
              );
              return;
            }
          }
        }
      },
    );
    await Promise.all(workers);
  }

  const availableDates = wantedDates.filter((d) => bestByDate.has(d) || reusableDates.has(d));
  const built = buildProductHistoryFromRates(
    bestByDate,
    keys,
    availableDates,
    targetRunDate,
    opts.existing,
    opts.coreSha,
  );
  if (!Object.keys(built.products).length) {
    throw new Error('product history sync produced no series');
  }
  debugLog.info(
    'productHistory',
    `sync ok run_date=${built.run_date} slices=${built.run_dates.length} products=${Object.keys(built.products).length}`,
  );
  return built;
}
