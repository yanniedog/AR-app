import { datedManifestUrl } from '../config';
import { debugLog } from '../lib/debugLog';
import type { Manifest, ManifestFile } from '../types';
import { formatRunDate } from './format';
import {
  fetchDatesIndexJson,
  type DatesIndex,
} from './historyDaily';
import { fetchManifest } from './payload';

/** Optional assets that dated tags often omit (core/details only). */
export const OPTIONAL_MANIFEST_KEYS = [
  'search_index',
  'history_banks',
  'bank_history',
  'bank_spread_history',
  'rba_calendar',
] as const;

type OptionalManifestKey = (typeof OPTIONAL_MANIFEST_KEYS)[number];

/**
 * Dated releases (`app-payload-YYYY-MM-DD`) often ship only core/details while
 * the rolling tag carries bank history, RBA calendar, and related assets for
 * the same day. When run_date + core sha match, copy missing optional entries
 * so Response / Outlook / history keep working after a dates-index-lag adopt.
 */
export function mergeOptionalManifestFiles(
  target: Manifest,
  source: Manifest | null | undefined,
  replaceExisting = false,
): Manifest {
  if (!source) return target;
  const targetDate = String(target.run_date || '').slice(0, 10);
  const sourceDate = String(source.run_date || '').slice(0, 10);
  if (!targetDate || targetDate !== sourceDate) return target;
  if (target.files.core.sha256 !== source.files.core.sha256) return target;

  let changed = false;
  const files: Manifest['files'] = { ...target.files };
  for (const key of OPTIONAL_MANIFEST_KEYS) {
    const fromSource: ManifestFile | undefined = source.files[key as OptionalManifestKey];
    if (fromSource && (replaceExisting || !files[key as OptionalManifestKey])) {
      if (files[key as OptionalManifestKey]?.sha256 === fromSource.sha256) continue;
      files[key as OptionalManifestKey] = fromSource;
      changed = true;
    }
  }
  return changed ? { ...target, files } : target;
}

/**
 * The Pi publishes assets to the rolling `app-payload-latest` tag while an ingest
 * is still uploading. `dates-index.json` is normally updated after that day's
 * immutable dated release (`app-payload-YYYY-MM-DD`) is finalised.
 *
 * Finalize signals (either is sufficient):
 * 1. Rolling day listed in dates-index (fast path).
 * 2. Immutable dated release for the rolling day is fetchable — covers the
 *    case where dates-index lagged behind a completed dated publish.
 */
export function isManifestFinalized(manifest: Manifest, index: DatesIndex): boolean {
  const runDate = String(manifest.run_date || '').slice(0, 10);
  if (!runDate) return false;
  return index.dates.includes(runDate);
}

/**
 * A previously adopted immutable dated manifest remains proof of finalisation
 * while the rolling run date and core revision are unchanged.
 */
function matchesVerifiedDatedManifest(
  rolling: Manifest,
  verified: Manifest | null | undefined,
): verified is Manifest {
  if (!verified) return false;
  const runDate = String(rolling.run_date || '').slice(0, 10);
  if (!runDate || String(verified.run_date || '').slice(0, 10) !== runDate) return false;
  if (verified.tag !== `app-payload-${runDate}`) return false;
  return verified.files.core.sha256 === rolling.files.core.sha256;
}

export type FinalizedManifestResolution =
  | {
      status: 'finalized';
      manifest: Manifest;
      pendingIngestRunDate: null;
      datesIndex: DatesIndex;
    }
  | {
      status: 'pending';
      /** Last fully published day — prefer this over the in-flight rolling day. */
      manifest: Manifest | null;
      pendingIngestRunDate: string;
      datesIndex: DatesIndex;
    }
  | {
      status: 'index-unavailable';
      /** Rolling manifest only; caller decides whether to keep cache. */
      manifest: Manifest;
      pendingIngestRunDate: string | null;
      datesIndex: null;
    };

/**
 * Resolve which manifest the app may adopt.
 * - Rolling day listed in dates-index → adopt rolling.
 * - Rolling day ahead of dates-index and dated release exists → adopt that
 *   dated snapshot (dates-index may lag a completed publish).
 * - Rolling day ahead of dates-index with no dated release yet → keep pending
 *   flag; return the latest finalized dated manifest when available.
 * - dates-index unreachable → return rolling and let the caller keep cache.
 */
