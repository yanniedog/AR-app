import { Gunzip, strFromU8 } from 'fflate';
import { bytesToHex } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';
import { SECTION_KEYS, type CorePayload, type RateRow, type SectionKey } from '../types';
import { isValidCalendarDate } from '../lib/calendarDate';
import { toFraction } from './format';
import { rateTierSignature } from './bankRateOverview';
import { parseDatesIndex, type DatesIndex } from './datesIndex';
import type { BankRateSpan, PackedBankRateHistory } from './bankRateHistoryWire';
import * as bundled from './portableBankRateHistory.snapshot.json';

export interface PortableBankRateHistory {
  schema_version: 1;
  /** Complete calendar, including unpublished days with no observations. */
  run_dates: string[];
  source_heads: Record<string, string>;
  /** Exact descriptive tier signature SHA-256 -> observed-rate RLE spans. */
  sections: Record<SectionKey, Record<string, BankRateSpan[]>>;
}
export interface PortableBankRateHistorySnapshot {
  schema_version: 1;
  run_date: string;
  core_sha256: string;
  source_index: DatesIndex;
  history_sha256: string;
  uncompressed_bytes: number;
  gzip_base64: string;
}
const SHA = /^[a-f0-9]{64}$/;
const DAY = 86_400_000;
const MAX_DAYS = 5000, MAX_TIERS = 100_000, MAX_CELLS = 10_000_000;
const MAX_COMPRESSED_BYTES = 8 * 1024 * 1024, MAX_DECODED_BYTES = 64 * 1024 * 1024;
const dayTime = (day: string) => Date.parse(`${day}T00:00:00Z`);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const sections = (): PortableBankRateHistory['sections'] => ({ Mortgage: {}, Savings: {}, TD: {} });
// Verified catalogue rows are immutable; refresh supplies new row objects.
const tierIds = new WeakMap<RateRow, string>();

function base64Digit(code: number): number {
  if (code >= 65 && code <= 90) return code - 65;
  if (code >= 97 && code <= 122) return code - 71;
  if (code >= 48 && code <= 57) return code + 4;
  return code === 43 ? 62 : code === 47 ? 63 : -1;
}

/** Strict padded base64 without Buffer, atob, or a recursive multi-MB regex. */
export function decodePortableHistoryBase64(value: unknown, maximumBytes = MAX_COMPRESSED_BYTES): Uint8Array | null {
  if (!Number.isInteger(maximumBytes) || maximumBytes < 1 || maximumBytes > MAX_COMPRESSED_BYTES ||
    typeof value !== 'string' || !value.length || value.length % 4 || value.length > Math.ceil(maximumBytes / 3) * 4) return null;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const length = value.length / 4 * 3 - padding;
  if (length < 1 || length > maximumBytes) return null;
  const bytes = new Uint8Array(length);
  let written = 0;
  for (let offset = 0; offset < value.length; offset += 4) {
    const final = offset + 4 === value.length;
    const a = base64Digit(value.charCodeAt(offset)), b = base64Digit(value.charCodeAt(offset + 1));
    const c = final && padding === 2 ? 0 : base64Digit(value.charCodeAt(offset + 2));
    const d = final && padding > 0 ? 0 : base64Digit(value.charCodeAt(offset + 3));
    if (a < 0 || b < 0 || c < 0 || d < 0 || (final && ((padding === 2 && (b & 15) !== 0) || (padding === 1 && (c & 3) !== 0)))) return null;
    bytes[written++] = a << 2 | b >>> 4;
    if (written < length) bytes[written++] = (b & 15) << 4 | c >>> 2;
    if (written < length) bytes[written++] = (c & 3) << 6 | d;
  }
  return bytes;
}

export function portableRateTierId(row: RateRow): string {
  let id = tierIds.get(row);
  if (!id) { id = bytesToHex(sha256(rateTierSignature(row))); tierIds.set(row, id); }
  return id;
}

function calendar(first: string, last: string): string[] {
  if (!isValidCalendarDate(first) || !isValidCalendarDate(last)) throw new Error('Invalid history date');
  const count = (dayTime(last) - dayTime(first)) / DAY + 1;
  if (count < 1 || count > MAX_DAYS) throw new Error('History date range exceeds its budget');
  return Array.from({ length: count }, (_, index) => new Date(dayTime(first) + index * DAY).toISOString().slice(0, 10));
}

