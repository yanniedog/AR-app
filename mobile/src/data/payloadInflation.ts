import { Platform } from 'react-native';
import { strFromU8 } from 'fflate';

export const MAX_PAYLOAD_INFLATED_BYTES = 192 * 1024 * 1024;

/** Consistent strict UTF-8 on older runtimes without a fatal TextDecoder. */
export function decodePayloadUtf8(bytes: Uint8Array): string {
  for (let i = 0; i < bytes.length;) {
    const first = bytes[i++];
    if (first < 0x80) continue;
    const count = first >= 0xc2 && first <= 0xdf ? 1 : first >= 0xe0 && first <= 0xef ? 2 : first >= 0xf0 && first <= 0xf4 ? 3 : -1;
    if (count < 0 || i + count > bytes.length) throw new Error('Invalid payload UTF-8');
    const second = bytes[i];
    if ((first === 0xe0 && second < 0xa0) || (first === 0xed && second >= 0xa0) ||
        (first === 0xf0 && second < 0x90) || (first === 0xf4 && second >= 0x90)) throw new Error('Invalid payload UTF-8');
    for (let end = i + count; i < end; i++) if ((bytes[i] & 0xc0) !== 0x80) throw new Error('Invalid payload UTF-8');
  }
  return strFromU8(bytes);
}

export async function inflatePayloadOnWeb(bytes: Uint8Array, limit: number, expected?: number): Promise<string | null> {
  if (typeof DecompressionStream === 'undefined' || typeof Blob === 'undefined' ||
      typeof Blob.prototype.stream !== 'function' || typeof TextDecoder === 'undefined') return null;
  const reader = new Blob([bytes.slice().buffer]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      if (next.value.length > limit - length) throw new Error(`inflated asset exceeds ${limit} byte limit`);
      length += next.value.length; chunks.push(next.value);
    }
  } catch (error) { await reader.cancel().catch(() => undefined); throw error; }
  finally { reader.releaseLock(); }
  if (expected != null && length !== expected) throw new Error(`inflated asset size mismatch (expected ${expected}, got ${length})`);
  const output = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(output);
}

/** Errors from a supported codec are validation failures, never fallback signals. */
export async function inflatePayloadOffThread(bytes: Uint8Array, limit: number, expected?: number): Promise<string | null> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAYLOAD_INFLATED_BYTES ||
      (expected != null && (!Number.isSafeInteger(expected) || expected < 0 || expected > limit))) throw new Error('Invalid payload inflation bounds');
  if (Platform.OS === 'web') return inflatePayloadOnWeb(bytes, limit, expected);
  if (Platform.OS !== 'android') return null;
  // Older APKs may lack this optional native method; they retain bounded JS gzip.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getNativeHistoryCodec } = require('../../modules/history-codec') as typeof import('../../modules/history-codec');
  const codec = getNativeHistoryCodec();
  // Bounded text chunks avoid retaining a full decoded byte buffer plus a giant
  // Java UTF-16 allocation at once. Joining happens once in the JS heap.
  return codec?.inflatePayloadAsync ? (await codec.inflatePayloadAsync(bytes, limit, expected ?? -1)).join('') : null;
}
