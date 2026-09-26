import { DecodeUTF8, Gzip, Gunzip, gzipSync, strFromU8, strToU8 } from 'fflate';
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

export interface CatalogueCodecOptions {
  /** Tests may inject a scheduler; production uses the existing UI-yield helper. */
  yieldControl?: () => Promise<void>;
  /** Maximum target between yields; individual library calls remain atomic. */
  sliceMs?: number;
}
const clock = () => typeof performance !== 'undefined' ? performance.now() : Date.now();
function scheduler(options: CatalogueCodecOptions) {
  const yieldControl = options.yieldControl ?? (async () => (await import('../lib/yieldToUi')).yieldToUi(0));
  const target = Number.isFinite(options.sliceMs) ? Math.min(16, Math.max(0, options.sliceMs!)) : 8;
  let started = clock();
  return async (force = false) => {
    if (force || clock() - started >= target) { await yieldControl(); started = clock(); }
  };
}
type Checkpoint = ReturnType<typeof scheduler>;

/** Escape bounded strings while preserving pairs across chunk boundaries. */
function* quoted(value: string): Generator<string> {
  yield '"';
  for (let start = 0; start < value.length;) {
    let end = Math.min(value.length, start + 8192);
    const last = value.charCodeAt(end - 1), next = value.charCodeAt(end);
    if (end < value.length && last >= 0xd800 && last <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) end--;
    yield JSON.stringify(value.slice(start, end)).slice(1, -1);
    start = end;
  }
  yield '"';
}
const omitted = (value: unknown) => value === undefined || typeof value === 'function' || typeof value === 'symbol';
type JsonFrame = { value: object; keys: string[] | null; index: number; first: boolean };

/** Iterative JSON-wire serializer: standard key order, omission/null rules and
 * scalar escaping, with bounded nesting and no custom toJSON/boxed objects. */
function* jsonTokens(input: unknown): Generator<string | null> {
  if (omitted(input)) throw new TypeError('Catalogue root is not JSON serializable');
  const ancestors = new Set<object>(), frames: JsonFrame[] = [];
  let value: unknown = input;
  let pending = true, work = 0;
  while (pending || frames.length) {
    if (++work % 512 === 0) yield null;
    if (pending) {
      pending = false;
      if (typeof value === 'string') yield* quoted(value);
      else if (typeof value === 'bigint') throw new TypeError('Catalogue BigInt is not JSON serializable');
      else if (value === null || typeof value !== 'object') yield JSON.stringify(value);
      else {
        if (ancestors.has(value)) throw new TypeError('Circular catalogue JSON');
        if (frames.length >= 512) throw new RangeError('Catalogue JSON nesting exceeds budget');
        const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
        if ((!array && prototype !== Object.prototype && prototype !== null) || typeof (value as { toJSON?: unknown }).toJSON === 'function') {
          throw new TypeError('Catalogue supports plain JSON objects and arrays only');
        }
        ancestors.add(value);
        frames.push({ value, keys: array ? null : Object.keys(value), index: 0, first: true });
        yield array ? '[' : '{';
      }
      continue;
    }
    const frame = frames.at(-1)!;
    const array = frame.keys === null;
    const length = array ? (frame.value as unknown[]).length : frame.keys!.length;
    if (frame.index === length) {
      frames.pop(); ancestors.delete(frame.value); yield array ? ']' : '}'; continue;
    }
    const key = array ? String(frame.index++) : frame.keys![frame.index++];
    value = (frame.value as Record<string, unknown>)[key];
    if (omitted(value)) { if (!array) continue; value = null; }
    if (!frame.first) yield ',';
    frame.first = false;
    if (!array) { yield* quoted(key); yield ':'; }
    pending = true;
  }
}

function* jsonChunks(value: unknown): Generator<string> {
  let part = '';
  for (const token of jsonTokens(value)) {
    if (token !== null) part += token;
    if (token === null || part.length >= 16_384) { yield part; part = ''; }
  }
  if (part) yield part;
}

async function encodeBase64Async(bytes: Uint8Array, checkpoint: Checkpoint): Promise<string> {
  const parts: string[] = [];
  for (let start = 0; start < bytes.length; start += 12_288) {
    parts.push(encodeBase64(bytes.subarray(start, start + 12_288)));
    await checkpoint();
  }
  return parts.join('');
}

