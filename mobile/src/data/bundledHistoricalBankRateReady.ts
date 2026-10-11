import * as snapshot from './historicalBankRateReady.snapshot.json';
import { parseDatesIndex } from './datesIndex';
import { type CatalogueCodecOptions } from './historicalBankRateCatalogueCompression';
import { decodeReadyHistoryArchive } from './historicalBankRateReadyRetention';
import type { HistoricalBankRateReady } from './historicalBankRateReadyWire';

export const bundledHistoricalReadyBinding = {
  core_sha256: snapshot.core_sha256,
  index: parseDatesIndex(snapshot.source_index),
};
let decoded: HistoricalBankRateReady | null | undefined;
let decoding: Promise<HistoricalBankRateReady | null> | undefined;

/** Build-time classified fallback. This module never imports the raw catalogue. */
export function getBundledHistoricalBankRateReady(options: CatalogueCodecOptions = {}): Promise<HistoricalBankRateReady | null> {
  if (decoded !== undefined) return Promise.resolve(decoded);
  if (decoding) return decoding;
  decoding = (async () => {
    const yieldControl = options.yieldControl ?? (() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return (require('../lib/yieldToUi') as typeof import('../lib/yieldToUi')).yieldToUi(0);
    });
    const value = await decodeReadyHistoryArchive(snapshot, { ...options, yieldControl });
    // Native decode/checkpoint failures are transient. A failed owner must not
    // poison this process-wide immutable fallback for every subsequent core.
    if (value) decoded = value;
    return value;
  })().catch(() => null).finally(() => { decoding = undefined; });
  return decoding;
}
