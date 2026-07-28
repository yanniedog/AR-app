import { datedManifestUrl } from '../config';
import { debugLog } from '../lib/debugLog';
import type { Manifest } from '../types';
import { formatRunDate } from './format';
import {
  fetchDatesIndexJson,
  type DatesIndex,
} from './historyDaily';
import { fetchManifest } from './payload';

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
    let datedRolling: Manifest | undefined;
    try {
      datedRolling = await fetchDated(pendingIngestRunDate);
    } catch (err) {
      debugLog.info(
        'ingest',
        `dated release not ready for run_date=${pendingIngestRunDate}: ${String((err as Error)?.message ?? err)}`,
      );
    }

    if (datedRolling) {
      const datedRunDate = String(datedRolling.run_date || '').slice(0, 10);
      if (datedRunDate === pendingIngestRunDate) {
        debugLog.info(
          'ingest',
          `dated release finalises run_date=${pendingIngestRunDate} despite dates-index lag (latest=${latestFinal})`,
        );
        return {
          status: 'finalized',
          manifest: datedRolling,
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
      manifest: finalized,
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