async function decodeBase64Async(value: unknown, checkpoint: Checkpoint): Promise<Uint8Array | null> {
  if (typeof value !== 'string' || !value.length || value.length % 4 || value.length > Math.ceil(MAX_COMPRESSED / 3) * 4) return null;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const size = value.length / 4 * 3 - padding;
  if (size < 1 || size > MAX_COMPRESSED) return null;
  const bytes = new Uint8Array(size);
  for (let start = 0; start < value.length; start += 65_536) {
    const end = Math.min(value.length, start + 65_536);
    const part = decodeBase64(value.slice(start, end));
    if (!part || part.length !== (end - start) / 4 * 3 - (end === value.length ? padding : 0)) return null;
    bytes.set(part, start / 4 * 3);
    await checkpoint();
  }
  return bytes;
}

/** Compress immutable JSON-wire values without a whole-object stringify or
 * whole-buffer hash/deflate burst. Gzip bytes may differ; decoded SHA is identical. */
export async function compressCatalogueAsync(value: unknown, options: CatalogueCodecOptions = {}): Promise<CompressedCatalogue> {
  const checkpoint = scheduler(options), hash = sha256.create(), chunks: Uint8Array[] = [];
  let bytes = 0, compressed = 0;
  const gzip = new Gzip({ level: 6 }, chunk => {
    compressed += chunk.length;
    if (compressed > MAX_COMPRESSED) throw new Error('Historical catalogue exceeds compressed budget');
    chunks.push(chunk);
  });
  await checkpoint(true);
  for (const json of jsonChunks(value)) {
    if (json) {
      const part = strToU8(json);
      bytes += part.length;
      if (bytes > MAX_DECODED) throw new Error('Historical catalogue exceeds decoded budget');
      hash.update(part); gzip.push(part);
    }
    await checkpoint();
  }
  gzip.push(new Uint8Array(0), true);
  await checkpoint(true);
  const encoded = new Uint8Array(compressed); let offset = 0;
  for (const chunk of chunks) { encoded.set(chunk, offset); offset += chunk.length; await checkpoint(); }
  return { sha256: bytesToHex(hash.digest()), bytes, gzip_base64: await encodeBase64Async(encoded, checkpoint) };
}

/** Decode, inflate, verify and decode UTF-8 cooperatively. JSON.parse remains
 * atomic; callers should schedule catalogue preparation separately afterwards. */
export async function decompressCatalogueAsync(value: CompressedCatalogue, options: CatalogueCodecOptions = {}): Promise<unknown | null> {
  try {
    if (!value || !/^[a-f0-9]{64}$/.test(value.sha256) || !Number.isSafeInteger(value.bytes) || value.bytes < 1 || value.bytes > MAX_DECODED) return null;
    const checkpoint = scheduler(options);
    await checkpoint(true);
    const gzip = await decodeBase64Async(value.gzip_base64, checkpoint);
    if (!gzip || gzip.length < 18 || new DataView(gzip.buffer, gzip.byteOffset + gzip.length - 4, 4).getUint32(0, true) !== value.bytes) return null;
    const bytes = new Uint8Array(value.bytes); let written = 0;
    const decoder = new Gunzip(chunk => {
      if (written + chunk.length > bytes.length) throw new Error('Catalogue inflation exceeds declared length');
      bytes.set(chunk, written); written += chunk.length;
    });
    for (let start = 0; start < gzip.length; start += 1024) {
      decoder.push(gzip.subarray(start, start + 1024), start + 1024 >= gzip.length);
      await checkpoint();
    }
    if (written !== value.bytes) return null;
    const hash = sha256.create();
    for (let start = 0; start < bytes.length; start += 65_536) { hash.update(bytes.subarray(start, start + 65_536)); await checkpoint(); }
    if (bytesToHex(hash.digest()) !== value.sha256) return null;
    const parts: string[] = [], utf8 = new DecodeUTF8(part => { parts.push(part); });
    for (let start = 0; start < bytes.length; start += 65_536) {
      utf8.push(bytes.subarray(start, start + 65_536), start + 65_536 >= bytes.length);
      await checkpoint();
    }
    await checkpoint(true);
    const json = parts.join('');
    await checkpoint(true);
    return JSON.parse(json);
  } catch { return null; }
}
