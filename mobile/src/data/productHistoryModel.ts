import { HISTORY_DERIVATION_VERSION, historyDateStatuses, type HistoryDateStatus } from './historyDerivation';
import { SECTIONS } from '../constants';
import type { CorePayload, RateRow, SectionKey } from '../types';
import { SECTION_KEYS } from '../types';
import { normalizeTimelineDates } from './bankHistoryTransform';
import { toFraction } from './format';
import { historicalRevisionHighWater, normalizeHistoryIdentities } from './historyIdentity';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Compact per-product rate history, derived on-device from the immutable dated `core`
 * payloads. Each product's representative (section-best) rate is stored per run_date,
 * aligned to `run_dates`; missing days are `null`. Every downloaded catalogue is
 * retained so previously absent products do not acquire artificial history gaps.
 */
export interface ProductHistoryPayload {
  schema_version: number;
  derivation_version?: string;
  date_status?: Record<string, HistoryDateStatus>;
  run_date: string;
  /** SHA of the rolling core used for the current catalog and latest rates. */
  core_sha?: string;
  /** Selected publication identity for each verified date. */
  source_identities?: Record<string, string>;
  /** Verified rollback barriers; independent of available chart dates and values. */
  revision_high_water?: Record<string, string>;
  run_dates: string[];
  products: Record<string, (number | null)[]>;
}

export type ProductHistoryPurpose = 'history_ribbon' | 'bank_move';

export type ProductBestRateSummary =
  | {
      kind: 'changed';
      trackedSince: string;
      observations: number;
      observedOn: string;
      fromRate: number;
      toRate: number;
      /** Signed basis-point change (to - from). */
      bps: number;
    }
  | {
      kind: 'tracking';
      trackedSince: string;
      observations: number;
    }
  | {
      kind: 'unchanged';
      trackedSince: string;
      observations: number;
    };

export interface CurrentProductBestRate {
  date: string | null | undefined;
  rate: number | null | undefined;
}

