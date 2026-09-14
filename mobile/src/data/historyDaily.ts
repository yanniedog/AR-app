import { parseDatesIndex, type DatesIndex } from './datesIndex';
import { DATES_INDEX_URL, PAYLOAD_REPO, datedManifestUrl } from '../config';
import { assertRevisionManifest } from './payloadRevision';
import { debugLog } from '../lib/debugLog';
import { yieldToUi } from '../lib/yieldToUi';
import type { BankHistoryPoint, CorePayload, SectionKey } from '../types';
import { SECTION_KEYS } from '../types';
import { normalizeTimelineDates, sanitizeRibbonPoint } from './bankHistoryTransform';
import { normalizeHistoryBanksPayload, type HistoryBanksPayload } from './historyPayload';
import { downloadCore, fetchManifest } from './payload';
import { assertHistoricalIdentitiesAdvance, historicalRevisionHighWater, historicalSourceIdentity, normalizeHistoryIdentities } from './historyIdentity';
export { parseDatesIndex, type DatesIndex } from './datesIndex';

/** Earliest run_date published as an immutable dated GitHub release (app_payload.py). */
export const HISTORY_MIN_DATE = '2026-05-13';

export function historyDatesUpTo(index: DatesIndex, targetRunDate: string): string[] {
  const floor =
    index.min_date && index.min_date >= HISTORY_MIN_DATE ? index.min_date : HISTORY_MIN_DATE;
  const cap = String(targetRunDate || '').slice(0, 10);
  return index.dates.filter((d) => d >= floor && (!cap || d <= cap));
}

export function dailyHistorySha(runDates: string[]): string {
  return `daily:${runDates.join(',')}`;
}

export function historyBanksCoversDates(
  payload: HistoryBanksPayload | null | undefined,
  dates: string[],
): boolean {
  if (!payload?.run_dates?.length || !dates.length) return false;
  const have = new Set(payload.run_dates);
  return dates.every((d) => have.has(d));
}

function extractSectionPoint(core: CorePayload, section: SectionKey): BankHistoryPoint | null {
  const date = String(core.run_date || '').slice(0, 10);
  const sectionData = core.sections?.[section];
  if (!date || !sectionData?.ribbon?.range) return null;
  const range = sectionData.ribbon.range;
  const point = sanitizeRibbonPoint(date, {
    min: range.min,
    max: range.max,
    mean: range.mean,
    median: range.median,
    count: sectionData.ribbon.counts?.rates ?? 0,
  });
  if (point.min == null && point.max == null && point.mean == null) return null;
  return point;
}

/** Merge cached section points with freshly downloaded dated cores. */
export function mergeHistoryFromCores(
  existing: HistoryBanksPayload | null | undefined,
  coresByDate: Map<string, CorePayload>,
  orderedDates: string[],
  latestRunDate: string,
): HistoryBanksPayload | null {
  const run_dates = normalizeTimelineDates(orderedDates);
  if (!run_dates.length) return null;

  const sections: HistoryBanksPayload['sections'] = {};
  for (const section of SECTION_KEYS) {
    const byDate = new Map<string, BankHistoryPoint>();
    for (const point of existing?.sections?.[section]?.points ?? []) {
      const date = String(point.date || '').slice(0, 10);
      if (date) byDate.set(date, point);
    }
    for (const date of run_dates) {
      const core = coresByDate.get(date);
      if (!core) continue;
      const point = extractSectionPoint(core, section);
      if (point) byDate.set(date, point);
      else byDate.delete(date);
    }
    const points = run_dates.map((d) => byDate.get(d)).filter((p): p is BankHistoryPoint => !!p);
    if (points.length) sections[section] = { points };
  }
  if (!Object.keys(sections).length) return null;

  return normalizeHistoryBanksPayload({
    schema_version: 1,
    run_date: latestRunDate,
    run_dates,
    sections,
  });
}

export async function fetchDatesIndexJson(url: string = DATES_INDEX_URL): Promise<DatesIndex> {
  const sep = url.includes('?') ? '&' : '?';
  const res = await fetch(`${url}${sep}_=${Date.now()}`);
  if (!res.ok) throw new Error(`dates-index HTTP ${res.status}`);
  const parsed = parseDatesIndex(await res.json());
  if (!parsed) throw new Error('dates-index payload invalid');
  return parsed;
}

