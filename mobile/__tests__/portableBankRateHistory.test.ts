import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { gzipSync, strToU8 } from 'fflate';
import { Buffer } from 'node:buffer';
import type { CorePayload, RateRow } from '../src/types';
import { rateTierSignature } from '../src/data/bankRateOverview';
import {
  decodePortableBankRateHistory, decodePortableHistoryBase64, getBundledPortableBankRateHistory, mergePortableBankRateHistory,
  portableRateTierId, projectPortableBankRateHistory, validatePortableBankRateHistory,
  type PortableBankRateHistory, type PortableBankRateHistorySnapshot,
} from '../src/data/portableBankRateHistory';
import * as bundled from '../src/data/portableBankRateHistory.snapshot.json';

const A = 'a'.repeat(64), B = 'b'.repeat(64), C = 'c'.repeat(64);
const row = (id: string, rate = '0.06', extra: Partial<RateRow> = {}): RateRow => ({
  provider: 'Example Bank', product_key: id, product_name: 'Home Loan', rate_type: 'VARIABLE', rate, ...extra,
});
const core = (day: string, rows: RateRow[]): CorePayload => ({ schema_version: 1, run_date: day,
  sections: { Mortgage: { rates: rows }, Savings: { rates: [] }, TD: { rates: [] } },
} as unknown as CorePayload);

function fixture(): PortableBankRateHistory {
  return mergePortableBankRateHistory(
    mergePortableBankRateHistory(null, core('2026-09-20', [row('a'), row('retired', '0.07')]), A),
    core('2026-09-22', [row('a', '0.08'), row('new', '0.09')]), B,
  );
}
function snapshot(portable: PortableBankRateHistory): PortableBankRateHistorySnapshot {
  const bytes = strToU8(JSON.stringify(portable)), dates = Object.keys(portable.source_heads).sort();
  return { schema_version: 1, run_date: portable.run_dates.at(-1)!, core_sha256: A,
    source_index: { schema_version: 1, revision_protocol: 1, dates, min_date: dates[0], latest_date: dates.at(-1)!, count: dates.length,
      revision_heads: Object.fromEntries(dates.map(day => [day, { revision: 1, generation_id: `sha256-${A}`, bundle_sha256: A,
        manifest_sha256: portable.source_heads[day], manifest_url: `https://github.com/yanniedog/AR-local/releases/download/app-payload-${day}-r000001/manifest.json` }])) },
    history_sha256: bytesToHex(sha256(bytes)), uncompressed_bytes: bytes.length, gzip_base64: Buffer.from(gzipSync(bytes)).toString('base64') };
}

test('native-safe base64 decoding preserves every byte, all padding lengths, and bounded output', () => {
  for (const length of [1, 2, 3, 256]) {
    const bytes = Uint8Array.from({ length }, (_, index) => index);
    expect(decodePortableHistoryBase64(Buffer.from(bytes).toString('base64'), length)).toEqual(bytes);
  }
  expect(decodePortableHistoryBase64('AAAA', 2)).toBeNull();
  expect(decodePortableHistoryBase64('AAAA'.repeat(4), 3)).toBeNull();
  expect(decodePortableHistoryBase64('AAAA', 8 * 1024 * 1024 + 1)).toBeNull();
  expect(decodePortableHistoryBase64('AAAA', -1)).toBeNull();
});

test.each(['', 'A', 'AAA', 'AAAAA', '====', 'A===', 'AA=A', '=AAA', 'AA==AAAA', 'AB==', 'AAB=', 'AA-_', 'AA A', 'AA\nA', 'AAéA'])('malformed or noncanonical base64 is rejected: %p', value => {
  expect(decodePortableHistoryBase64(value)).toBeNull();
});