export async function resolveFinalizedManifest(
  rolling: Manifest,
  opts: {
    fetchIndex?: () => Promise<DatesIndex>;
    fetchDated?: (runDate: string) => Promise<Manifest>;
    /** Previously adopted immutable manifest, normally the installed cache meta. */
    verifiedDated?: Manifest | null;
  } = {},
): Promise<FinalizedManifestResolution> {
  const fetchIndex = opts.fetchIndex ?? fetchDatesIndexJson;
  const fetchDated =
    opts.fetchDated ?? ((runDate: string) => fetchManifest(datedManifestUrl(runDate)));

  let datesIndex: DatesIndex;
  try {
    datesIndex = await fetchIndex();
  } catch (err) {
    debugLog.warn(
      'ingest',
      `dates-index unavailable: ${String((err as Error)?.message ?? err)}`,
    );
    return {
      status: 'index-unavailable',
      manifest: rolling,
      pendingIngestRunDate: null,
      datesIndex: null,
    };
  }

  if (isManifestFinalized(rolling, datesIndex)) {
    return {
      status: 'finalized',
      manifest: rolling,
      pendingIngestRunDate: null,
      datesIndex,
    };
  }

  const pendingIngestRunDate = String(rolling.run_date || '').slice(0, 10);
  const latestFinal = datesIndex.latest_date;

  // dates-index can lag a completed dated publish (seen 2026-07-28: dated tag
  // and rolling assets matched, but dates-index still ended at 2026-07-27).
  // Only probe when rolling is strictly ahead of the index — never adopt an
  // older dated snapshot when the index claims a newer day than rolling.
  if (pendingIngestRunDate && latestFinal && pendingIngestRunDate > latestFinal) {
    let datedRolling: Manifest | undefined = matchesVerifiedDatedManifest(
      rolling,
      opts.verifiedDated,
    )
      ? opts.verifiedDated
      : undefined;
    if (datedRolling) {
      debugLog.debug(
        'ingest',
        `reusing verified dated manifest run_date=${pendingIngestRunDate} core_sha=${rolling.files.core.sha256.slice(0, 12)}`,
      );
    } else {
      try {
        datedRolling = await fetchDated(pendingIngestRunDate);
      } catch (err) {
        debugLog.info(
          'ingest',
          `dated release not ready for run_date=${pendingIngestRunDate}: ${String((err as Error)?.message ?? err)}`,
        );
      }
    }

    if (datedRolling) {
      const datedRunDate = String(datedRolling.run_date || '').slice(0, 10);
      if (datedRunDate === pendingIngestRunDate) {
        const manifest = mergeOptionalManifestFiles(datedRolling, rolling);
        const restoredOptional = OPTIONAL_MANIFEST_KEYS.filter(
          (key) => !datedRolling.files[key] && !!manifest.files[key],
        );
        debugLog.info(
          'ingest',
          `dated release finalises run_date=${pendingIngestRunDate} despite dates-index lag (latest=${latestFinal})` +
            (restoredOptional.length
              ? `; restored optional=${restoredOptional.join(',')}`
              : ''),
        );
        return {
          status: 'finalized',
          manifest,
          pendingIngestRunDate: null,
          datesIndex,
        };
      }
      debugLog.warn(
        'ingest',
        `dated manifest run_date mismatch want=${pendingIngestRunDate} got=${datedRolling.run_date}`,
      );
    }
  }

  debugLog.info(
    'ingest',
    `rolling run_date=${pendingIngestRunDate} not in dates-index (latest=${latestFinal}) — holding prior day`,
  );

  if (!latestFinal || latestFinal >= pendingIngestRunDate) {
    // Index empty or claims a later day than rolling (clock skew) — do not
    // invent a replacement; caller keeps whatever is already installed.
    return {
      status: 'pending',
      manifest: null,
      pendingIngestRunDate,
      datesIndex,
    };
  }

  try {
    const finalized = await fetchDated(latestFinal);
    if (String(finalized.run_date || '').slice(0, 10) !== latestFinal) {
      debugLog.warn(
        'ingest',
        `dated manifest run_date mismatch want=${latestFinal} got=${finalized.run_date}`,
      );
      return {
        status: 'pending',
        manifest: null,
        pendingIngestRunDate,
        datesIndex,
      };
    }
    return {
      status: 'pending',
      // Prior-day dated tags also omit optional assets; rolling will not merge
      // (different run_date). Callers may still enrich from the installed day.
      manifest: mergeOptionalManifestFiles(finalized, rolling),
      pendingIngestRunDate,
      datesIndex,
    };
  } catch (err) {
    debugLog.warn(
      'ingest',
      `dated manifest fetch failed run_date=${latestFinal}: ${String((err as Error)?.message ?? err)}`,
    );
    return {
      status: 'pending',
      manifest: null,
      pendingIngestRunDate,
      datesIndex,
    };
  }
}

/** Subtle copy for the data-health strip while today's GH upload is still open. */
export function pendingIngestBannerMessage(
  pendingRunDate: string,
  showingRunDate: string | null | undefined,
): string {
  const pending = String(pendingRunDate || '').slice(0, 10);
  const showing = String(showingRunDate || '').slice(0, 10);
  if (showing && showing !== pending) {
    const label = formatRunDate(showing) || showing;
    return `Today\u2019s rates are still uploading \u2014 showing ${label}`;
  }
  return 'Today\u2019s rates are still uploading';
}
