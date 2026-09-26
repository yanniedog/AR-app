import * as snapshot from './historicalBankRateCatalogue.snapshot.json';
import { parseDatesIndex } from './datesIndex';
import { decompressCatalogue } from './historicalBankRateCatalogueCompression';
import { prepareHistoricalBankRateCatalogue } from './historicalBankRateCatalogue';
import type { HistoricalBankRateCatalogue } from './historicalBankRateCatalogueWire';

export const bundledHistoricalCatalogueBinding = {
  core_sha256: snapshot.core_sha256,
  index: parseDatesIndex(snapshot.source_index),
};
let decoded: HistoricalBankRateCatalogue | null | undefined;

/** Decode the verified rich baseline once. Never import the numerical baseline. */
export function getBundledHistoricalBankRateCatalogue(): HistoricalBankRateCatalogue | null {
  if (decoded === undefined) {
    const value = decompressCatalogue(snapshot);
    decoded = prepareHistoricalBankRateCatalogue(value)?.catalogue ?? null;
  }
  return decoded;
}