test('portable IDs use the existing exact app signature, including descriptive scope and Unicode', () => {
  const first = row('clé');
  expect(portableRateTierId(first)).toBe(bytesToHex(sha256(rateTierSignature(first))));
  expect(portableRateTierId({ ...first, rate: '0.08', comparison_rate: '0.09', last_updated: 'changed', rate_index: 12 })).toBe(portableRateTierId(first));
  expect(portableRateTierId({ ...first, rate_type: 'FIXED' })).not.toBe(portableRateTierId(first));
  expect(portableRateTierId({ ...first, product_name: 'Renamed loan' })).not.toBe(portableRateTierId(first));
});

test('all historical tiers survive, with a complete calendar and no invented unpublished observations', () => {
  const portable = fixture();
  expect(portable.run_dates).toEqual(['2026-09-20', '2026-09-21', '2026-09-22']);
  expect(Object.keys(portable.sections.Mortgage)).toHaveLength(3);
  expect(portable.sections.Mortgage[portableRateTierId(row('retired'))]).toEqual([[0, 1, [7.000000000000001]]]);
  expect(portable.source_heads['2026-09-21']).toBeUndefined();
  expect(validatePortableBankRateHistory(portable)).toBe(true);
});

test('projection remaps a new catalogue order and binds each previous day to its verified source head', () => {
  const portable = fixture(), current = core('2026-09-23', [row('new', '0.1'), row('a', '0.05'), row('retired', '0.04')]);
  const before = JSON.stringify(current), identities = current.sections.Mortgage.rates.slice();
  const pack = projectPortableBankRateHistory(current, portable, { '2026-09-20': A, '2026-09-22': B });
  expect(pack.row_tiers.Mortgage).toEqual([0, 1, 2]);
  expect(pack.sections.Mortgage[0]).toEqual([[2, 1, [9]], [3, 1, [10]]]);
  expect(pack.sections.Mortgage[1]).toEqual([[0, 1, [6]], [2, 1, [8]], [3, 1, [5]]]);
  expect(pack.sections.Mortgage[2].map(span => span.slice(0, 2))).toEqual([[0, 1], [3, 1]]);
  expect(JSON.stringify(current)).toBe(before);
  expect(current.sections.Mortgage.rates.every((item, i) => item === identities[i] && item.bank_rate_tier === undefined)).toBe(true);
  const corrected = projectPortableBankRateHistory(current, portable, { '2026-09-20': C });
  expect(corrected.sections.Mortgage.every(spans => spans.every(([start]) => start === 3))).toBe(true);
});

test('one corrected date replaces removed and changed tiers across every series without stacking', () => {
  let portable = mergePortableBankRateHistory(null, core('2026-09-20', [row('a'), row('gone')]), A);
  portable = mergePortableBankRateHistory(portable, core('2026-09-21', [row('a'), row('gone')]), A);
  portable = mergePortableBankRateHistory(portable, core('2026-09-22', [row('a'), row('gone')]), A);
  const original = JSON.stringify(portable);
  const revised = mergePortableBankRateHistory(portable, core('2026-09-21', [row('a', '0.09')]), C);
  expect(revised.sections.Mortgage[portableRateTierId(row('a'))]).toEqual([[0, 1, [6]], [1, 1, [9]], [2, 1, [6]]]);
  expect(revised.sections.Mortgage[portableRateTierId(row('gone'))]).toEqual([[0, 1, [6]], [2, 1, [6]]]);
  expect(revised.source_heads['2026-09-21']).toBe(C);
  expect(JSON.stringify(portable)).toBe(original);
  expect(mergePortableBankRateHistory(revised, core('2026-09-21', [row('a', '0.09')]), C)).toEqual(revised);
});

test('duplicate current rows share one ID while preserving each advertised rate and current-day truth', () => {
  const portable = fixture(), current = core('2026-09-22', [row('a', '0'), row('a', '0.05'), row('a', 'invalid')]);
  const pack = projectPortableBankRateHistory(current, portable, portable.source_heads);
  expect(pack.row_tiers.Mortgage).toEqual([0, 0, 0]);
  expect(pack.sections.Mortgage[0]).toEqual([[0, 1, [6]], [2, 1, [0, 5]]]);
});

