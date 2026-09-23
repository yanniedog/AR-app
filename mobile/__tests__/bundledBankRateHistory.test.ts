import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { gzipSync, gunzipSync, strFromU8, strToU8 } from 'fflate';
import { decodeBundledHistory, withBundledBankRateHistory } from '../src/data/bundledBankRateHistory';
import * as bundled from '../src/data/bundledBankRateHistory.snapshot.json';
import type { CorePayload } from '../src/types';

const catalogue = () => ({ run_date: bundled.run_date, sections: {
  Mortgage: { rates: [] }, Savings: { rates: [] }, TD: { rates: [] },
} }) as unknown as CorePayload;

test('corrupt bytes and digest mismatches safely reject the optional bundle', () => {
  expect(decodeBundledHistory({ ...bundled, gzip_hex: '00' })).toBeNull();
  expect(decodeBundledHistory({ ...bundled, history_sha256: 'wrong' })).toBeNull();
});

test.each(['null', '{', '{"schema_version":1,"run_dates":[]}'])('malformed bundled JSON/shape remains optional (%s)', text => {
  const bytes = strToU8(text);
  expect(decodeBundledHistory({ ...bundled, gzip_hex: bytesToHex(gzipSync(bytes)), history_sha256: bytesToHex(sha256(bytes)) })).toBeNull();
});

test('bundled observations match their recorded digest and full date range', () => {
  const bytes = gunzipSync(hexToBytes(bundled.gzip_hex));
  expect(bytesToHex(sha256(bytes))).toBe(bundled.history_sha256);
  const history = JSON.parse(strFromU8(bytes));
  expect(history.run_dates).toHaveLength(133);
  expect(history.run_dates[0]).toBe('2026-05-13');
  expect(history.run_dates.at(-1)).toBe(bundled.run_date);
  expect(Object.values(history.row_tiers).reduce((sum: number, ids) => sum + (ids as number[]).length, 0)).toBe(16314);
});

test.each([undefined, null, 'different-same-day-revision'])('does not attach history without the exact verified hash (%s)', hash => {
  const core = catalogue();
  expect(withBundledBankRateHistory(core, hash)).toBe(core);
});

test('date mismatch and producer history take precedence over the bundle', () => {
  const differentDate = { ...catalogue(), run_date: '2026-09-23' };
  expect(withBundledBankRateHistory(differentDate, bundled.core_sha256)).toBe(differentDate);
  const live = { ...catalogue(), bank_rate_history: { schema_version: 1 } } as CorePayload;
  expect(withBundledBankRateHistory(live, bundled.core_sha256)).toBe(live);
});

test('exact catalogue gets the complete history once without mutating catalogue facts', () => {
  const core = catalogue();
  const first = withBundledBankRateHistory(core, bundled.core_sha256);
  expect(core.bank_rate_history).toBeUndefined();
  expect(first.sections).toBe(core.sections);
  expect(first.bank_rate_history!.run_dates).toHaveLength(133);
  expect(withBundledBankRateHistory(core, bundled.core_sha256).bank_rate_history).toBe(first.bank_rate_history);
  expect(withBundledBankRateHistory(first, bundled.core_sha256)).toBe(first);
});


