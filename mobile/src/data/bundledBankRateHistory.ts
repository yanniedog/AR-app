import { gunzipSync, strFromU8 } from 'fflate';
import { hexToBytes } from '@noble/hashes/utils';
import type { CorePayload } from '../types';
import type { PackedBankRateHistory } from './bankRateHistoryWire';
import * as bundled from './bundledBankRateHistory.snapshot.json';

let history: PackedBankRateHistory | undefined;
/** Signed-app fallback for one exact verified catalogue, including offline cache.
 * Never attach old row indices to a new/corrected catalogue or replace live history. */
export function withBundledBankRateHistory(core: CorePayload, coreSha: string | null | undefined): CorePayload {
  if (core.bank_rate_history || coreSha !== bundled.core_sha256 || core.run_date !== bundled.run_date) return core;
  history ??= JSON.parse(strFromU8(gunzipSync(hexToBytes(bundled.gzip_hex)))) as PackedBankRateHistory;
  return { ...core, bank_rate_history: history };
}