export function validatePortableBankRateHistory(value: unknown): value is PortableBankRateHistory {
  try {
    if (!record(value) || value.schema_version !== 1 || !Array.isArray(value.run_dates) ||
      !value.run_dates.length || value.run_dates.length > MAX_DAYS || !record(value.source_heads) || !record(value.sections)) return false;
    const dates = value.run_dates;
    if (!dates.every((day, index) => isValidCalendarDate(day) && (!index || dayTime(day) - dayTime(dates[index - 1]) === DAY))) return false;
    const positions = new Map(dates.map((day, index) => [day, index]));
    const observed = new Set<number>();
    for (const [day, head] of Object.entries(value.source_heads)) {
      if (!positions.has(day) || typeof head !== 'string' || !SHA.test(head)) return false;
      observed.add(positions.get(day)!);
    }
    let tiers = 0, cells = 0, spanCount = 0;
    for (const section of SECTION_KEYS) {
      const series = value.sections[section];
      if (!record(series) || (tiers += Object.keys(series).length) > MAX_TIERS) return false;
      for (const [id, spans] of Object.entries(series)) {
        if (!SHA.test(id) || !Array.isArray(spans) || (spanCount += spans.length) > MAX_CELLS) return false;
        let end = 0;
        for (const span of spans) {
          if (!Array.isArray(span) || span.length !== 3) return false;
          const [start, count, rates] = span;
          if (!Number.isInteger(start) || !Number.isInteger(count) || start < end || count < 1 || start + count > dates.length ||
            !Array.isArray(rates) || !rates.length || rates.length > 10_000 ||
            !rates.every(rate => typeof rate === 'number' && Number.isFinite(rate) && rate >= 0) ||
            (cells += count * rates.length) > MAX_CELLS) return false;
          end = start + count;
          for (let day = start; day < end; day++) if (!observed.has(day)) return false;
        }
      }
    }
    return true;
  } catch { return false; }
}

/** Bound allocation before inflation; neither a corrupt bundle nor a cache can
 * allocate based on an unchecked gzip footer. */
export function decodePortableBankRateHistory(snapshot: PortableBankRateHistorySnapshot): PortableBankRateHistory | null {
  try {
    if (snapshot.schema_version !== 1 || !isValidCalendarDate(snapshot.run_date) || !SHA.test(snapshot.core_sha256) ||
      !SHA.test(snapshot.history_sha256) || !Number.isInteger(snapshot.uncompressed_bytes) || snapshot.uncompressed_bytes < 1 ||
      snapshot.uncompressed_bytes > MAX_DECODED_BYTES) return null;
    const compressed = decodePortableHistoryBase64(snapshot.gzip_base64);
    if (!compressed || compressed.length < 18) return null;
    const footerLength = new DataView(compressed.buffer, compressed.byteOffset + compressed.length - 4, 4).getUint32(0, true);
    if (footerLength !== snapshot.uncompressed_bytes) return null;
    const bytes = new Uint8Array(snapshot.uncompressed_bytes);
    let written = 0;
    const inflater = new Gunzip(chunk => {
      if (written + chunk.length > bytes.length) throw new Error('History inflation exceeds declared bytes');
      bytes.set(chunk, written); written += chunk.length;
    });
    // Small compressed pushes bound temporary output too, including a forged
    // footer or concatenated gzip members. Never silently truncate inflation.
    for (let cursor = 0; cursor < compressed.length; cursor += 4096) {
      const end = Math.min(compressed.length, cursor + 4096);
      inflater.push(compressed.subarray(cursor, end), end === compressed.length);
    }
    if (written !== snapshot.uncompressed_bytes || bytesToHex(sha256(bytes)) !== snapshot.history_sha256) return null;
    const value: unknown = JSON.parse(strFromU8(bytes));
    const index = parseDatesIndex(snapshot.source_index);
    return validatePortableBankRateHistory(value) && value.run_dates.at(-1) === snapshot.run_date && index?.latest_date === snapshot.run_date &&
      Object.entries(value.source_heads).every(([day, head]) => index.revision_heads?.[day]?.manifest_sha256 === head) ? value : null;
  } catch { return null; }
}

let baseline: PortableBankRateHistory | null | undefined;
export function getBundledPortableBankRateHistory(): PortableBankRateHistory | null {
  if (baseline === undefined) baseline = decodePortableBankRateHistory(bundled as PortableBankRateHistorySnapshot);
  return baseline;
}
export const bundledPortableBankRateHistoryIdentity = {
  run_date: bundled.run_date, core_sha256: bundled.core_sha256,
  source_index: parseDatesIndex(bundled.source_index),
} as const;

function append(spans: BankRateSpan[], start: number, count: number, rates: number[]): void {
  if (!count) return;
  const last = spans.at(-1);
  if (last && last[0] + last[1] === start && last[2].length === rates.length && last[2].every((value, i) => value === rates[i])) last[1] += count;
  else spans.push([start, count, rates]);
}

