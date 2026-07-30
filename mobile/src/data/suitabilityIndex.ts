import type { CorePayload, DetailsPayload, RateRow } from '../types';
import { SECTION_ORDER } from '../constants';
import { isBroadlyAvailable } from './format';
import { setSuitabilityAllowed } from './suitabilityGate';
import { yieldToUi } from '../lib/yieldToUi';
import { debugLog } from '../lib/debugLog';
import { cache } from './cache';

/**
 * One-shot suitability gate for the current core+details pair.
 * Built once after details warm; every list/filter then does O(1) Set lookups
 * instead of re-running assessAccess regexes across ~3.7k products per navigation.
 */
export type SuitabilityIndex = {
  runDate: string;
  /** Rolling core sha when known — distinguishes same-date republishes. */
  coreSha: string;
  /** Manifest details sha when known; empty when built without a sha. */
  detailsSha: string;
  allowed: Set<string>;
};

export type PersistedSuitabilityIndex = {
  schemaVersion: 1;
  runDate: string;
  coreSha: string;
  detailsSha: string;
  allowed: string[];
};

let installed: SuitabilityIndex | null = null;
let inFlight: Promise<SuitabilityIndex | null> | null = null;
let inFlightKey = '';

export function getSuitabilityIndex(): SuitabilityIndex | null {
  return installed;
}

export function clearSuitabilityIndex(): void {
  installed = null;
  setSuitabilityAllowed(null);
  inFlight = null;
  inFlightKey = '';
}

/**
 * Fail closed while a replacement core/details pair is being classified.
 * Keeping the previous pair's Set can expose a product whose eligibility
 * changed; falling back to core-only name checks has the same integrity gap.
 */
export function closeSuitabilityGateUntilRebuild(): void {
  installed = null;
  setSuitabilityAllowed(new Set(), { rebuildClosed: true });
  inFlight = null;
  inFlightKey = '';
}

export function installSuitabilityIndex(index: SuitabilityIndex | null): void {
  installed = index;
  setSuitabilityAllowed(index?.allowed ?? null);
}

export function suitabilityIndexMatches(
  index: SuitabilityIndex | null,
  runDate: string,
  coreSha: string,
  detailsSha: string,
): boolean {
  return !!index &&
    index.runDate === runDate &&
    index.coreSha === coreSha &&
    index.detailsSha === detailsSha;
}

/** Install the tiny persisted gate when it exactly matches this payload pair. */
export async function hydrateSuitabilityIndex(
  runDate: string,
  coreSha: string,
  detailsSha: string,
): Promise<SuitabilityIndex | null> {
  const saved = await cache.readSuitabilityIndex();
  if (
    !saved ||
    saved.schemaVersion !== 1 ||
    saved.runDate !== runDate ||
    saved.coreSha !== coreSha ||
    saved.detailsSha !== detailsSha ||
    !Array.isArray(saved.allowed) ||
    saved.allowed.some((key) => typeof key !== 'string')
  ) {
    return null;
  }
  const index: SuitabilityIndex = {
    runDate,
    coreSha,
    detailsSha,
    allowed: new Set(saved.allowed),
  };
  installSuitabilityIndex(index);
  debugLog.info('suitability', `index hydrated run_date=${runDate} allowed=${index.allowed.size}`);
  return index;
}

/** Collect every rate row across sections (shared with diagnostics). */
export function allCoreRateRows(core: CorePayload): RateRow[] {
  return SECTION_ORDER.flatMap((section) => core.sections[section]?.rates ?? []);
}

/**
 * Fields consumed by `isBroadlyAvailable`. A product key can occasionally carry
 * inconsistent duplicate identities in the upstream rows; retain each distinct
 * identity so the allowed Set keeps its historical "any allowed row wins"
 * semantics while identical rate tiers are classified only once.
 */
function suitabilityIdentity(row: RateRow): string {
  return JSON.stringify([
    row.product_key,
    row.provider ?? '',
    row.product_name ?? '',
    row.account_class ?? '',
  ]);
}

/**
 * Build the allowed-product Set. Chunks + yields so a post-ingest warm does not
 * freeze tab navigation for hundreds of ms on mid-range Android.
 */
export async function buildSuitabilityIndex(
  core: CorePayload,
  details: DetailsPayload | null | undefined,
  detailsSha = '',
  coreSha = '',
  chunkSize = 400,
): Promise<SuitabilityIndex> {
  const rows = allCoreRateRows(core);
  const products = details?.products ?? null;
  const allowed = new Set<string>();
  const identities = new Map<string, RateRow>();
  const t0 = Date.now();

  for (const row of rows) {
    const identity = suitabilityIdentity(row);
    if (!identities.has(identity)) identities.set(identity, row);
  }

  let classified = 0;
  for (const row of identities.values()) {
    if (isBroadlyAvailable(row, products?.[row.product_key] ?? null)) {
      allowed.add(row.product_key);
    }
    classified += 1;
    if (chunkSize > 0 && classified % chunkSize === 0) {
      await yieldToUi();
    }
  }

  const index: SuitabilityIndex = {
    runDate: core.run_date,
    coreSha,
    detailsSha,
    allowed,
  };
  debugLog.info(
    'suitability',
    `index built run_date=${index.runDate} rows=${rows.length} identities=${identities.size} allowed=${allowed.size} ms=${Date.now() - t0} details=${products ? 'yes' : 'no'}`,
  );
  return index;
}

/**
 * Rebuild + install when the live store core/details match `core`.
 * No-ops if a newer refresh already replaced the dataset.
 * Coalesces concurrent rebuilds for the same run_date+coreSha+detailsSha.
 */
export async function rebuildAndInstallSuitabilityIndex(
  core: CorePayload,
  details: DetailsPayload | null | undefined,
  detailsSha: string,
  isCurrent: () => boolean,
  coreSha = '',
): Promise<SuitabilityIndex | null> {
  const key = `${core.run_date}|${coreSha}|${detailsSha}`;
  if (
    installed &&
    installed.runDate === core.run_date &&
    installed.coreSha === coreSha &&
    installed.detailsSha === detailsSha
  ) {
    return installed;
  }
  if (inFlight && inFlightKey === key) return inFlight;

  const promise = (async () => {
    const index = await buildSuitabilityIndex(core, details, detailsSha, coreSha);
    if (!isCurrent()) return null;
    installSuitabilityIndex(index);
    try {
      await cache.writeSuitabilityIndex({
        schemaVersion: 1,
        runDate: index.runDate,
        coreSha: index.coreSha,
        detailsSha: index.detailsSha,
        allowed: [...index.allowed],
      });
    } catch (err) {
      debugLog.warn(
        'suitability',
        `index cache write failed: ${String((err as Error)?.message ?? err)}`,
      );
    }
    return index;
  })();

  inFlightKey = key;
  const tracked = promise.finally(() => {
    if (inFlight === tracked) {
      inFlight = null;
      inFlightKey = '';
    }
  });
  inFlight = tracked;
  return tracked;
}
