import type { CatalogueCodecOptions } from './historicalBankRateCatalogueCompression';
import type { HistoricalBankRateCatalogue } from './historicalBankRateCatalogueWire';

/** Lossless producer-side dictionary. Container children reference earlier nodes;
 * tag 0 is an array; tag 1 holds a shared key-array reference and values.
 * References use unsigned base64 VLQ (five data bits, bit 5 continues). Consumers
 * link shared immutable values instead of parsing repeated product descriptions.
 * Transport SHA and the existing catalogue schema validator are still required. */
export interface PackedHistoricalBankRateCatalogue {
  format: 'ar-history-dag-v1';
  root: number;
  nodes: (null | boolean | number | string | [0, string] | [1, number, string])[];
}
export const PACKED_HISTORY_LIMITS = {
  nodes: 1_000_000, edges: 4_000_000, depth: 64, objectFields: 10_000,
  characters: 64 * 1024 * 1024, expandedSize: 128 * 1024 * 1024,
} as const;
const FORMAT = 'ar-history-dag-v1';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function referenceDigit(code: number): number {
  if (code >= 65 && code <= 90) return code - 65;
  if (code >= 97 && code <= 122) return code - 71;
  if (code >= 48 && code <= 57) return code + 4;
  return code === 43 ? 62 : code === 47 ? 63 : -1;
}
function encodeReferences(refs: number[]): string {
  let encoded = '';
  for (let ref of refs) {
    do { const part = ref & 31; ref >>>= 5; encoded += ALPHABET[part | (ref ? 32 : 0)]; } while (ref);
  }
  return encoded;
}

/** Build tooling only: validate the original catalogue before packing it. */
export function packHistoricalBankRateCatalogue(value: HistoricalBankRateCatalogue): PackedHistoricalBankRateCatalogue {
  const nodes: PackedHistoricalBankRateCatalogue['nodes'] = [], interned = new Map<string, number>();
  const ancestors = new Set<object>();
  function intern(node: PackedHistoricalBankRateCatalogue['nodes'][number]): number {
    const signature = JSON.stringify(node), existing = interned.get(signature);
    if (existing !== undefined) return existing;
    if (nodes.length >= PACKED_HISTORY_LIMITS.nodes) throw new Error('Catalogue dictionary node budget exceeded');
    const id = nodes.length;
    nodes.push(node); interned.set(signature, id);
    return id;
  }
  function visit(item: unknown, depth: number): number {
    if (depth > PACKED_HISTORY_LIMITS.depth) throw new Error('Catalogue dictionary depth exceeded');
    let node: PackedHistoricalBankRateCatalogue['nodes'][number];
    if (item === null || typeof item === 'boolean' || typeof item === 'string' || (typeof item === 'number' && Number.isFinite(item))) node = item;
    else if (item && typeof item === 'object') {
      if (ancestors.has(item)) throw new Error('Circular catalogue dictionary');
      ancestors.add(item);
      if (Array.isArray(item)) node = [0, encodeReferences(item.map(child => visit(child, depth + 1)))];
      else {
        const entries = Object.entries(item);
        const shape = intern([0, encodeReferences(entries.map(([key]) => visit(key, depth + 1)))]);
        node = [1, shape, encodeReferences(entries.map(([, child]) => visit(child, depth + 1)))];
      }
      ancestors.delete(item);
    } else throw new Error('Catalogue dictionary requires JSON values');
    return intern(node);
  }
  return { format: FORMAT, root: visit(value, 0), nodes };
}

