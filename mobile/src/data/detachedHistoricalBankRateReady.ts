import { PAYLOAD_REPO } from '../config';
import { debugLog } from '../lib/debugLog';
import type { Manifest, ManifestFile } from '../types';
import { validateReadyHistoricalDescriptor } from './detachedHistoricalBankRateCatalogueWire';
import { createDetachedHistoryLoader } from './detachedHistoricalHistoryLoader';
import { validateAcceptedHistoricalBankRateReady as validateHistoricalBankRateReadyForApp } from './historicalBankRateReadyAcceptance';
import { decodeReadyHistoryArchive } from './historicalBankRateReadyRetention';
import type { HistoricalBankRateReady } from './historicalBankRateReadyWire';

const DETACHED_HISTORY_MAX_COMPRESSED = 1024 * 1024;
const DETACHED_HISTORY_MAX_DECODED = 2 * 1024 * 1024;

const loadDetachedReady = createDetachedHistoryLoader<ManifestFile, HistoricalBankRateReady>({
  logScope: 'bank-history-ready',
  workTitle: 'Prepared bank history',
  maxCompressedBytes: DETACHED_HISTORY_MAX_COMPRESSED,
  maxDecodedBytes: DETACHED_HISTORY_MAX_DECODED,
  hasDescriptor: manifest => manifest.bank_rate_history_ready !== undefined,
  resolveDescriptor: manifest => validateReadyHistoricalDescriptor(manifest, PAYLOAD_REPO),
  decodeInner: async ({ inner, runDate, checkpoint, isCurrent, stage, work }) => {
    if (inner.bytes > 4 * 1024 * 1024) throw new Error('Prepared history exceeds processing byte budget');
    if (!isCurrent()) return null;
    work.stage('Opening prepared chart data');
    stage('inner decode begin');
    const decoded = await decodeReadyHistoryArchive(inner, { yieldControl: checkpoint });
    if (!isCurrent()) return null;
    const valid = validateHistoricalBankRateReadyForApp(decoded);
    const result = isCurrent() && valid && decoded.run_dates.every(day => day <= runDate) ? decoded : null;
    if (result) stage('verified catalogue ready');
    else {
      work.stage(
        !isCurrent()
          ? 'History request superseded'
          : valid
            ? 'Catalogue contains dates after payload date; using fallback'
            : 'Catalogue validation rejected; using fallback',
      );
      debugLog.warn('bank-history-ready', 'Optional historical catalogue rejected; using fallback.');
    }
    return result;
  },
});

/** Optional lazy asset: the caller owns installation and the bundled fallback. */
export async function loadDetachedHistoricalBankRateReady(
  manifest: Manifest,
  options: {
    allowNetwork: boolean;
    isCurrent?: () => boolean;
    /** Keep the same immutable asset alive while a replacement request paints. */
    isAssetCurrent?: () => boolean;
  },
): Promise<HistoricalBankRateReady | null> {
  return loadDetachedReady(manifest, options);
}
