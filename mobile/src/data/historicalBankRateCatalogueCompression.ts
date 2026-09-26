import { Gunzip, gzipSync, strFromU8, strToU8 } from 'fflate';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

const MAX_COMPRESSED = 16 * 1024 * 1024, MAX_DECODED = 128 * 1024 * 1024;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export interface CompressedCatalogue { sha256: string; bytes: number; gzip_base64: string }

function base64Value(code: number): number {
  if (code >= 65 && code <= 90) return code - 65;
  if (code >= 97 && code <= 122) return code - 71;
  if (code >= 48 && code <= 57) return code + 4;
  return code === 43 ? 62 : code === 47 ? 63 : -1;
}

function decodeBase64(value: unknown): Uint8Array | null {
  if (typeof value !== 'string' || !value.length || value.length % 4 || value.length > Math.ceil(MAX_COMPRESSED / 3) * 4) return null;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const size = value.length / 4 * 3 - padding;
  if (size > MAX_COMPRESSED) return null;
  const result = new Uint8Array(size); let written = 0;
  for (let i = 0; i < value.length; i += 4) {
    const last = i + 4 === value.length;
    const a = base64Value(value.charCodeAt(i)), b = base64Value(value.charCodeAt(i + 1));
    const c = last && padding === 2 ? 0 : base64Value(value.charCodeAt(i + 2));
    const d = last && padding ? 0 : base64Value(value.charCodeAt(i + 3));
    if (a < 0 || b < 0 || c < 0 || d < 0 || (last && ((padding === 2 && (b & 15)) || (padding === 1 && (c & 3))))) return null;
    result[written++] = a << 2 | b >>> 4;
    if (written < size) result[written++] = (b & 15) << 4 | c >>> 2;
    if (written < size) result[written++] = (c & 3) << 6 | d;
  }
  return result;
}

function encodeBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 12_288) {
    let part = '';
    for (let i = offset; i < Math.min(bytes.length, offset + 12_288); i += 3) {
      const a = bytes[i], b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0;
      part += ALPHABET[a >>> 2] + ALPHABET[(a & 3) << 4 | b >>> 4] +
        (i + 1 < bytes.length ? ALPHABET[(b & 15) << 2 | c >>> 6] : '=') + (i + 2 < bytes.length ? ALPHABET[c & 63] : '=');
    }
    parts.push(part);
  }
  return parts.join('');
}

export function compressCatalogue(value: unknown): CompressedCatalogue {
  const bytes = strToU8(JSON.stringify(value));
  if (bytes.length > MAX_DECODED) throw new Error('Historical catalogue exceeds decoded budget');
  const gzip = gzipSync(bytes, { level: 6 });
  if (gzip.length > MAX_COMPRESSED) throw new Error('Historical catalogue exceeds compressed budget');
  return { sha256: bytesToHex(sha256(bytes)), bytes: bytes.length, gzip_base64: encodeBase64(gzip) };
}

/** Bounded streaming inflate; digest validation precedes JSON parsing. */
export function decompressCatalogue(value: CompressedCatalogue): unknown | null {
  try {
    if (!value || !/^[a-f0-9]{64}$/.test(value.sha256) || !Number.isSafeInteger(value.bytes) || value.bytes < 1 || value.bytes > MAX_DECODED) return null;
    const gzip = decodeBase64(value.gzip_base64);
    if (!gzip || gzip.length < 18 || new DataView(gzip.buffer, gzip.byteOffset + gzip.length - 4, 4).getUint32(0, true) !== value.bytes) return null;
    const bytes = new Uint8Array(value.bytes); let written = 0;
    const decoder = new Gunzip(chunk => {
      if (written + chunk.length > bytes.length) throw new Error('Catalogue inflation exceeds declared length');
      bytes.set(chunk, written); written += chunk.length;
    });
    for (let i = 0; i < gzip.length; i += 4096) decoder.push(gzip.subarray(i, i + 4096), i + 4096 >= gzip.length);
    if (written !== value.bytes || bytesToHex(sha256(bytes)) !== value.sha256) return null;
    return JSON.parse(strFromU8(bytes));
  } catch { return null; }
}