function* unpackSteps(value: unknown): Generator<void, unknown | null, void> {
  if (!value || typeof value !== 'object' || !('format' in value)) return value;
  const packed = value as PackedHistoricalBankRateCatalogue;
  if (packed.format !== FORMAT || !Array.isArray(packed.nodes) || !packed.nodes.length ||
      packed.nodes.length > PACKED_HISTORY_LIMITS.nodes || packed.root !== packed.nodes.length - 1 ||
      Object.keys(packed).some(key => !['format', 'root', 'nodes'].includes(key))) return null;
  const values: unknown[] = [], sizes: number[] = [], depths: number[] = [];
  const shapes = new WeakSet<object>();
  let edges = 0, characters = 0, work = 0;
  for (const node of packed.nodes) {
    let decoded: unknown = node, size = 1, depth = 0;
    if (typeof node === 'string') {
      characters += node.length;
      if (characters > PACKED_HISTORY_LIMITS.characters) return null;
      size += node.length;
    } else if (Array.isArray(node)) {
      const array = node[0] === 0;
      if ((!array && node[0] !== 1) || node.length !== (array ? 2 : 3)) return null;
      const shapeRef = array ? -1 : node[1];
      if (!array && (typeof shapeRef !== 'number' || !Number.isSafeInteger(shapeRef) || shapeRef < 0 || shapeRef >= values.length)) return null;
      const keys = array ? null : values[shapeRef as number];
      if (!array) {
        if (!Array.isArray(keys) || keys.length > PACKED_HISTORY_LIMITS.objectFields) return null;
        if (!shapes.has(keys)) {
          if (!keys.every(key => typeof key === 'string') || new Set(keys).size !== keys.length) return null;
          shapes.add(keys);
        }
      }
      const references = array ? node[1] : node[2];
      if (typeof references !== 'string' || references.length > PACKED_HISTORY_LIMITS.edges * 4) return null;
      const output: unknown[] | Record<string, unknown> = array ? [] : {};
      let ref = 0, shift = 0, index = 0;
      if (!array) size += sizes[shapeRef as number];
      for (let position = 0; position < references.length; position++) {
        const part = referenceDigit(references.charCodeAt(position));
        if (part < 0 || shift > 15) return null;
        // At most four five-bit groups: the largest possible reference is
        // 1,048,575, so integer shifts stay positive and exactly representable.
        ref |= (part & 31) << shift;
        if (part & 32) { shift += 5; continue; }
        if (ref >= values.length || (shift > 0 && (part & 31) === 0) || ++edges > PACKED_HISTORY_LIMITS.edges) return null;
        size += sizes[ref]; depth = Math.max(depth, depths[ref] + 1);
        if (size > PACKED_HISTORY_LIMITS.expandedSize || depth > PACKED_HISTORY_LIMITS.depth) return null;
        if (array) (output as unknown[]).push(values[ref]);
        else {
          const key = (keys as string[])[index];
          if (key === undefined) return null;
          // Preserve JSON's own __proto__ property without mutating prototypes.
          if (key === '__proto__') Object.defineProperty(output, key, { value: values[ref], enumerable: true, writable: true, configurable: true });
          else (output as Record<string, unknown>)[key] = values[ref];
        }
        index++; ref = 0; shift = 0;
        if (++work % 512 === 0) yield;
      }
      if (shift || size > PACKED_HISTORY_LIMITS.expandedSize || (!array && index !== (keys as string[]).length)) return null;
      decoded = output;
    } else if (node !== null && typeof node !== 'boolean' && (typeof node !== 'number' || !Number.isFinite(node))) return null;
    values.push(decoded); sizes.push(size); depths.push(depth);
    if (++work % 512 === 0) yield;
  }
  return values[packed.root];
}

/** Legacy schema-v2 JSON passes through; callers validate either representation. */
export function unpackHistoricalBankRateCatalogue(value: unknown): unknown | null {
  const steps = unpackSteps(value);
  let result = steps.next();
  while (!result.done) result = steps.next();
  return result.value;
}

export async function unpackHistoricalBankRateCatalogueAsync(value: unknown, options: CatalogueCodecOptions = {}): Promise<unknown | null> {
  const yieldControl = options.yieldControl ?? (async () => (await import('../lib/yieldToUi')).yieldToUi(0));
  const sliceMs = Number.isFinite(options.sliceMs) ? Math.min(16, Math.max(0, options.sliceMs!)) : 8;
  const steps = unpackSteps(value);
  let started = Date.now(), result = steps.next();
  while (!result.done) {
    if (Date.now() - started >= sliceMs) { await yieldControl(); started = Date.now(); }
    result = steps.next();
  }
  return result.value;
}