test('older corrections extend the beginning correctly and future observations never enter an older catalogue', () => {
  const portable = mergePortableBankRateHistory(fixture(), core('2026-09-18', [row('a', '0.03')]), C);
  const pack = projectPortableBankRateHistory(core('2026-09-19', [row('a', '0.04')]), portable, portable.source_heads);
  expect(pack.run_dates).toEqual(['2026-09-18', '2026-09-19']);
  expect(pack.sections.Mortgage[0]).toEqual([[0, 1, [3]], [1, 1, [4]]]);
  const earlier = projectPortableBankRateHistory(core('2026-09-17', [row('a')]), portable, portable.source_heads);
  expect(earlier.run_dates).toEqual(['2026-09-17']);
  expect(earlier.sections.Mortgage[0]).toEqual([[0, 1, [6]]]);
});

test('snapshot decode verifies bounded bytes, digest, shape and index-bound observations', () => {
  const portable = fixture(), encoded = snapshot(portable);
  expect(decodePortableBankRateHistory(encoded)).toEqual(portable);
  expect(decodePortableBankRateHistory({ ...encoded, history_sha256: C })).toBeNull();
  expect(decodePortableBankRateHistory({ ...encoded, gzip_base64: 'AAAA' })).toBeNull();
  expect(decodePortableBankRateHistory({ ...encoded, uncompressed_bytes: 65 * 1024 * 1024 })).toBeNull();
  expect(decodePortableBankRateHistory({ ...encoded, uncompressed_bytes: encoded.uncompressed_bytes - 1 })).toBeNull();
  encoded.source_index.revision_heads!['2026-09-20'].manifest_sha256 = C;
  expect(decodePortableBankRateHistory(encoded)).toBeNull();
});

test('a forged gzip length cannot truncate extra inflated bytes into an otherwise valid snapshot', () => {
  const portable = fixture(), encoded = snapshot(portable);
  const compressed = gzipSync(strToU8(JSON.stringify(portable) + ' '.repeat(128 * 1024)));
  new DataView(compressed.buffer, compressed.byteOffset + compressed.length - 4, 4).setUint32(0, encoded.uncompressed_bytes, true);
  expect(decodePortableBankRateHistory({ ...encoded, gzip_base64: Buffer.from(compressed).toString('base64') })).toBeNull();
});

test.each(['gap', 'invalid source', 'unbound observation', 'overlap', 'negative rate', 'invalid signature', 'budget'])('malformed portable history is rejected: %s', reason => {
  const portable = fixture(), series = portable.sections.Mortgage[portableRateTierId(row('a'))];
  if (reason === 'gap') portable.run_dates.splice(1, 1);
  if (reason === 'invalid source') portable.source_heads['2026-09-20'] = 'bad';
  if (reason === 'unbound observation') delete portable.source_heads['2026-09-20'];
  if (reason === 'overlap') series.push(series[0]);
  if (reason === 'negative rate') series[0][2][0] = -1;
  if (reason === 'invalid signature') portable.sections.Mortgage.bad = [];
  if (reason === 'budget') series[0][2] = Array.from({ length: 10_001 }, () => 6);
  expect(validatePortableBankRateHistory(portable)).toBe(false);
  expect(() => projectPortableBankRateHistory(core('2026-09-22', []), portable, {})).toThrow();
});

test('the shipped numerical baseline validates and carries the verified current revision index', () => {
  const portable = getBundledPortableBankRateHistory();
  expect(portable).not.toBeNull();
  expect(portable!.run_dates).toHaveLength(137);
  expect(Object.keys(portable!.source_heads)).toHaveLength(134);
  expect(bundled.core_sha256).toBe('f9d08e5cd5288c1d2506600a2d007d3dda5ad01b10b5f48b4b31bc6a601a8d09');
  expect(bundled.history_sha256).toBe('075cc4d97f4cee61847f4820fe9f7b85144a0355ebe211655bcf224393e578e0');
  expect(bundled.source_index.revision_heads['2026-09-26'].revision).toBe(3);
  expect(getBundledPortableBankRateHistory()).toBe(portable);
});