function coreRates(core: CorePayload, section: SectionKey): Map<string, number[]> {
  const result = new Map<string, number[]>();
  for (const row of core.sections[section].rates) {
    const value = toFraction(row.rate);
    if (value === null) continue;
    const id = portableRateTierId(row), rates = result.get(id) ?? [];
    rates.push(value * 100); result.set(id, rates);
  }
  for (const rates of result.values()) rates.sort((a, b) => a - b);
  return result;
}

/** Merge only after the caller verifies manifest/core bytes. A correction
 * replaces the entire observed day, including removal of now-absent tiers. */
export function mergePortableBankRateHistory(
  portable: PortableBankRateHistory | null, core: CorePayload, manifestSha256: string,
): PortableBankRateHistory {
  if (!SHA.test(manifestSha256) || !isValidCalendarDate(core.run_date) ||
    (portable !== null && !validatePortableBankRateHistory(portable))) throw new Error('Invalid verified history input');
  const first = portable && portable.run_dates[0] < core.run_date ? portable.run_dates[0] : core.run_date;
  const last = portable && portable.run_dates.at(-1)! > core.run_date ? portable.run_dates.at(-1)! : core.run_date;
  const dates = calendar(first, last), target = dates.indexOf(core.run_date);
  const offset = portable ? dates.indexOf(portable.run_dates[0]) : 0;
  const result: PortableBankRateHistory = { schema_version: 1, run_dates: dates,
    source_heads: { ...portable?.source_heads, [core.run_date]: manifestSha256 }, sections: sections() };
  for (const section of SECTION_KEYS) {
    const current = coreRates(core, section);
    const previous = portable?.sections[section] ?? {};
    for (const id of new Set([...Object.keys(previous), ...current.keys()])) {
      const spans: BankRateSpan[] = [];
      for (const [oldStart, count, rates] of previous[id] ?? []) {
        const start = oldStart + offset, end = start + count;
        if (target < start || target >= end) spans.push([start, count, rates]);
        else {
          if (target > start) spans.push([start, target - start, rates]);
          if (target + 1 < end) spans.push([target + 1, end - target - 1, rates]);
        }
      }
      if (current.has(id)) spans.push([target, 1, current.get(id)!]);
      spans.sort(([a], [b]) => a - b);
      const compact: BankRateSpan[] = [];
      for (const [start, count, rates] of spans) append(compact, start, count, rates);
      if (compact.length) result.sections[section][id] = compact;
    }
  }
  if (!validatePortableBankRateHistory(result)) throw new Error('Merged history exceeds its budget');
  return result;
}

/** Pure projection into the current catalogue order. Verified revision heads
 * authorize historical dates; current rates always come from the supplied core. */
export function projectPortableBankRateHistory(
  core: CorePayload, portable: PortableBankRateHistory, verifiedHeads: Readonly<Record<string, string>>,
): PackedBankRateHistory {
  if (!validatePortableBankRateHistory(portable)) throw new Error('Invalid portable history');
  const first = portable.run_dates[0] < core.run_date ? portable.run_dates[0] : core.run_date;
  const dates = calendar(first, core.run_date), currentIndex = dates.length - 1;
  const authorized = dates.map(day => day < core.run_date && SHA.test(verifiedHeads[day] ?? '') &&
    portable.source_heads[day] === verifiedHeads[day]);
  const result: PackedBankRateHistory = { schema_version: 1, run_dates: dates,
    row_tiers: { Mortgage: [], Savings: [], TD: [] }, sections: { Mortgage: [], Savings: [], TD: [] } };
  for (const section of SECTION_KEYS) {
    const ids = new Map<string, number>(), current = coreRates(core, section);
    for (const row of core.sections[section].rates) {
      const digest = portableRateTierId(row);
      if (!ids.has(digest)) ids.set(digest, ids.size);
      result.row_tiers[section].push(ids.get(digest)!);
    }
    for (const digest of ids.keys()) {
      const spans: BankRateSpan[] = [];
      for (const [start, count, rates] of portable.sections[section][digest] ?? []) {
        let acceptedStart = -1;
        for (let index = start; index < Math.min(start + count, currentIndex); index++) {
          if (authorized[index]) { if (acceptedStart < 0) acceptedStart = index; }
          else if (acceptedStart >= 0) { append(spans, acceptedStart, index - acceptedStart, rates); acceptedStart = -1; }
        }
        if (acceptedStart >= 0) append(spans, acceptedStart, Math.min(start + count, currentIndex) - acceptedStart, rates);
      }
      if (current.has(digest)) append(spans, currentIndex, 1, current.get(digest)!);
      result.sections[section].push(spans);
    }
  }
  return result;
}
