import { SECTION_KEYS } from '../types';
import { isValidCalendarDate } from '../lib/calendarDate';
import { validateRevisionHead, type PayloadRevisionHead } from './payloadRevision';
import { READY_HISTORY_LIMITS, type HistoricalBankRateReady, type ReadyHistoryCohort } from './historicalBankRateReadyWire';
import { validateHistoricalBankRateReadyForApp, type ReadyHistorySource } from './historicalBankRateReady';
import { compressCatalogueAsync, decompressCatalogueAsync, type CatalogueCodecOptions, type CompressedCatalogue } from './historicalBankRateCatalogueCompression';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

export const READY_RETENTION_MAX_TEXT = 2 * 1024 * 1024;
const MAX_DECODED = 6 * 1024 * 1024;
export interface RetainedReadyHistory {
  schema_version: 1;
  ready: HistoricalBankRateReady | null;
  heads: Record<string, PayloadRevisionHead>;
  conflicts: string[];
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const archives = new WeakMap<HistoricalBankRateReady, CompressedCatalogue>();
const legacyReceipts = new WeakSet<RetainedReadyHistory>();
const archiveMetadata = (value: unknown): value is CompressedCatalogue => object(value) && typeof value.sha256 === 'string' &&
  /^[a-f0-9]{64}$/.test(value.sha256) && Number.isSafeInteger(value.bytes) && Number(value.bytes) > 0 &&
  Number(value.bytes) <= READY_HISTORY_LIMITS.decodedBytes && typeof value.gzip_base64 === 'string' &&
  value.gzip_base64.length > 0 && value.gzip_base64.length % 4 === 0 && value.gzip_base64.length <= Math.ceil(1024 * 1024 / 3) * 4;
const copyArchive = (value: CompressedCatalogue): CompressedCatalogue => ({ sha256: value.sha256, bytes: value.bytes, gzip_base64: value.gzip_base64 });
const metadataDigest = (archive: CompressedCatalogue | null, heads: unknown, conflicts: unknown) =>
  bytesToHex(sha256(utf8ToBytes(JSON.stringify([archive?.sha256 ?? null, heads, conflicts]))));

/** Only verified decompression can create a reusable archive receipt. Callers
 * cannot attach foreign bytes to an unrelated prepared object. */
export async function decodeReadyHistoryArchive(archive: CompressedCatalogue, options: CatalogueCodecOptions = {}): Promise<HistoricalBankRateReady | null> {
  if (!archiveMetadata(archive)) return null;
  const receipt = copyArchive(archive);
  const value = await decompressCatalogueAsync(receipt, options);
  if (!validateHistoricalBankRateReadyForApp(value)) return null;
  archives.set(value, receipt);
  return value;
}
export const needsRetainedReadyMigration = (value: RetainedReadyHistory | null): boolean => !!value && legacyReceipts.has(value);
let decodedReceipt: { text: string; value: RetainedReadyHistory } | null = null;
export async function decodeRetainedReadyHistory(text: string, yieldWork: () => Promise<void>): Promise<RetainedReadyHistory | null> {
  if (!text || text.length > READY_RETENTION_MAX_TEXT) return null;
  // All adopted history is immutable. Preserve identity across equal cache
  // reads so preparation and profile caches stay warm; retain only one slot.
  if (decodedReceipt?.text === text) return decodedReceipt.value;
  try {
    const envelope = JSON.parse(text) as CompressedCatalogue & { schema_version?: number };
    const version2 = envelope?.schema_version === 2;
    let value: unknown;
    if (version2) {
      const wire = envelope as unknown as Record<string, unknown>;
      if (!object(wire.metadata) || (wire.ready !== null && !archiveMetadata(wire.ready)) ||
        typeof wire.metadata_sha256 !== 'string' || wire.metadata_sha256 !== metadataDigest(wire.ready as CompressedCatalogue | null, wire.metadata.heads, wire.metadata.conflicts)) return null;
      value = { schema_version: 1, ready: wire.ready === null ? null :
        await decompressCatalogueAsync(wire.ready as CompressedCatalogue, { yieldControl: yieldWork }),
      heads: wire.metadata.heads, conflicts: wire.metadata.conflicts };
      if (wire.ready !== null && !(value as { ready: unknown }).ready) return null;
    } else {
      if (!envelope || !Number.isSafeInteger(envelope.bytes) || envelope.bytes > MAX_DECODED) return null;
      value = await decompressCatalogueAsync(envelope, { yieldControl: yieldWork });
    }
    if (!object(value) || value.schema_version !== 1 || !object(value.heads) || Object.keys(value.heads).length > 5000 ||
      !Array.isArray(value.conflicts) || value.conflicts.length > 5000 ||
      !value.conflicts.every(day => typeof day === 'string' && Object.hasOwn(value.heads as object, day))) return null;
    for (const [day, head] of Object.entries(value.heads)) {
      if (!isValidCalendarDate(day)) return null;
      validateRevisionHead(head, day, 'yanniedog/AR-local');
    }
    // A compiler upgrade invalidates derived values, but must retain the
    // independent monotonic public revision receipts.
    let ready: HistoricalBankRateReady | null = null;
    if (value.ready !== null && object(value.ready)) {
      if (validateHistoricalBankRateReadyForApp(value.ready)) ready = value.ready;
      else if (typeof value.ready.compiler_sha256 !== 'string') return null;
    } else if (value.ready !== null) return null;
    const heads = value.heads as Record<string, PayloadRevisionHead>, conflicts = value.conflicts as string[];
    if (ready && Object.entries(ready.sources).some(([day, source]) => source.kind !== 'published_core' ||
      source.manifest_sha256 !== heads[day]?.manifest_sha256 || conflicts.includes(day))) return null;
    const result: RetainedReadyHistory = { schema_version: 1, ready, heads, conflicts };
    if (version2 && ready) archives.set(ready, copyArchive((envelope as unknown as { ready: CompressedCatalogue }).ready));
    if (!version2) legacyReceipts.add(result);
    decodedReceipt = { text, value: result };
    return result;
  } catch { return null; }
}
export async function encodeRetainedReadyHistory(value: RetainedReadyHistory, yieldWork: () => Promise<void>): Promise<string> {
  if (Object.keys(value.heads).length > 5000 || value.conflicts.length > 5000) throw new Error('Retained revision receipts exceed capacity; previous checkpoint preserved');
  const archive = value.ready ? archives.get(value.ready) ?? await compressCatalogueAsync(value.ready, { yieldControl: yieldWork }) : null;
  if (archive && !archiveMetadata(archive)) throw new Error('Retained prepared history exceeds decoded capacity; previous checkpoint preserved');
  if (archive && value.ready) archives.set(value.ready, copyArchive(archive));
  const text = JSON.stringify({ schema_version: 2, ready: archive, metadata: { heads: value.heads, conflicts: value.conflicts },
    metadata_sha256: metadataDigest(archive, value.heads, value.conflicts) });
  if (text.length > READY_RETENTION_MAX_TEXT) throw new Error('Retained prepared history exceeds cache capacity; previous checkpoint preserved');
  return text;
}

/** Clip already-classified cohorts to disjoint public date masks. Frequency
 * intervals are intersected with mask runs, never expanded into tier/day cells. */
export async function compactPublicReadyHistory(inputs: readonly ReadyHistorySource[], yieldWork: () => Promise<void>): Promise<HistoricalBankRateReady | null> {
  if (inputs.some(input => !validateHistoricalBankRateReadyForApp(input.ready) ||
    input.acceptedDates.some(day => !Object.hasOwn(input.ready.sources, day) || Object.hasOwn(input.ready.unavailable_dates, day)))) throw new Error('Invalid retained prepared input');
  const dates = [...new Set(inputs.flatMap(input => [...input.acceptedDates]))].sort();
  if (!dates.length) return null;
  if (inputs.length === 1 && dates.length === inputs[0].acceptedDates.length &&
      dates.length === Object.keys(inputs[0].ready.sources).length &&
      Object.values(inputs[0].ready.sources).every(source => source.kind === 'published_core')) return inputs[0].ready;
  const first = Date.parse(dates[0]), length = (Date.parse(dates.at(-1)!) - first) / 86_400_000 + 1;
  if (length > READY_HISTORY_LIMITS.days) throw new Error('Retained prepared calendar exceeds capacity');
  const result: HistoricalBankRateReady = { schema_version: 1, semantic_revision: inputs[0].ready.semantic_revision,
    compiler_sha256: inputs[0].ready.compiler_sha256,
    run_dates: Array.from({ length }, (_, i) => new Date(first + i * 86_400_000).toISOString().slice(0, 10)),
    sources: {}, unavailable_dates: {}, quarantined_tier_count: 0,
    sections: { Mortgage: [], Savings: [], TD: [] }, products: { Mortgage: [], Savings: [], TD: [] } };
  let started = Date.now(), work = 0, eventChanges = 0;
  const checkpoint = async () => { if (++work % 32 === 0 && Date.now() - started >= 8) { await yieldWork(); started = Date.now(); } };
  const masks = inputs.map(input => {
    const accepted = new Set(input.acceptedDates), runs: [number, number][] = [];
    for (let position = 0; position < input.ready.run_dates.length; position++) {
      const day = input.ready.run_dates[position];
      if (!accepted.has(day)) continue;
      const source = input.ready.sources[day];
      if (!source || source.kind !== 'published_core' || Object.hasOwn(result.sources, day)) throw new Error('Retained source masks must be disjoint public observations');
      result.sources[day] = source;
      const prior = runs.at(-1);
      if (prior && prior[1] === position) prior[1]++; else runs.push([position, position + 1]);
    }
    return { ...input, runs, offset: (Date.parse(input.ready.run_dates[0]) - first) / 86_400_000 };
  });
  for (const day of result.run_dates) if (!Object.hasOwn(result.sources, day)) result.unavailable_dates[day] = 'No retained public observation';
  for (const section of SECTION_KEYS) {
    const cohorts = new Map<string, { cohort: ReadyHistoryCohort; events: Map<number, Map<number, number>> }>();
    const products = new Map<string, [number, number, number][]>();
    for (const input of masks) {
      for (const cohort of input.ready.sections[section]) {
        if (!input.runs.length) continue;
        const identity = JSON.stringify(cohort.slice(0, 5));
        let target = cohorts.get(identity);
        const counts = new Map<number, number>(); let run = 0;
        for (let i = 0; i < cohort[5].length; i++) {
          const [date, deltas] = cohort[5][i], end = cohort[5][i + 1]?.[0] ?? input.ready.run_dates.length;
          for (const [rate, delta] of deltas) { const next = (counts.get(rate) ?? 0) + delta; if (next) counts.set(rate, next); else counts.delete(rate); }
          while (run < input.runs.length && input.runs[run][1] <= date) run++;
          for (let selected = run; counts.size && selected < input.runs.length && input.runs[selected][0] < end; selected++) {
            const start = Math.max(date, input.runs[selected][0]) + input.offset;
            const stop = Math.min(end, input.runs[selected][1]) + input.offset;
            if (start >= stop) continue;
            if (!target) { target = { cohort: [cohort[0], cohort[1], cohort[2], cohort[3], cohort[4], []], events: new Map() }; cohorts.set(identity, target); }
            for (const [position, sign] of [[start, 1], [stop, -1]]) {
              const changes = target.events.get(position) ?? new Map<number, number>();
              for (const [rate, count] of counts) {
                if (++eventChanges > READY_HISTORY_LIMITS.changes * 4) throw new Error('Retained timeline exceeds merge capacity');
                const next = (changes.get(rate) ?? 0) + sign * count;
                if (next) changes.set(rate, next); else changes.delete(rate);
              }
              target.events.set(position, changes);
            }
          }
          await checkpoint();
        }
      }
      for (const [key, spans] of input.ready.products[section]) {
        let run = 0;
        for (const [start, count, rate] of spans) {
          while (run < input.runs.length && input.runs[run][1] <= start) run++;
          for (let selected = run; selected < input.runs.length && input.runs[selected][0] < start + count; selected++) {
            const firstDay = Math.max(start, input.runs[selected][0]), end = Math.min(start + count, input.runs[selected][1]);
            if (firstDay >= end) continue;
            const target = products.get(key) ?? []; target.push([firstDay + input.offset, end - firstDay, rate]); products.set(key, target);
          }
          await checkpoint();
        }
      }
    }
    for (const target of cohorts.values()) {
      target.cohort[5] = [...target.events].filter(([, rates]) => rates.size).sort(([a], [b]) => a - b)
        .map(([day, rates]) => [day, [...rates].sort(([a], [b]) => a - b)]);
      if (target.cohort[5].length) result.sections[section].push(target.cohort);
      await checkpoint();
    }
    for (const [key, spans] of products) {
      const merged: [number, number, number][] = [];
      for (const span of spans.sort(([a], [b]) => a - b)) {
        const prior = merged.at(-1);
        if (prior && prior[0] + prior[1] === span[0] && prior[2] === span[2]) prior[1] += span[1]; else merged.push([...span]);
      }
      result.products[section].push([key, merged]); await checkpoint();
    }
  }
  await yieldWork();
  if (!validateHistoricalBankRateReadyForApp(result)) throw new Error('Retained prepared history failed bounded validation');
  return result;
}
