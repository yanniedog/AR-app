import { strFromU8 } from 'fflate';

import {
  sha256Bytes,
  utf8Bytes,
} from '../contracts/v3/contractPrimitives';
import { parseJsonHeavy } from '../lib/yieldToUi';
import {
  normalizeBankSpreadHistoryPayload,
  type BankSpreadHistoryPayload,
} from './bankSpreadHistory';
import { gunzipCooperatively } from './payload';

const SHA256 = /^[0-9a-f]{64}$/;
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export interface BankSpreadCacheIdentity {
  coreSha: string;
  spreadSha: string;
  runDate: string;
}

export interface BankSpreadStoredEntry {
  core_sha256: string;
  bank_spread_history_sha256: string;
  run_date: string;
  compressed_bytes: number;
  encoded_bytes: number;
}

export interface VerifiedBankSpreadRecord {
  identity: BankSpreadCacheIdentity;
  entry: BankSpreadStoredEntry;
  payload: BankSpreadHistoryPayload;
  rawBytes: Uint8Array;
  source: 'primary' | 'temporary' | 'candidate';
}

export interface BankSpreadRecordLimits {
  maxCompressedBytes: number;
  maxInflatedBytes: number;
  maxEncodedBytes: number;
}

interface StoredRecord {
  schema_version: 2;
  core_sha256: string;
  bank_spread_history_sha256: string;
  run_date: string;
  compressed_bytes: number;
  encoded_bytes: number;
  raw_base64: string;
}

export function validBankSpreadIdentity(identity: BankSpreadCacheIdentity): boolean {
  return (
    SHA256.test(identity.coreSha) &&
    SHA256.test(identity.spreadSha) &&
    /^\d{4}-\d{2}-\d{2}$/.test(identity.runDate)
  );
}

export function bankSpreadIdentityKey(identity: BankSpreadCacheIdentity): string {
  return `${identity.coreSha}:${identity.spreadSha}`;
}

export function bankSpreadEntryIdentity(entry: BankSpreadStoredEntry): BankSpreadCacheIdentity {
  return {
    coreSha: entry.core_sha256,
    spreadSha: entry.bank_spread_history_sha256,
    runDate: entry.run_date,
  };
}

export function sameBankSpreadBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  const chunkBytes = 12 * 1024;
  for (let start = 0; start < bytes.length; start += chunkBytes) {
    const end = Math.min(bytes.length, start + chunkBytes);
    let chunk = '';
    for (let offset = start; offset < end; offset += 3) {
      const a = bytes[offset];
      const hasB = offset + 1 < end;
      const hasC = offset + 2 < end;
      const b = hasB ? bytes[offset + 1] : 0;
      const c = hasC ? bytes[offset + 2] : 0;
      chunk += BASE64[a >>> 2];
      chunk += BASE64[((a & 3) << 4) | (b >>> 4)];
      chunk += hasB ? BASE64[((b & 15) << 2) | (c >>> 6)] : '=';
      chunk += hasC ? BASE64[c & 63] : '=';
    }
    chunks.push(chunk);
  }
  return chunks.join('');
}

function base64ToBytes(
  value: string,
  maximumEncodedBytes: number,
  maximumDecodedBytes: number,
): Uint8Array | null {
  if (
    value.length === 0 ||
    value.length > maximumEncodedBytes ||
    value.length % 4 !== 0 ||
    !BASE64_PATTERN.test(value)
  ) return null;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const decodedLength = (value.length / 4) * 3 - padding;
  if (decodedLength <= 0 || decodedLength > maximumDecodedBytes) return null;
  const bytes = new Uint8Array(decodedLength);
  let writeOffset = 0;
  for (let offset = 0; offset < value.length; offset += 4) {
    const a = BASE64.indexOf(value[offset]);
    const b = BASE64.indexOf(value[offset + 1]);
    const c = value[offset + 2] === '=' ? 0 : BASE64.indexOf(value[offset + 2]);
    const d = value[offset + 3] === '=' ? 0 : BASE64.indexOf(value[offset + 3]);
    if (a < 0 || b < 0 || c < 0 || d < 0) return null;
    bytes[writeOffset] = (a << 2) | (b >>> 4);
    writeOffset += 1;
    if (writeOffset < bytes.length) {
      bytes[writeOffset] = ((b & 15) << 4) | (c >>> 2);
      writeOffset += 1;
    }
    if (writeOffset < bytes.length) {
      bytes[writeOffset] = ((c & 3) << 6) | d;
      writeOffset += 1;
    }
  }
  return bytes;
}