export async function downloadDatedCore(runDate: string, index?: DatesIndex): Promise<CorePayload> {
  const selected = index ?? await fetchDatesIndexJson();
  const head = selected.revision_heads?.[runDate];
  const manifest = head
    ? await fetchManifest(head.manifest_url, undefined, head.manifest_sha256)
    : await fetchManifest(datedManifestUrl(runDate));
  if (head) assertRevisionManifest(manifest, head, runDate, PAYLOAD_REPO);
  const { core } = await downloadCore(
    manifest.files.core.url,
    manifest.files.core.sha256,
    { fileName: manifest.files.core.name, expectedBytes: manifest.files.core.bytes,
      ...(head ? { requireExactBytes: true, maxCompressedBytes: 64 * 1024 * 1024,
        maxInflatedBytes: 192 * 1024 * 1024 } : {}) },
  );
  if (core.run_date !== runDate) throw new Error('Dated core publication date mismatch');
  return core;
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Stop dated-core fan-out after a streak of failures (network dead / GH outage). */
export const DATED_FETCH_CIRCUIT_LIMIT = 4;

export type DatedFetchCircuit = {
  readonly isOpen: boolean;
  success: () => void;
  failure: () => void;
};

export function createDatedFetchCircuit(
  maxConsecutiveFailures: number = DATED_FETCH_CIRCUIT_LIMIT,
): DatedFetchCircuit {
  let consecutive = 0;
  let open = false;
  return {
    get isOpen() {
      return open;
    },
    success() {
      consecutive = 0;
    },
    failure() {
      consecutive += 1;
      if (consecutive >= maxConsecutiveFailures) open = true;
    },
  };
}

export interface SyncHistoryDailyOpts {
  targetRunDate: string;
  currentCore: CorePayload;
  existing?: HistoryBanksPayload | null;
  cachedDates?: Set<string>;
  coreSha?: string;
  maxConcurrent?: number;
}

/**
 * Incrementally download immutable dated core payloads and aggregate section ribbon
 * stats into a chart-ready ``HistoryBanksPayload``.
 */
export async function syncHistoryFromDailyPayloads(
  opts: SyncHistoryDailyOpts,
): Promise<HistoryBanksPayload> {
  const targetRunDate = String(opts.targetRunDate || '').slice(0, 10);
  if (!targetRunDate) throw new Error('syncHistoryFromDailyPayloads: missing targetRunDate');

  const index = await fetchDatesIndexJson();
  const wantedDates = historyDatesUpTo(index, targetRunDate);
  const revisionHighWater = historicalRevisionHighWater(
    opts.existing?.revision_high_water, opts.existing?.source_identities,
  );
  assertHistoricalIdentitiesAdvance(index, wantedDates, revisionHighWater);
  if (!wantedDates.length) throw new Error('dates-index has no history dates');

  const coresByDate = new Map<string, CorePayload>();
  coresByDate.set(targetRunDate, opts.currentCore);

  const sourceIdentities = { ...opts.existing?.source_identities };
  const skip = new Set((opts.existing?.run_dates ?? []).filter((date) =>
    sourceIdentities[date] === historicalSourceIdentity(index, date),
  ));
  const toFetch = wantedDates.filter((d) => d !== targetRunDate && !skip.has(d));

  debugLog.info(
    'historyDaily',
    `sync start target=${targetRunDate} want=${wantedDates.length} fetch=${toFetch.length}`,
  );

  if (toFetch.length) {
    const circuit = createDatedFetchCircuit();
    let next = 0;
    const workers = Array.from(
      { length: Math.min(opts.maxConcurrent ?? 3, toFetch.length) },
      async () => {
        while (next < toFetch.length) {
          if (circuit.isOpen) return;
          const runDate = toFetch[next];
          next += 1;
          try {
            const core = await downloadDatedCore(runDate, index);
            coresByDate.set(runDate, core);
            sourceIdentities[runDate] = historicalSourceIdentity(index, runDate);
            circuit.success();
            await yieldToUi();
          } catch (err) {
            circuit.failure();
            debugLog.warn(
              'historyDaily',
              `dated core failed run_date=${runDate}: ${String((err as Error)?.message ?? err)}`,
            );
            if (circuit.isOpen) {
              debugLog.warn(
                'historyDaily',
                `dated fetch circuit open after ${DATED_FETCH_CIRCUIT_LIMIT} consecutive failures; skipping ${toFetch.length - next} remaining`,
              );
              return;
            }
          }
        }
      },
    );
    await Promise.all(workers);
  }

  const cachedPointDates = new Set<string>();
  for (const section of SECTION_KEYS) {
    for (const point of opts.existing?.sections?.[section]?.points ?? []) {
      const date = String(point.date || '').slice(0, 10);
      if (date && skip.has(date)) cachedPointDates.add(date);
    }
  }
  const availableDates = wantedDates.filter(
    (d) => coresByDate.has(d) || cachedPointDates.has(d),
  );
  const built = mergeHistoryFromCores(opts.existing, coresByDate, availableDates, targetRunDate);
  if (!built || built.run_dates.length < 1) {
    throw new Error('daily history sync produced no section points');
  }
  sourceIdentities[targetRunDate] = `core:${opts.coreSha ?? ''}`;
  built.source_identities = normalizeHistoryIdentities(sourceIdentities, availableDates);
  built.revision_high_water = historicalRevisionHighWater(revisionHighWater, sourceIdentities);
  debugLog.info(
    'historyDaily',
    `sync ok run_date=${built.run_date} slices=${built.run_dates.length}`,
  );
  return built;
}
