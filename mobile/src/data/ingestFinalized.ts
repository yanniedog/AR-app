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
 * is still uploading. `dates-index.json` is updated only after that day's
 * immutable dated release is finalised — so membership there is the app's
 * signal that the run is safe to adopt.
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
 * - Rolling day ahead of dates-index → keep pending flag; return the latest
 *   finalized dated manifest when available.
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
