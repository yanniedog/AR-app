import { compressCatalogue, decompressCatalogue } from '../data/historicalBankRateCatalogueCompression';

/** Complete JSON compressed with a fixed gzip timestamp so retries reuse the same
 * content hash and deletion receipt. Compression follows deidentification. */
export function encodeCompressedDiagnosticJson(value: Record<string, unknown>, header?: Record<string, unknown>): string {
  return JSON.stringify({ ...header, format: 'ar-audit-gzip-v1',
    encoding: 'gzip_base64=base64(gzip(UTF-8 JSON)); sha256=SHA-256(decoded UTF-8); bytes=decoded UTF-8 length',
    ...compressCatalogue(value, { deterministic: true }) });
}

/** Lossless JSON dictionary encoding. Numbers, false and null retain their meaning. */
export function encodeCompactDiagnosticJson(value: unknown, header?: Record<string, unknown>): string {
  const strings: string[] = [];
  const indexes = new Map<string, number>();
  const intern = (text: string) => {
    let index = indexes.get(text);
    if (index === undefined) { index = strings.length; strings.push(text); indexes.set(text, index); }
    return index;
  };
  const encode = (item: unknown): unknown => {
    if (typeof item === 'string') return [intern(item)];
    if (Array.isArray(item)) return ['a', ...item.map(encode)];
    if (item && typeof item === 'object') {
      const entries: unknown[] = ['o'];
      for (const [key, child] of Object.entries(item)) {
        if (child !== undefined) entries.push(intern(key), encode(child));
      }
      return entries;
    }
    return item;
  };
  const encoded = encode(value);
  const repeated = new Map<string, { value: unknown[]; count: number; index?: number }>();
  const signature = (item: unknown[]): string | null => {
    if (item[0] !== 'o' || item.length > 65) return null;
    const text = JSON.stringify(item);
    return text.length >= 32 && text.length <= 1024 ? text : null;
  };
  const count = (item: unknown) => {
    if (!Array.isArray(item)) return;
    item.forEach(count);
    const key = signature(item);
    if (key) {
      const found = repeated.get(key);
      if (found) found.count++;
      else repeated.set(key, { value: item, count: 1 });
    }
  };
  count(encoded);
  const entries = [...repeated.entries()].filter(([, item]) => item.count > 1);
  entries.forEach(([, item], index) => { item.index = index; });
  const compact = (item: unknown, ownKey?: string): unknown => {
    if (!Array.isArray(item)) return item;
    const key = signature(item);
    const index = key ? repeated.get(key)?.index : undefined;
    if (key !== ownKey && index !== undefined) return ['r', index];
    return item.map(child => compact(child));
  };
  const templates = entries.map(([key, item]) => compact(item.value, key));
  return JSON.stringify({ ...header, format: 'ar-audit-dict-v1',
    encoding: '[n]=strings[n]; ["a",...]=array; ["o",keyIndex,value,...]=object; ["r",n]=templates[n]',
    strings, templates, data: compact(encoded) });
}

/** Accept gzip, dictionary and plain reports so existing pasted evidence stays readable. */
export function decodeCompactDiagnosticJson(text: string): unknown {
  const input = JSON.parse(text);
  if (input?.format === 'ar-audit-gzip-v1') {
    const decoded = decompressCatalogue(input);
    // A diagnostic is an object; null is also the codec's invalid-input result.
    if (!decoded || typeof decoded !== 'object') throw new Error('Invalid compressed diagnostic report');
    return decoded;
  }
  if (input?.format !== 'ar-audit-dict-v1') return input;
  if (!Array.isArray(input.strings) || !input.strings.every((value: unknown) => typeof value === 'string')) throw new Error('Invalid diagnostic dictionary');
  const stringAt = (index: unknown): string => {
    if (!Number.isSafeInteger(index) || (index as number) < 0 || (index as number) >= input.strings.length) throw new Error('Invalid diagnostic string reference');
    return input.strings[index as number];
  };
  const active = new Set<number>();
  const decode = (item: unknown): unknown => {
    if (!Array.isArray(item)) return item;
    if (item.length === 1 && typeof item[0] === 'number') return stringAt(item[0]);
    if (item[0] === 'r') {
      const index = item[1];
      if (item.length !== 2 || !Number.isSafeInteger(index) || index < 0 ||
        !Array.isArray(input.templates) || index >= input.templates.length || active.has(index)) throw new Error('Invalid diagnostic template reference');
      active.add(index);
      try { return decode(input.templates[index]); } finally { active.delete(index); }
    }
    if (item[0] === 'a') return item.slice(1).map(decode);
    if (item[0] !== 'o' || item.length % 2 !== 1) throw new Error('Invalid diagnostic value');
    const result: Record<string, unknown> = {};
    for (let i = 1; i < item.length; i += 2) {
      Object.defineProperty(result, stringAt(item[i]), { value: decode(item[i + 1]), enumerable: true, configurable: true, writable: true });
    }
    return result;
  };
  return decode(input.data);
}