function validObservedRate(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * Summarise a product's representative best-rate series.
 *
 * Null gaps are ignored: a dated snapshot proves when the new value was first
 * observed, not the lender's exact effective date. `current` is authoritative
 * for its date so an in-memory ledger retained across a same-day refresh cannot
 * report stale movement beside the newly installed core rate.
 */
export function summarizeProductBestRateSeries(
  runDates: readonly string[] | null | undefined,
  series: readonly (number | null)[] | null | undefined,
  current?: CurrentProductBestRate,
): ProductBestRateSummary | null {
  if (!runDates?.length || !series?.length) return null;

  const observations: { date: string; rate: number }[] = [];
  runDates.forEach((rawDate, index) => {
    const date = String(rawDate || '').slice(0, 10);
    const rate = series[index];
    if (YMD.test(date) && validObservedRate(rate)) observations.push({ date, rate });
  });

  const currentDate = String(current?.date || '').slice(0, 10);
  if (YMD.test(currentDate) && validObservedRate(current?.rate)) {
    const existingIndex = observations.findIndex((item) => item.date === currentDate);
    const currentObservation = { date: currentDate, rate: current.rate };
    if (existingIndex < 0) observations.push(currentObservation);
    else observations[existingIndex] = currentObservation;
  }

  observations.sort((left, right) => left.date.localeCompare(right.date));
  if (!observations.length) return null;

  let latestChange:
    | {
        observedOn: string;
        fromRate: number;
        toRate: number;
        bps: number;
      }
    | null = null;
  for (let index = 1; index < observations.length; index += 1) {
    const fromRate = observations[index - 1].rate;
    const toRate = observations[index].rate;
    const bps = Math.round((toRate - fromRate) * 10000 * 10) / 10;
    if (bps === 0) continue;
    latestChange = {
      observedOn: observations[index].date,
      fromRate,
      toRate,
      bps,
    };
  }

  const base = {
    trackedSince: observations[0].date,
    observations: observations.length,
  };
  if (latestChange) return { kind: 'changed', ...base, ...latestChange };
  return {
    kind: observations.length === 1 ? 'tracking' : 'unchanged',
    ...base,
  };
}

export function summarizeProductBestRate(
  payload: ProductHistoryPayload | null | undefined,
  productKey: string,
  current?: CurrentProductBestRate,
): ProductBestRateSummary | null {
  return summarizeProductBestRateSeries(
    payload?.run_dates,
    payload?.products?.[productKey],
    current,
  );
}

export function productKeysForCore(core: CorePayload): Set<string> {
  const keys = new Set<string>();
  for (const section of SECTION_KEYS) {
    for (const row of core.sections?.[section]?.rates ?? []) {
      if (row.product_key) keys.add(row.product_key);
    }
  }
  return keys;
}

/** Best (section-aware) rate per product_key for one core; current-catalog keys only. */
export function bestRatesForCore(core: CorePayload, keys: Set<string>): Map<string, number> {
  const best = new Map<string, number>();
  for (const section of SECTION_KEYS) {
    const lowerIsBetter = SECTIONS[section].lowerIsBetter;
    for (const row of core.sections?.[section]?.rates ?? []) {
      const key = row.product_key;
      if (!key || !keys.has(key)) continue;
      const rate = toFraction(row.rate);
      if (rate == null || rate < 0) continue;
      const prev = best.get(key);
      if (prev == null) best.set(key, rate);
      else best.set(key, lowerIsBetter ? Math.min(prev, rate) : Math.max(prev, rate));
    }
  }
  return best;
}

const currentBestRatesCache = new WeakMap<CorePayload, Map<string, number>>();

/**
 * Current section-aware best rate for a product. The complete core index is
 * memoized by object identity so many visible product cards share one scan.
 */
export function bestRateForProduct(
  core: CorePayload | null | undefined,
  productKey: string,
): number | null {
  if (!core || !productKey) return null;
  let best = currentBestRatesCache.get(core);
  if (!best) {
    const keys = productKeysForCore(core);
    best = bestRatesForCore(core, keys);
    currentBestRatesCache.set(core, best);
  }
  return best.get(productKey) ?? null;
}

/**
 * Whether a selected current row is represented by the product-key history
 * ledger. The ledger stores only each product's section-best headline rate, so
 * a base row beside a higher bonus or a comparison-selected mortgage row must
 * not be attributed changes from that collapsed series.
 */
export function productHistoryRepresentsRateRow(
  core: CorePayload | null | undefined,
  row: RateRow,
): boolean {
  const selectedRate = toFraction(row.rate);
  const historyRate = bestRateForProduct(core, row.product_key);
  return (
    selectedRate != null &&
    historyRate != null &&
    Math.abs(selectedRate - historyRate) <= 1e-9
  );
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

  const keys = latestCore ? productKeysForCore(latestCore) : new Set<string>();
  for (const core of coresByDate.values()) {
    for (const key of productKeysForCore(core)) keys.add(key);
  }
  const bestByDate = new Map<string, Map<string, number>>();
  for (const date of run_dates) {
    const core = coresByDate.get(date);
    if (core) bestByDate.set(date, bestRatesForCore(core, keys));
  }
  return buildProductHistoryFromRates(bestByDate, keys, run_dates, target, existing, coreSha);
}

export function buildProductHistoryFromRates(
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
  const allKeys = new Set([...keys, ...existingByKey.keys()]);
  for (const rates of bestByDate.values()) {
    for (const key of rates.keys()) allKeys.add(key);
  }
  for (const key of allKeys) {
    const series = run_dates.map((d) => {
      // A corrected snapshot is authoritative even when a former row is absent.
      if (bestByDate.has(d)) return bestByDate.get(d)!.get(key) ?? null;
      const fromExisting = existingByKey.get(key)?.get(d);
      return fromExisting != null ? fromExisting : null;
    });
    if (series.some((v) => v != null)) products[key] = series;
  }

  return {
    schema_version: 3,
    derivation_version: HISTORY_DERIVATION_VERSION,
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
    currentRate >= 0 &&
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
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
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
 * Chart-ready product highlight. Unknown observations remain gaps; carrying an
 * old value forward would make incomplete collection look like an observed rate.
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
  return Object.fromEntries(chartDates.map((date) => [date, seeded[date] ?? null]));
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


/**
 * Reconstruct which products drove a provider rate-move event by diffing the
 * on-device product-history ledger (same ≥5 bps rule the Pi uses for events).
 *
 * Prefer {@link productMovesForCatalog} when the caller already has the lender's
 * product list — scanning the full section rates array on every bank open is
 * needless work on large cores.
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
  const catalog: ProductMoveCatalogEntry[] = [];
  const seen = new Set<string>();
  for (const row of core.sections?.[opts.section]?.rates ?? []) {
    if (row.provider !== opts.provider || !row.product_key || seen.has(row.product_key)) continue;
    seen.add(row.product_key);
    catalog.push({
      productKey: row.product_key,
      productName: (row.product_name && row.product_name.trim()) || row.product_key,
      rateIndex: typeof row.rate_index === 'number' ? row.rate_index : null,
    });
  }
  return productMovesForCatalog(history, catalog, {
    date: opts.date,
    thresholdBps: opts.thresholdBps,
  });
}

export interface ProductMoveCatalogEntry {
  productKey: string;
  productName: string;
  rateIndex: number | null;
}

export interface ProductMoveBreakdown {
  /** Catalog products with a finite rate on the event date and an adjacent selected-date observation. */
  matched: number;
  moves: ProductRateMove[];
}

/**
 * Diff a known product catalog against product history for one event date,
 * retaining the matched denominator used by an "X of Y products" claim.
 */
export function productMoveBreakdownForCatalog(
  history: ProductHistoryPayload | null | undefined,
  catalog: readonly ProductMoveCatalogEntry[],
  opts: { date: string; thresholdBps?: number },
): ProductMoveBreakdown {
  if (!history?.run_dates?.length || !catalog.length) return { matched: 0, moves: [] };
  const date = String(opts.date || '').slice(0, 10);
  if (!date) return { matched: 0, moves: [] };
  const thresholdBps = opts.thresholdBps ?? 5;
  const dateIndex = history.run_dates.indexOf(date);
  if (dateIndex < 0) return { matched: 0, moves: [] };

  const moves: ProductRateMove[] = [];
  let matched = 0;
  for (const meta of catalog) {
    const series = history.products[meta.productKey];
    if (!series) continue;
    const toRate = series[dateIndex];
    if (toRate == null || !Number.isFinite(toRate) || toRate < 0) continue;
    const fromRate = dateIndex > 0 ? series[dateIndex - 1] : null;
    if (history.date_status?.[date] === 'unavailable' || history.date_status?.[history.run_dates[dateIndex - 1]] === 'unavailable') continue;
    if (fromRate == null || !Number.isFinite(fromRate) || fromRate < 0) continue;
    matched += 1;
    // Compare in rounded bps space — fraction subtraction can land just under
    // 0.0005 for a true 5 bps move (e.g. 0.0600 − 0.0595 → 0.0004999…).
    const bps = Math.round((toRate - fromRate) * 10000 * 10) / 10;
    if (Math.abs(bps) < thresholdBps) continue;
    moves.push({
      productKey: meta.productKey,
      productName: meta.productName,
      rateIndex: meta.rateIndex,
      date,
      fromRate,
      toRate,
      bps,
    });
  }
  moves.sort((a, b) => Math.abs(b.bps) - Math.abs(a.bps) || a.productName.localeCompare(b.productName));
  return { matched, moves };
}

/** Diff a known product catalog against product history for one event date. */
export function productMovesForCatalog(
  history: ProductHistoryPayload | null | undefined,
  catalog: readonly ProductMoveCatalogEntry[],
  opts: { date: string; thresholdBps?: number },
): ProductRateMove[] {
  return productMoveBreakdownForCatalog(history, catalog, opts).moves;
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
      const raw = value[i];
      if (raw == null || raw === '' || typeof raw === 'boolean') return null;
      const n = Number(raw);
      return Number.isFinite(n) && n >= 0 ? n : null;
    });
    if (aligned.some((v) => v != null)) products[key] = aligned;
  }
  if (!Object.keys(products).length) return null;

  const revisionHighWater = historicalRevisionHighWater(obj.revision_high_water, obj.source_identities);

  return {
    schema_version: typeof obj.schema_version === 'number' ? obj.schema_version : 1,
    run_date,
    ...(typeof obj.derivation_version === 'string' ? { derivation_version: obj.derivation_version } : {}),
    ...(obj.date_status ? { date_status: historyDateStatuses(run_dates, normalizeHistoryIdentities(obj.source_identities, run_dates)) } : {}),
    ...(typeof obj.core_sha === 'string' && obj.core_sha ? { core_sha: obj.core_sha } : {}),
    ...(obj.source_identities ? { source_identities: normalizeHistoryIdentities(obj.source_identities, run_dates) } : {}),
    ...(Object.keys(revisionHighWater).length ? { revision_high_water: revisionHighWater } : {}),
    run_dates,
    products,
  };
}

