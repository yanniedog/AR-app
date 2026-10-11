import { DETACHED_HISTORY_MAX_COMPRESSED, DETACHED_HISTORY_MAX_ENCODED } from './detachedHistoricalBankRateCatalogueWire';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function digit(code: number): number {
  if (code >= 65 && code <= 90) return code - 65;
  if (code >= 97 && code <= 122) return code - 71;
  if (code >= 48 && code <= 57) return code + 4;
  return code === 43 ? 62 : code === 47 ? 63 : -1;
}

/** A bounded representation of the original asset bytes, never parsed JSON. */
export async function encodeDetachedHistoryBytes(bytes: Uint8Array, yieldWork: () => Promise<void>): Promise<string> {
  if (!bytes.length || bytes.length > DETACHED_HISTORY_MAX_COMPRESSED) throw new Error('Detached history asset exceeds cache budget');
  const parts: string[] = [];
  for (let start = 0; start < bytes.length; start += 12_288) {
    let part = '';
    const end = Math.min(bytes.length, start + 12_288);
    for (let i = start; i < end; i += 3) {
      const a = bytes[i], b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0;
      part += ALPHABET[a >>> 2] + ALPHABET[(a & 3) << 4 | b >>> 4] +
        (i + 1 < end ? ALPHABET[(b & 15) << 2 | c >>> 6] : '=') + (i + 2 < end ? ALPHABET[c & 63] : '=');
    }
    parts.push(part); await yieldWork();
  }
  return parts.join('');
}

export async function decodeDetachedHistoryBytes(value: string, yieldWork: () => Promise<void>): Promise<Uint8Array | null> {
  if (typeof value !== 'string' || !value.length || value.length % 4 || value.length > DETACHED_HISTORY_MAX_ENCODED) return null;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const length = value.length / 4 * 3 - padding;
  if (length <= 0 || length > DETACHED_HISTORY_MAX_COMPRESSED) return null;
  const bytes = new Uint8Array(length); let written = 0;
  for (let start = 0; start < value.length; start += 16_384) {
    const end = Math.min(value.length, start + 16_384);
    for (let i = start; i < end; i += 4) {
      const last = i + 4 === value.length;
      const a = digit(value.charCodeAt(i)), b = digit(value.charCodeAt(i + 1));
      const c = last && padding === 2 ? 0 : digit(value.charCodeAt(i + 2));
      const d = last && padding ? 0 : digit(value.charCodeAt(i + 3));
      if (a < 0 || b < 0 || c < 0 || d < 0 || (last && ((padding === 2 && (b & 15)) || (padding === 1 && (c & 3))))) return null;
      bytes[written++] = a << 2 | b >>> 4;
      if (written < length) bytes[written++] = (b & 15) << 4 | c >>> 2;
      if (written < length) bytes[written++] = (c & 3) << 6 | d;
    }
    await yieldWork();
  }
  return bytes;
}
