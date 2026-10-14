import type { CorePayload, RateRow } from '../types';
import { yieldToUi } from './yieldToUi';

/** Diagnostic capacity work. This does not measure the production cache parser.
 * Round-trip every published row and metadata field in bounded segments, and
 * keep only the lowest 25 rates while traversing instead of sorting the corpus. */
export async function benchmarkPayloadCapacity(core: CorePayload, control: {
  assertActive?: () => void;
  yieldControl?: () => Promise<void>;
  now?: () => number;
} = {}) {
  const clock = control.now ?? (() => typeof performance !== 'undefined' &&
    typeof performance.now === 'function' ? performance.now() : Date.now());
  const yieldControl = control.yieldControl ?? (() => yieldToUi(0));
  let stringifyMs = 0, parseMs = 0, traversalMs = 0;
  let payloadChars = 0, rateRows = 0, chunks = 0, maxSliceMs = 0;
  let sliceStarted = clock();
  const checkpoint = async (force = false) => {
    control.assertActive?.();
    const elapsed = clock() - sliceStarted;
    maxSliceMs = Math.max(maxSliceMs, elapsed);
    if (force || elapsed >= 8) {
      await yieldControl();
      control.assertActive?.();
      sliceStarted = clock();
    }
  };
  const roundTrip = <T,>(value: T): T => {
    control.assertActive?.();
    let at = clock();
    const serialized = JSON.stringify(value);
    stringifyMs += clock() - at;
    payloadChars += serialized.length;
    at = clock();
    const parsed = JSON.parse(serialized) as T;
    parseMs += clock() - at;
    chunks += 1;
    return parsed;
  };
  const cloneMetadata = async (value: unknown): Promise<unknown> => {
    control.assertActive?.();
    if (typeof value === 'string' && value.length > 16_384) {
      const parts: string[] = [];
      for (let offset = 0; offset < value.length; offset += 16_384) {
        parts.push(roundTrip(value.slice(offset, offset + 16_384)));
        await checkpoint();
      }
      return parts.join('');
    }
    if (Array.isArray(value)) {
      const result: unknown[] = [];
      for (let offset = 0; offset < value.length; offset += 64) {
        const batch = value.slice(offset, offset + 64);
        if (batch.every(item => item == null || typeof item === 'number' ||
            typeof item === 'boolean' || typeof item === 'string' && item.length <= 256)) {
          result.push(...roundTrip(batch));
        } else {
          for (const item of batch) result.push(item === undefined ? null : await cloneMetadata(item));
        }
        await checkpoint();
      }
      return result;
    }
    if (value !== null && typeof value === 'object') {
      const result: Record<string, unknown> = Object.create(null);
      for (const [key, field] of Object.entries(value)) {
        if (field !== undefined) result[key] = await cloneMetadata(field);
        await checkpoint();
      }
      return result;
    }
    const result = roundTrip(value);
    await checkpoint();
    return result;
  };
  const { sections, brands, ...metadata } = core;
  // Embedded history/catalogue metadata includes arbitrarily long nested
  // arrays. Walk their structure rather than serializing either whole graph.
  const parsed = { ...await cloneMetadata(metadata) as Omit<CorePayload, 'sections' | 'brands'>,
    brands: Object.create(null), sections: Object.create(null) } as CorePayload;
  await checkpoint(true);
  // Logos can dominate payload bytes. Never serialize the entire embedded
  // brand catalogue as part of the otherwise small root metadata segment.
  for (const [provider, brand] of Object.entries(brands)) {
    parsed.brands[provider] = await cloneMetadata(brand) as CorePayload['brands'][string];
    await checkpoint();
  }
  const lowestRates: Record<string, RateRow[]> = {};
  for (const [key, section] of Object.entries(sections)) {
    const { rates, ...sectionMetadata } = section;
    const reconstructed = { ...roundTrip(sectionMetadata), rates: [] as RateRow[] };
    const lowest: RateRow[] = [];
    await checkpoint();
    for (let offset = 0; offset < rates.length; offset += 64) {
      const batch = roundTrip(rates.slice(offset, offset + 64));
      await checkpoint();
      const at = clock();
      for (const row of batch) {
        reconstructed.rates.push(row);
        rateRows += 1;
        const value = Number(row.rate);
        if (!Number.isFinite(value)) continue;
        // Insert after equal rates to retain the stable original tier order.
        let index = 0;
        while (index < lowest.length && Number(lowest[index].rate) <= value) index += 1;
        if (index < 25) { lowest.splice(index, 0, row); if (lowest.length > 25) lowest.pop(); }
      }
      traversalMs += clock() - at;
      await checkpoint();
    }
    parsed.sections[key as keyof CorePayload['sections']] = reconstructed;
    lowestRates[key] = lowest;
  }
  await checkpoint(true);
  return { parsed, lowestRates, metrics: {
    measurementMode: 'segmented-payload-capacity' as const,
    payloadChars, rateRows, stringifyMs, parseMs, traversalMs, chunks,
    cpuMs: stringifyMs + parseMs + traversalMs, maxSliceMs,
    benchmarkEvidence: 'Diagnostic segmented capacity benchmark; does not measure the production cache parser.',
  } };
}