function parseStoredRecord(value: unknown): StoredRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Partial<StoredRecord>;
  if (
    record.schema_version !== 2 ||
    typeof record.core_sha256 !== 'string' ||
    !SHA256.test(record.core_sha256) ||
    typeof record.bank_spread_history_sha256 !== 'string' ||
    !SHA256.test(record.bank_spread_history_sha256) ||
    typeof record.run_date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(record.run_date) ||
    !Number.isSafeInteger(record.compressed_bytes) ||
    (record.compressed_bytes as number) <= 0 ||
    !Number.isSafeInteger(record.encoded_bytes) ||
    (record.encoded_bytes as number) <= 0 ||
    typeof record.raw_base64 !== 'string'
  ) return null;
  return record as StoredRecord;
}

export async function validateRawBankSpreadRecord(
  identity: BankSpreadCacheIdentity,
  rawBytes: Uint8Array,
  source: VerifiedBankSpreadRecord['source'],
  limits: BankSpreadRecordLimits,
): Promise<VerifiedBankSpreadRecord | null> {
  if (
    !validBankSpreadIdentity(identity) ||
    rawBytes.byteLength === 0 ||
    rawBytes.byteLength > limits.maxCompressedBytes ||
    sha256Bytes(rawBytes) !== identity.spreadSha ||
    rawBytes.byteLength < 3 ||
    rawBytes[0] !== 0x1f ||
    rawBytes[1] !== 0x8b
  ) return null;
  let inflated: Uint8Array;
  try {
    inflated = await gunzipCooperatively(rawBytes, 64 * 1024, limits.maxInflatedBytes);
  } catch {
    return null;
  }
  const text = strFromU8(inflated);
  if (!sameBankSpreadBytes(utf8Bytes(text), inflated)) return null;
  let parsed: unknown;
  try {
    parsed = await parseJsonHeavy<unknown>(text);
  } catch {
    return null;
  }
  const payload = normalizeBankSpreadHistoryPayload(parsed);
  if (!payload || payload.run_date !== identity.runDate) return null;
  const rawBase64 = bytesToBase64(rawBytes);
  if (rawBase64.length > limits.maxEncodedBytes) return null;
  return {
    identity,
    payload,
    rawBytes,
    source,
    entry: {
      core_sha256: identity.coreSha,
      bank_spread_history_sha256: identity.spreadSha,
      run_date: identity.runDate,
      compressed_bytes: rawBytes.byteLength,
      encoded_bytes: rawBase64.length,
    },
  };
}

export async function validateStoredBankSpreadRecord(
  raw: string | null,
  identity: BankSpreadCacheIdentity,
  source: 'primary' | 'temporary',
  limits: BankSpreadRecordLimits,
): Promise<VerifiedBankSpreadRecord | null> {
  if (!raw || raw.length > limits.maxEncodedBytes + 2048) return null;
  let parsed: unknown;
  try {
    parsed = await parseJsonHeavy<unknown>(raw);
  } catch {
    return null;
  }
  const record = parseStoredRecord(parsed);
  if (
    !record ||
    record.core_sha256 !== identity.coreSha ||
    record.bank_spread_history_sha256 !== identity.spreadSha ||
    record.run_date !== identity.runDate ||
    record.compressed_bytes > limits.maxCompressedBytes ||
    record.encoded_bytes > limits.maxEncodedBytes ||
    record.encoded_bytes !== record.raw_base64.length
  ) return null;
  const bytes = base64ToBytes(
    record.raw_base64,
    limits.maxEncodedBytes,
    limits.maxCompressedBytes,
  );
  if (!bytes || bytes.byteLength !== record.compressed_bytes) return null;
  return validateRawBankSpreadRecord(identity, bytes, source, limits);
}

export function serializeBankSpreadRecord(record: VerifiedBankSpreadRecord): string {
  const rawBase64 = bytesToBase64(record.rawBytes);
  const stored: StoredRecord = {
    schema_version: 2,
    core_sha256: record.identity.coreSha,
    bank_spread_history_sha256: record.identity.spreadSha,
    run_date: record.identity.runDate,
    compressed_bytes: record.rawBytes.byteLength,
    encoded_bytes: rawBase64.length,
    raw_base64: rawBase64,
  };
  return JSON.stringify(stored);
}
