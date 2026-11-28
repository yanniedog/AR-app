import { gunzipSync, strFromU8 } from 'fflate';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';
import { SECTION_KEYS, type CorePayload } from '../types';
import type { PackedBankRateHistory } from './bankRateHistoryWire';
import * as bundled from './bundledBankRateHistory.snapshot.json';

// Migration for the immutable pre-movement edition. Data covers all providers.
let legacyMoves: CorePayload['exact_rate_moves'];
function withLegacyExactMoves(core: CorePayload, digest: string | null | undefined): CorePayload {
  if (core.exact_rate_moves || core.run_date !== '2026-11-28') return core;
  const snapshot = require('./legacyExactMoves.snapshot.json') as {
    core_sha256: string; run_date: string; gzip_hex: string; sha256: string
  };
  if (digest !== snapshot.core_sha256 || core.run_date !== snapshot.run_date) return core;
  if (!legacyMoves) {
    const bytes = gunzipSync(hexToBytes(snapshot.gzip_hex));
    if (bytesToHex(sha256(bytes)) !== snapshot.sha256) return core;
    legacyMoves = JSON.parse(strFromU8(bytes));
  }
  return { ...core, exact_rate_moves: legacyMoves };
}

let history: PackedBankRateHistory | null | undefined;
export function decodeBundledHistory(snapshot: Pick<typeof bundled, 'gzip_hex' | 'history_sha256' | 'run_date'>): PackedBankRateHistory | null {
  try {
    const bytes = gunzipSync(hexToBytes(snapshot.gzip_hex));
    if (bytesToHex(sha256(bytes)) !== snapshot.history_sha256) return null;
    const value = JSON.parse(strFromU8(bytes)) as PackedBankRateHistory;
    return value?.schema_version === 1 && Array.isArray(value.run_dates) && value.run_dates.at(-1) === snapshot.run_date &&
      SECTION_KEYS.every(section => Array.isArray(value.row_tiers?.[section]) && Array.isArray(value.sections?.[section])) ? value : null;
  } catch { return null; }
}
/** Signed-app fallback for one exact verified catalogue, including offline cache.
 * Never attach old row indices to a new/corrected catalogue or replace live history. */
export function withBundledBankRateHistory(core: CorePayload, coreSha: string | null | undefined): CorePayload {
  core = withLegacyExactMoves(core, coreSha);
  if (core.bank_rate_history || coreSha !== bundled.core_sha256 || core.run_date !== bundled.run_date) return core;
  if (history === undefined) history = decodeBundledHistory(bundled);
  return history ? { ...core, bank_rate_history: history } : core;
}
