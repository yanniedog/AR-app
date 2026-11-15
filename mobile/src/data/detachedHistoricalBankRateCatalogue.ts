import { PAYLOAD_REPO } from '../config';
import { debugLog } from '../lib/debugLog';
import type { Manifest, ManifestFile } from '../types';
import { createDetachedHistoryLoader } from './detachedHistoricalHistoryLoader';
import {
  DETACHED_HISTORY_MAX_COMPRESSED,
  DETACHED_HISTORY_MAX_DECODED,
  PACKED_HISTORY_MAX_DECODED,
  validateDetachedHistoricalCatalogueDescriptor,
  validatePackedHistoricalCatalogueDescriptor,
} from './detachedHistoricalBankRateCatalogueWire';
import { bindHistoricalCatalogueArchiveReceipt, prepareHistoricalBankRateCatalogueAsync } from './historicalBankRateCatalogue';
import { decompressCatalogueAsync } from './historicalBankRateCatalogueCompression';
import { unpackHistoricalBankRateCatalogueAsync } from './historicalBankRateCataloguePacked';
import type { HistoricalBankRateCatalogue } from './historicalBankRateCatalogueWire';
import { inflateCachedPayloadOffThread } from './payloadInflation';

const loadDetachedCatalogue = createDetachedHistoryLoader<ManifestFile, HistoricalBankRateCatalogue>({
  logScope: 'bank-history-detached',
  workTitle: 'Detached historical catalogue',
  maxCompressedBytes: DETACHED_HISTORY_MAX_COMPRESSED,
  maxDecodedBytes: DETACHED_HISTORY_MAX_DECODED,
  hasDescriptor: manifest => manifest.bank_rate_history_catalogue !== undefined,
  resolveDescriptor: manifest => validateDetachedHistoricalCatalogueDescriptor(manifest, PAYLOAD_REPO),
  // The optional native path verifies the same exact compressed receipt,
  // gzip bounds/CRC and UTF-8 without a multi-megabyte JS base64 loop.
  // Encrypted legacy assets retain their existing key/verification path.
  tryFastCacheDecode: (encoded, file) => inflateCachedPayloadOffThread(encoded, file.bytes, file.sha256, DETACHED_HISTORY_MAX_DECODED),
  decodeInner: async ({ inner, manifest, runDate, checkpoint, isCurrent, stage, work }) => {
    const packed = !!validatePackedHistoricalCatalogueDescriptor(manifest, PAYLOAD_REPO);
    if (packed && inner.bytes > PACKED_HISTORY_MAX_DECODED) throw new Error('Packed history exceeds processing byte budget');
    if (!isCurrent()) return null;
    work.stage('Decoding compressed historical catalogue');
    stage('inner decode begin');
    const decoded = await decompressCatalogueAsync(inner, {
      yieldControl: checkpoint,
      onDecodeError: error => debugLog.warn('bank-history-detached', `Inner archive decode failed: ${String((error as Error)?.message ?? error).slice(0, 800)}`),
    });
    if (!isCurrent()) return null;
    if (decoded === null) {
      stage('inner decode unavailable');
      return null;
    }
    if (packed && (!decoded || typeof decoded !== 'object' || (decoded as { format?: unknown }).format !== 'ar-history-dag-v1')) {
      throw new Error('Packed history capability requires the compact format');
    }
    const catalogue = await unpackHistoricalBankRateCatalogueAsync(decoded, { yieldControl: checkpoint });
    work.stage('Validating historical catalogue');
    stage('inner decode complete; validation begin');
    const prepared = await prepareHistoricalBankRateCatalogueAsync(catalogue, checkpoint);
    const result = isCurrent() && prepared && prepared.catalogue.run_dates.every(day => day <= runDate) ? prepared.catalogue : null;
    if (result && prepared) bindHistoricalCatalogueArchiveReceipt(prepared, inner.sha256);
    if (result) stage('verified catalogue ready');
    else {
      work.stage(
        !isCurrent()
          ? 'History request superseded'
          : prepared
            ? 'Catalogue contains dates after payload date; using fallback'
            : 'Catalogue validation rejected; using fallback',
      );
      debugLog.warn('bank-history-detached', 'Optional historical catalogue rejected; using fallback.');
    }
    return result;
  },
});

/** Optional lazy asset: the caller owns installation and the bundled fallback. */
export async function loadDetachedHistoricalBankRateCatalogue(
  manifest: Manifest,
  options: {
    allowNetwork: boolean;
    isCurrent?: () => boolean;
    /** Keep the same immutable asset alive while a replacement request paints. */
    isAssetCurrent?: () => boolean;
  },
): Promise<HistoricalBankRateCatalogue | null> {
  return loadDetachedCatalogue(manifest, options);
}
