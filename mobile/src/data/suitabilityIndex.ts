import type { CorePayload, DetailsPayload, RateRow } from '../types';
import { SECTION_ORDER } from '../constants';
import { isBroadlyAvailable } from './format';
import { setSuitabilityAllowed } from './suitabilityGate';
import { yieldToUi } from '../lib/yieldToUi';
import { debugLog } from '../lib/debugLog';

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

export function installSuitabilityIndex(index: SuitabilityIndex | null): void {
  installed = index;
  setSuitabilityAllowed(index?.allowed ?? null);
}

/** Collect every rate row across sections (shared with diagnostics). */
export function allCoreRateRows(core: CorePayload): RateRow[] {
  return SECTION_ORDER.flatMap((section) => core.sections[section]?.rates ?? []);
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
  const t0 = Date.now();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (isBroadlyAvailable(row, products?.[row.product_key] ?? null)) {
      allowed.add(row.product_key);
    }
    if (chunkSize > 0 && (i + 1) % chunkSize === 0) {
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
    `index built run_date=${index.runDate} rows=${rows.length} allowed=${allowed.size} ms=${Date.now() - t0} details=${products ? 'yes' : 'no'}`,
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
    return index;
  })();

  inFlightKey = key;
  inFlight = promise.finally(() => {
    if (inFlight === promise) {
      inFlight = null;
      inFlightKey = '';
    }
  });
  return inFlight;
}
