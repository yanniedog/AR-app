import { Platform } from 'react-native';
export { decodePayloadUtf8 } from './payloadUtf8';

export const MAX_PAYLOAD_INFLATED_BYTES = 192 * 1024 * 1024;

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

/** Optional native cache path; validation failures never request a JS retry. */
export async function inflateCachedPayloadOffThread(encoded: string, compressedBytes: number, sha256: string, limit: number): Promise<string | null> {
  if (!Number.isSafeInteger(compressedBytes) || compressedBytes < 18 || compressedBytes > 16 * 1024 * 1024 ||
      typeof encoded !== 'string' || encoded.length !== Math.ceil(compressedBytes / 3) * 4 || !/^[a-f0-9]{64}$/.test(sha256) ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAYLOAD_INFLATED_BYTES) throw new Error('Invalid cached payload bounds');
  if (Platform.OS !== 'android') return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getNativeHistoryCodec } = require('../../modules/history-codec') as typeof import('../../modules/history-codec');
  const codec = getNativeHistoryCodec();
  return codec?.inflateCachedPayloadAsync ? (await codec.inflateCachedPayloadAsync(encoded, compressedBytes, sha256, limit)).join('') : null;
}
