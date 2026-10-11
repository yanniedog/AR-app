import type { HistoricalCatalogueCodec } from './historicalBankRateCatalogueCompression';

const MAX_COMPRESSED = 16 * 1024 * 1024, MAX_DECODED = 128 * 1024 * 1024;
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');

/** Use the browser's gzip and SHA implementations, including mobile Safari.
 * The bounded reader rejects inflated output before retaining excess bytes. */
async function readBounded(stream: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  const reader = stream.getReader(), chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.length;
      if (length > limit) throw new Error('Historical catalogue exceeds decoded budget');
      chunks.push(next.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

function encode(bytes: Uint8Array): string {
  const parts: string[] = [];
  // Multiples of three keep each base64 block independent of its neighbours.
  for (let start = 0; start < bytes.length; start += 12_288) {
    parts.push(btoa(String.fromCharCode(...bytes.subarray(start, start + 12_288))));
  }
  return parts.join('');
}

/** Capability detection keeps older/insecure browsers on the portable codec. */
export function getWebHistoryCodec(): HistoricalCatalogueCodec | null {
  if (typeof CompressionStream === 'undefined' || typeof DecompressionStream === 'undefined' ||
      typeof Blob === 'undefined' || typeof Blob.prototype.stream !== 'function' ||
      typeof TextDecoder === 'undefined' || typeof atob !== 'function' || typeof btoa !== 'function' ||
      typeof globalThis.crypto?.subtle?.digest !== 'function') return null;
  return {
    async compressAsync(json) {
      if (!json.length || json.length > MAX_DECODED) throw new Error('Historical catalogue exceeds decoded budget');
      const blob = new Blob([json]);
      if (blob.size > MAX_DECODED) throw new Error('Historical catalogue exceeds decoded budget');
      const bytes = await blob.arrayBuffer();
      const sha256 = hex(await globalThis.crypto.subtle.digest('SHA-256', bytes));
      const compressed = await readBounded(blob.stream().pipeThrough(new CompressionStream('gzip')), MAX_COMPRESSED);
      return { bytes: bytes.byteLength, sha256, gzip_base64: encode(compressed) };
    },
    async decompressAsync(base64, length, digest) {
      if (!Number.isSafeInteger(length) || length < 1 || length > MAX_DECODED || !/^[a-f0-9]{64}$/.test(digest) ||
          !base64.length || base64.length % 4 || base64.length > Math.ceil(MAX_COMPRESSED / 3) * 4) {
        throw new Error('Invalid historical catalogue receipt');
      }
      const binary = atob(base64);
      if (binary.length < 18 || binary.length > MAX_COMPRESSED || btoa(binary) !== base64) {
        throw new Error('Invalid historical catalogue base64');
      }
      const compressed = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) compressed[i] = binary.charCodeAt(i);
      if (new DataView(compressed.buffer).getUint32(compressed.length - 4, true) !== length) {
        throw new Error('Historical catalogue length mismatch');
      }
      const bytes = await readBounded(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip')), length);
      if (bytes.length !== length || hex(await globalThis.crypto.subtle.digest('SHA-256', bytes)) !== digest) {
        throw new Error('Historical catalogue digest mismatch');
      }
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    },
  };
}
