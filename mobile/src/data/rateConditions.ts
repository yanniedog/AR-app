import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import type { CorePayload, DetailsPayload, Manifest, RateConditionEntry, RateConditions, RateRow, SectionKey } from '../types';
import type { CoreIntegrityContext } from './sectionIntegrity';
import { verifiedDetailsSha } from './detailsIdentity';

export interface RateConditionContext { core: CorePayload | null; details: DetailsPayload | null; manifest: Manifest | null; coreIntegrity: CoreIntegrityContext | null }
export interface ScopedRateConditions {
  status: 'available' | 'unavailable'; reason: string; entries: RateConditionEntry[];
  sourceSha256: string | null; generationId: string | null; coreSha256: string | null; detailsSha256: string | null;
}
const hex = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const pointer = (value: unknown): value is string => typeof value === 'string' && value.length <= 512 && /^\/[A-Za-z0-9/]+$/.test(value);
const keys = (value: object, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));
export function rateConditionId(sourceSha: string, sourcePointer: string): string { return bytesToHex(sha256(utf8ToBytes(JSON.stringify([sourceSha, sourcePointer])))); }
export function validRateConditions(value: unknown): value is RateConditions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const e = value as RateConditions;
  if (!keys(e, ['schemaVersion', 'sourceSha256', 'entries']) || e.schemaVersion !== 1 || !hex(e.sourceSha256) || !Array.isArray(e.entries) || !e.entries.length || e.entries.length > 1024) return false;
  try { if (utf8ToBytes(JSON.stringify(e)).length > 1048576) return false; } catch { return false; }
  const ids = new Set<string>();
  const ordinalPointers = new Map<string, string>(), pointerOrdinals = new Map<string, number>();
  let sourceRoot: string | undefined;
  for (const row of e.entries) {
    if (!row || !keys(row, ['id', 'rateFamily', 'rateIndex', 'rateSourcePointer', 'tierSourcePointer', 'sourcePointer', 'text']) || !hex(row.id) || ids.has(row.id) || !['deposit', 'lending'].includes(row.rateFamily) || !Number.isSafeInteger(row.rateIndex) || row.rateIndex < 1 ||
        !pointer(row.rateSourcePointer) || !pointer(row.sourcePointer) || typeof row.text !== 'string' || !row.text.trim() || utf8ToBytes(row.text).length > 16384) return false;
    const family = row.rateFamily === 'deposit' ? 'depositRates' : 'lendingRates';
    const match = row.rateSourcePointer.match(new RegExp(`^(/data)?/${family}/(?:0|[1-9][0-9]*)$`));
    if (!match) return false;
    const root = match[1] ?? '';
    if (sourceRoot !== undefined && sourceRoot !== root) return false;
    sourceRoot = root;
    const ordinal = `${row.rateFamily}:${row.rateIndex}`;
    if ((ordinalPointers.has(ordinal) && ordinalPointers.get(ordinal) !== row.rateSourcePointer) ||
        (pointerOrdinals.has(row.rateSourcePointer) && pointerOrdinals.get(row.rateSourcePointer) !== row.rateIndex)) return false;
    ordinalPointers.set(ordinal, row.rateSourcePointer); pointerOrdinals.set(row.rateSourcePointer, row.rateIndex);
    let base = row.rateSourcePointer;
    if (row.tierSourcePointer !== undefined) {
      if (!pointer(row.tierSourcePointer) || !new RegExp(`^${base}/tiers/(?:0|[1-9][0-9]*)$`).test(row.tierSourcePointer)) return false;
      base = row.tierSourcePointer;
    }
    const suffix = row.sourcePointer.slice(base.length);
    if (!row.sourcePointer.startsWith(`${base}/`) || !/^\/(?:additionalInfo|applicabilityConditions\/(?:(?:0|[1-9][0-9]*)\/)?additionalInfo)$/.test(suffix) ||
        row.id !== rateConditionId(e.sourceSha256, row.sourcePointer)) return false;
    ids.add(row.id);
  }
  return true;
}

export function scopedRateConditions(row: RateRow, section: SectionKey, context?: RateConditionContext): ScopedRateConditions {
  const unavailable = (reason: string): ScopedRateConditions => ({ status: 'unavailable', reason, entries: [], sourceSha256: null, generationId: null, coreSha256: null, detailsSha256: null });
  if (!Number.isSafeInteger(row.rate_index) || row.rate_index! < 1) return unavailable('Rate conditions unavailable: an exact published rate index is required.');
  const { core, details, manifest, coreIntegrity } = context ?? {};
  if (!core || !details || !manifest || !coreIntegrity || coreIntegrity.core !== core || coreIntegrity.runDate !== core.run_date || coreIntegrity.coreSha256 !== manifest.files.core.sha256 ||
      !hex(manifest.files.core.sha256) || !hex(manifest.files.details.sha256) || verifiedDetailsSha(details) !== manifest.files.details.sha256 ||
      core.run_date !== details.run_date || core.run_date !== manifest.run_date || !core.sections[section]?.rates.includes(row)) return unavailable('Rate conditions unavailable: this rate and details are not verified from the same publication.');
  const value = details.products[row.product_key]?.rateConditions;
  if (value === undefined) return unavailable('Rate conditions unavailable in this publication. This does not mean the rate is unconditional.');
  if (!validRateConditions(value)) return unavailable('Rate conditions unavailable: the published condition record is invalid.');
  const family = section === 'Mortgage' ? 'lending' : 'deposit';
  const entries = value.entries.filter(entry => entry.rateFamily === family && entry.rateIndex === row.rate_index);
  if (!entries.length) return unavailable('No rate-condition wording was supplied for this exact row. Eligibility remains unassessed.');
  return { status: 'available', reason: 'Published wording for this exact rate row. This is not an eligibility decision.', entries,
    sourceSha256: value.sourceSha256, generationId: manifest.payload_revision?.generation_id ?? null,
    coreSha256: manifest.files.core.sha256, detailsSha256: manifest.files.details.sha256 };
}
