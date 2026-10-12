import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { yieldToUi } from '../lib/yieldToUi';
import { decodePayloadUtf8, MAX_PAYLOAD_INFLATED_BYTES } from './payloadInflation';

export const DETAILS_CACHE_READ_CHUNK_BYTES = 256 * 1024;
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const digits = new Int16Array(128).fill(-1);
for (let i = 0; i < BASE64.length; i++) digits[BASE64.charCodeAt(i)] = i;
const digit = (value: string, index: number) => digits[value.charCodeAt(index)] ?? -1;

function decodeChunk(value: string, maximumBytes: number): Uint8Array {
  if (value.length % 4 || value.length > Math.ceil(maximumBytes / 3) * 4) {
    throw new Error('Invalid details cache byte chunk');
  }
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const length = value.length / 4 * 3 - padding;
  if (length > maximumBytes) throw new Error('Oversized details cache byte chunk');
  const bytes = new Uint8Array(length);
  let written = 0;
  for (let i = 0; i < value.length; i += 4) {
    const last = i + 4 === value.length;
    const a = digit(value, i), b = digit(value, i + 1);
    const c = last && padding === 2 ? 0 : digit(value, i + 2);
    const d = last && padding ? 0 : digit(value, i + 3);
    if (a < 0 || b < 0 || c < 0 || d < 0 ||
        (last && ((padding === 2 && (b & 15)) || (padding === 1 && (c & 3))))) {
      throw new Error('Invalid details cache base64');
    }
    bytes[written++] = a << 2 | b >>> 4;
    if (written < length) bytes[written++] = (b & 15) << 4 | c >>> 2;
    if (written < length) bytes[written++] = (c & 3) << 6 | d;
  }
  return bytes;
}

/** Retain only an incomplete final code point; the shared decoder validates all
 * complete bytes, including stray continuations, overlong sequences and surrogates. */
function completeUtf8Prefix(bytes: Uint8Array): number {
  let lead = bytes.length - 1;
  while (lead >= 0 && (bytes[lead] & 0xc0) === 0x80) lead--;
  if (lead < 0) return bytes.length;
  const first = bytes[lead];
  const width = first >= 0xc2 && first <= 0xdf ? 2 : first >= 0xe0 && first <= 0xef ? 3 : first >= 0xf0 && first <= 0xf4 ? 4 : 1;
  return bytes.length - lead < width ? lead : bytes.length;
}

/** Android's legacy UTF-8 file reader grows a whole Java StringBuilder. Reading
 * the 35 MB details cache can request a 128 MB expansion before returning to JS.
 * Base64 position/length reads bound that native buffer; join text once in Hermes.
 * Unsupported platforms retain their existing cache reader, never an Android
 * error fallback to the unbounded reader. Receipt validation remains the caller's. */
export async function readDetailsCacheText(path: string, fallback: (path: string) => Promise<string>): Promise<string> {
  if (Platform.OS !== 'android') return fallback(path);
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists || info.isDirectory || !Number.isSafeInteger(info.size) || info.size < 0 ||
      info.size > MAX_PAYLOAD_INFLATED_BYTES) throw new Error('Invalid details cache file size');
  const size = info.size;
  const parts: string[] = [];
  let position = 0, carry: Uint8Array = new Uint8Array(0);
  while (position < size) {
    const length = Math.min(DETAILS_CACHE_READ_CHUNK_BYTES, size - position);
    const encoded = await FileSystem.readAsStringAsync(path, { encoding: 'base64', position, length });
    const bytes = decodeChunk(encoded, length);
    if (!bytes.length) throw new Error('Truncated details cache file');
    position += bytes.length;
    const combined = carry.length ? new Uint8Array(carry.length + bytes.length) : bytes;
    if (carry.length) { combined.set(carry); combined.set(bytes, carry.length); }
    const end = completeUtf8Prefix(combined);
    parts.push(decodePayloadUtf8(combined.subarray(0, end)));
    carry = combined.slice(end);
    await yieldToUi(0);
  }
  // An incomplete code point at EOF is invalid, even when the byte count matches.
  if (carry.length) decodePayloadUtf8(carry);
  const after = await FileSystem.getInfoAsync(path);
  if (!after.exists || after.isDirectory || after.size !== size) throw new Error('Details cache file changed while reading');
  return parts.join('');
}
