import * as snapshot from './historicalBankRateCatalogue.snapshot.json';
import { parseDatesIndex } from './datesIndex';
import { decompressCatalogue, decompressCatalogueAsync, type CatalogueCodecOptions } from './historicalBankRateCatalogueCompression';
import { prepareHistoricalBankRateCatalogue, prepareHistoricalBankRateCatalogueAsync } from './historicalBankRateCatalogue';
import type { HistoricalBankRateCatalogue } from './historicalBankRateCatalogueWire';

export const bundledHistoricalCatalogueBinding = {
  core_sha256: snapshot.core_sha256,
  index: parseDatesIndex(snapshot.source_index),
};
let decoded: HistoricalBankRateCatalogue | null | undefined;
let decoding: Promise<HistoricalBankRateCatalogue | null> | undefined;

/** Decode the verified rich baseline once. Never import the numerical baseline. */
export function getBundledHistoricalBankRateCatalogue(): HistoricalBankRateCatalogue | null {
  if (decoded === undefined) {
    const value = decompressCatalogue(snapshot);
    decoded = prepareHistoricalBankRateCatalogue(value)?.catalogue ?? null;
  }
  return decoded;
}

/** One cooperative load shared by concurrent boot/refresh callers. Sync tools
 * retain their API and share the resulting decoded object once it is available. */
export function getBundledHistoricalBankRateCatalogueAsync(options: CatalogueCodecOptions = {}): Promise<HistoricalBankRateCatalogue | null> {
  if (decoded !== undefined) return Promise.resolve(decoded);
  if (decoding) return decoding;
  decoding = (async () => {
    const value = await decompressCatalogueAsync(snapshot, options);
    const prepared = await prepareHistoricalBankRateCatalogueAsync(value, options.yieldControl);
    // A synchronous script/test caller could have populated this while we yielded.
    if (decoded === undefined) decoded = prepared?.catalogue ?? null;
    return decoded;
  })().catch(() => { decoded ??= null; return decoded; }).finally(() => { decoding = undefined; });
  return decoding;
}
