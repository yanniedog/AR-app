import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { SavedRateRef } from './savedRates';
import { legacyPublicOfferRefId } from './publicOfferIdentity';
import {
  defineSecureStoreKey,
  SECURE_STORE_KEYS,
  type SecureStoreKey,
} from '../lib/secureStoreKey';

export const TRACKED_RATE_SCHEMA_VERSION = 1 as const;
export const TRACKED_RATE_SECURE_STORAGE_KEY = SECURE_STORE_KEYS.trackedRateMetadata;
export const TRACKED_RATE_AUDIT_ROLLBACK_STORAGE_KEY =
  SECURE_STORE_KEYS.trackedRateAuditRollbackMetadata;
const SECURE_RECORD_SCHEMA_VERSION = 2 as const;
const MAX_SECURE_CHUNK_BYTES = 1_800;
const webMemory = new Map<string, TrackedRate[]>();
let secureWriteGeneration = 0;
let trackedRatesPersistQueue: Promise<void> = Promise.resolve();

export type TrackedRateDateKind = 'fixed-rate-end' | 'term-maturity';

/**
 * Local metadata for a saved tier. Financial scenario values deliberately do
 * not live here: they remain in the encrypted user-rate scenario on native and
 * in memory on web.
 */
export interface TrackedRate {
  schemaVersion: typeof TRACKED_RATE_SCHEMA_VERSION;
  /** Same stable identity as SavedRateRef. Exact tiers retain rateIndex. */
  id: string;
  scope: SavedRateRef['scope'];
  productKey: string;
  rateIndex: number | null;
  trackedAt: string;
  /** Rate observed when tracking began, expressed as a fraction. */
  observedRate: number | null;
  /** Optional user-entered calendar date; no account data or provider login. */
  relevantDate: string | null;
  relevantDateKind: TrackedRateDateKind | null;
}

interface PrivateTrackedRate {
  id: string;
  relevantDate: string;
  relevantDateKind: TrackedRateDateKind;
}

interface SecureRecordManifest {
  schemaVersion: typeof SECURE_RECORD_SCHEMA_VERSION;
  generation: string;
  chunks: number;
}

export interface TrackedRatesSecureLoadResult {
  status: 'ready' | 'unavailable';
  trackedRates: TrackedRate[];
  reason?: 'ambiguous-legacy-identity';
}

class AmbiguousLegacyTrackedRateError extends Error {
  constructor() { super('Ambiguous legacy tracked-rate date identity; original secure record retained for recovery'); }
}

function ambiguousLegacyId(id: string): boolean {
  if (!id.startsWith('rate:')) return false;
  const first = id.indexOf(':offer:');
  if (first < 0) return false;
  // Markers may overlap: ':offer:offer:' contains two possible boundaries.
  if (id.indexOf(':offer:', first + 1) >= 0) return true;
  const tail = id.slice(id.lastIndexOf(':') + 1);
  return Number.isInteger(Number(tail)) && String(Number(tail)) === tail;
}

function legacyDateId(productKey: string, rateIndex: number): string {
  return `legacy-rate-date-v2:${JSON.stringify([productKey, rateIndex])}`;
}

function isStructuredLegacyRate(item: Partial<TrackedRate>, ref: SavedRateRef): boolean {
  return ref.scope === 'rate' && !ref.offerId && item.productKey === ref.productKey && item.scope === ref.scope
    && item.rateIndex === ref.rateIndex && item.id === `rate:${ref.productKey}:${ref.rateIndex}`;
}

function assertUnambiguousPrivateDates(records: unknown): void {
  if (!Array.isArray(records)) return;
  for (const value of records) {
    if (value && typeof value === 'object' && typeof value.id === 'string'
      && ambiguousLegacyId(value.id) && validCalendarDate(value.relevantDate)) throw new AmbiguousLegacyTrackedRateError();
  }
}

function validatePrivateRecords(records: unknown, fullWebRecords = false): asserts records is unknown[] {
  if (!Array.isArray(records)) throw new Error('Invalid tracked-rate private record');
  for (const value of records) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.id !== 'string' || !value.id) {
      throw new Error('Invalid tracked-rate private record');
    }
    const keys = Object.keys(value);
    const compact = keys.every(key => ['id', 'relevantDate', 'relevantDateKind'].includes(key))
      && validCalendarDate(value.relevantDate) && dateKind(value.relevantDateKind);
    const full = fullWebRecords && keys.every(key => ['schemaVersion', 'id', 'scope', 'productKey', 'rateIndex', 'trackedAt', 'observedRate', 'relevantDate', 'relevantDateKind'].includes(key))
      && value.schemaVersion === TRACKED_RATE_SCHEMA_VERSION && ['rate', 'product'].includes(value.scope)
      && typeof value.productKey === 'string' && value.productKey.length > 0
      && (value.rateIndex === null || Number.isInteger(value.rateIndex))
      && typeof value.trackedAt === 'string' && value.trackedAt.length > 0
      && (value.observedRate === null || typeof value.observedRate === 'number' && Number.isFinite(value.observedRate))
      && (value.relevantDate === null && value.relevantDateKind === null
        || validCalendarDate(value.relevantDate) && dateKind(value.relevantDateKind));
    if (!compact && !full) throw new Error('Invalid tracked-rate private record');
  }
}

function validCalendarDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    ? value
    : null;
}

function dateKind(value: unknown): TrackedRateDateKind | null {
  return value === 'fixed-rate-end' || value === 'term-maturity' ? value : null;
}

export function makeTrackedRate(
  ref: SavedRateRef,
  previous?: Partial<TrackedRate> | null,
): TrackedRate {
  const relevantDate = validCalendarDate(previous?.relevantDate);
  return {
    schemaVersion: TRACKED_RATE_SCHEMA_VERSION,
    id: ref.id,
    scope: ref.scope,
    productKey: ref.productKey,
    rateIndex: ref.scope === 'rate' ? ref.rateIndex : null,
    trackedAt:
      typeof previous?.trackedAt === 'string' && previous.trackedAt
        ? previous.trackedAt
        : ref.savedAt,
    observedRate:
      typeof previous?.observedRate === 'number' && Number.isFinite(previous.observedRate)
        ? previous.observedRate
        : ref.savedRate,
    relevantDate,
    relevantDateKind: relevantDate ? dateKind(previous?.relevantDateKind) : null,
  };
}

/**
 * Migrates old Saved-only state and reconciles metadata to the current saved
 * identities. Orphaned metadata is dropped; exact tiers are never substituted.
 */
export function normalizeTrackedRates(
  raw: unknown,
  savedRates: readonly SavedRateRef[],
): TrackedRate[] {
  const previous = new Map<string, Partial<TrackedRate>>();
  const legacyCounts = new Map<string, number>();
  for (const ref of savedRates) {
    const alias = ref.scope === 'rate' && ref.offerId
      ? legacyPublicOfferRefId('rate', ref.productKey, ref.offerId) : ref.id;
    legacyCounts.set(alias, (legacyCounts.get(alias) ?? 0) + 1);
  }
  if (Array.isArray(raw)) {
    for (const value of raw) {
      if (!value || typeof value !== 'object') continue;
      const item = value as Partial<TrackedRate>;
      if (typeof item.id !== 'string' || !item.id) continue;
      previous.set(item.id, item);
    }
  }
  return savedRates.map((ref) => {
    const legacyId = ref.scope === 'rate' && ref.offerId
      ? legacyPublicOfferRefId('rate', ref.productKey, ref.offerId) : ref.id;
    // Private companions retained only the old ID. An ambiguous old ID cannot
    // authorize copying one product's date onto another semantic offer.
    const legacy = !ambiguousLegacyId(legacyId) && legacyCounts.get(legacyId) === 1 ? previous.get(legacyId) : undefined;
    const safeLegacy = legacy && (legacy.productKey === undefined || legacy.productKey === ref.productKey)
      && (legacy.scope === undefined || legacy.scope === ref.scope) ? legacy : undefined;
    const direct = previous.get(ref.id);
    const safeDirect = direct && ((!ambiguousLegacyId(ref.id) && (legacyCounts.get(ref.id) ?? 0) <= 1)
      || isStructuredLegacyRate(direct, ref)) ? direct : undefined;
    const encodedLegacy = ref.scope === 'rate' && !ref.offerId && ref.rateIndex != null
      ? previous.get(legacyDateId(ref.productKey, ref.rateIndex)) : undefined;
    const item = safeDirect ?? encodedLegacy ?? safeLegacy;
    const identityContradicts = !!item && (
      (item.scope !== undefined && item.scope !== ref.scope) ||
      (item.productKey !== undefined && item.productKey !== ref.productKey) ||
      (item.rateIndex !== undefined && item.rateIndex !== (ref.scope === 'rate' ? ref.rateIndex : null))
    );
    return makeTrackedRate(
      ref,
      identityContradicts
        ? {
            relevantDate: item?.relevantDate,
            relevantDateKind: item?.relevantDateKind,
          }
        : item,
    );
  });
}

export function setTrackedRateDate(
  trackedRates: readonly TrackedRate[],
  id: string,
  relevantDate: string | null,
  relevantDateKind: TrackedRateDateKind | null,
): TrackedRate[] {
  const normalizedDate = relevantDate == null ? null : validCalendarDate(relevantDate);
  if (relevantDate != null && !normalizedDate) {
    throw new RangeError('Relevant date must be a real YYYY-MM-DD calendar date');
  }
  if (normalizedDate && !dateKind(relevantDateKind)) {
    throw new RangeError('A relevant date requires a supported date kind');
  }
  return trackedRates.map((tracked) => tracked.id === id
    ? {
        ...tracked,
        relevantDate: normalizedDate,
        relevantDateKind: normalizedDate ? relevantDateKind : null,
      }
    : tracked);
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function privateDates(value: readonly TrackedRate[]): PrivateTrackedRate[] {
  return value
    .filter((item): item is TrackedRate & {
      relevantDate: string;
      relevantDateKind: TrackedRateDateKind;
    } => !!item.relevantDate && !!item.relevantDateKind)
    .map((item) => {
      let id = item.id;
      if (ambiguousLegacyId(id)) {
        if (item.scope !== 'rate' || item.rateIndex == null || !Number.isInteger(item.rateIndex) || id !== `rate:${item.productKey}:${item.rateIndex}`) {
          throw new AmbiguousLegacyTrackedRateError();
        }
        // A current, structured legacy rate is unambiguous. Give its private
        // date a tagged key rather than creating a new ambiguous old record.
        id = legacyDateId(item.productKey, item.rateIndex);
      }
      return { id, relevantDate: item.relevantDate, relevantDateKind: item.relevantDateKind };
    });
}

function secureChunks(value: readonly PrivateTrackedRate[]): string[] {
  const chunks: string[] = [];
  let current: PrivateTrackedRate[] = [];
  for (const item of value) {
    const candidate = JSON.stringify([...current, item]);
    if (utf8ByteLength(candidate) <= MAX_SECURE_CHUNK_BYTES) {
      current.push(item);
      continue;
    }
    if (!current.length) {
      throw new Error('A tracked-rate identity is too large for secure device storage');
    }
    chunks.push(JSON.stringify(current));
    current = [item];
    if (utf8ByteLength(JSON.stringify(current)) > MAX_SECURE_CHUNK_BYTES) {
      throw new Error('A tracked-rate identity is too large for secure device storage');
    }
  }
  if (current.length) chunks.push(JSON.stringify(current));
  return chunks;
}

function parseManifest(raw: string | null): SecureRecordManifest | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SecureRecordManifest>;
    return value.schemaVersion === SECURE_RECORD_SCHEMA_VERSION &&
      typeof value.generation === 'string' &&
      /^[a-z0-9-]+$/i.test(value.generation) &&
      Number.isInteger(value.chunks) &&
      (value.chunks ?? 0) > 0 &&
      (value.chunks ?? 0) <= 10_000
      ? value as SecureRecordManifest
      : null;
  } catch {
    return null;
  }
}

function chunkKey(
  storageKey: SecureStoreKey,
  generation: string,
  index: number,
): SecureStoreKey {
  return defineSecureStoreKey(`${storageKey}.chunk.${generation}.${index}`);
}

async function readPrivateRecords(
  storageKey: SecureStoreKey,
  previousRaw?: string | null,
): Promise<unknown[]> {
  if (Platform.OS === 'web') {
    const records = webMemory.get(storageKey) ?? [];
    validatePrivateRecords(records, true);
    return records;
  }
  const raw = previousRaw === undefined ? await SecureStore.getItemAsync(storageKey) : previousRaw;
  const manifest = parseManifest(raw);
  if (!manifest) {
    // Version 1 stored the compact private-date array directly at the base key.
    const value: unknown = raw === null ? [] : JSON.parse(raw);
    validatePrivateRecords(value);
    return value;
  }
  const records: unknown[] = [];
  for (let index = 0; index < manifest.chunks; index += 1) {
    const chunk = await SecureStore.getItemAsync(chunkKey(storageKey, manifest.generation, index));
    if (!chunk) throw new Error('Missing tracked-rate private chunk');
    const parsed: unknown = JSON.parse(chunk);
    validatePrivateRecords(parsed);
    records.push(...parsed);
  }
  return records;
}

async function loadTrackedRatesFromStorage(
  savedRates: readonly SavedRateRef[],
  storageKey: SecureStoreKey,
): Promise<TrackedRatesSecureLoadResult> {
  try {
    const records = await readPrivateRecords(storageKey);
    assertUnambiguousPrivateDates(records);
    return { status: 'ready', trackedRates: normalizeTrackedRates(records, savedRates) };
  } catch (error) {
    return { status: 'unavailable', trackedRates: normalizeTrackedRates(undefined, savedRates),
      ...(error instanceof AmbiguousLegacyTrackedRateError ? { reason: 'ambiguous-legacy-identity' as const } : {}) };
  }
}

async function saveTrackedRatesToStorage(
  value: readonly TrackedRate[],
  storageKey: SecureStoreKey,
): Promise<void> {
  const copy = value.map((item) => ({ ...item }));
  const dates = privateDates(copy);
  validatePrivateRecords(dates);
  if (Platform.OS === 'web') {
    assertUnambiguousPrivateDates(await readPrivateRecords(storageKey));
    webMemory.set(storageKey, copy.map(item => ambiguousLegacyId(item.id) && item.relevantDate && item.rateIndex != null
      ? { ...item, id: legacyDateId(item.productKey, item.rateIndex) } : item));
    return;
  }
  const previousRaw = await SecureStore.getItemAsync(storageKey);
  assertUnambiguousPrivateDates(await readPrivateRecords(storageKey, previousRaw));
  const previousManifest = parseManifest(previousRaw);
  if (!dates.length) {
    await SecureStore.setItemAsync(storageKey, '[]', {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } else {
    const chunks = secureChunks(dates);
    const generation = `${Date.now().toString(36)}-${(++secureWriteGeneration).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    let writtenChunks = 0;
    try {
      for (let index = 0; index < chunks.length; index += 1) {
        await SecureStore.setItemAsync(chunkKey(storageKey, generation, index), chunks[index], {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
        writtenChunks += 1;
      }
      const manifest: SecureRecordManifest = {
        schemaVersion: SECURE_RECORD_SCHEMA_VERSION,
        generation,
        chunks: chunks.length,
      };
      // Commit the manifest last. A failed chunk write leaves the previous
      // generation readable rather than replacing it with a partial record.
      await SecureStore.setItemAsync(storageKey, JSON.stringify(manifest), {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    } catch (error) {
      for (let index = 0; index < writtenChunks; index += 1) {
        await SecureStore.deleteItemAsync(chunkKey(storageKey, generation, index)).catch(() => undefined);
      }
      throw error;
    }
  }
  if (previousManifest) {
    for (let index = 0; index < previousManifest.chunks; index += 1) {
      await SecureStore.deleteItemAsync(
        chunkKey(storageKey, previousManifest.generation, index),
      ).catch(() => undefined);
    }
  }
}

async function clearTrackedRatesStorage(storageKey: SecureStoreKey): Promise<void> {
  if (Platform.OS === 'web') {
    webMemory.delete(storageKey);
    return;
  }
  const raw = await SecureStore.getItemAsync(storageKey).catch(() => null);
  const manifest = parseManifest(raw);
  // Commit the deletion first so interrupted best-effort chunk cleanup cannot
  // leave a manifest pointing at a partially deleted generation.
  await SecureStore.deleteItemAsync(storageKey);
  if (manifest) {
    for (let index = 0; index < manifest.chunks; index += 1) {
      await SecureStore.deleteItemAsync(
        chunkKey(storageKey, manifest.generation, index),
      ).catch(() => undefined);
    }
  }
}

/** User-entered dates never enter general AsyncStorage. */
export function loadTrackedRatesSecure(
  savedRates: readonly SavedRateRef[],
): Promise<TrackedRate[]> {
  return loadTrackedRatesFromStorage(savedRates, TRACKED_RATE_SECURE_STORAGE_KEY)
    .then((result) => result.trackedRates);
}

export function loadTrackedRatesSecureResult(
  savedRates: readonly SavedRateRef[],
): Promise<TrackedRatesSecureLoadResult> {
  return loadTrackedRatesFromStorage(savedRates, TRACKED_RATE_SECURE_STORAGE_KEY);
}

export function saveTrackedRatesSecure(value: readonly TrackedRate[]): Promise<void> {
  return saveTrackedRatesToStorage(value, TRACKED_RATE_SECURE_STORAGE_KEY);
}

/** Serialize every live-key write so stale native promises cannot win a race. */
export function queueTrackedRatesSecureSave(value: readonly TrackedRate[]): Promise<void> {
  const snapshot = value.map((item) => ({ ...item }));
  const pending = trackedRatesPersistQueue
    .catch(() => undefined)
    .then(() => saveTrackedRatesSecure(snapshot));
  trackedRatesPersistQueue = pending;
  return pending;
}

export function loadTrackedRatesAuditRollbackSecure(
  savedRates: readonly SavedRateRef[],
): Promise<TrackedRate[]> {
  return loadTrackedRatesFromStorage(savedRates, TRACKED_RATE_AUDIT_ROLLBACK_STORAGE_KEY)
    .then((result) => {
      if (result.reason === 'ambiguous-legacy-identity') throw new AmbiguousLegacyTrackedRateError();
      if (result.status === 'unavailable') throw new Error('Performance audit rollback tracked-rate metadata is unavailable; journal retained for recovery');
      return result.trackedRates;
    });
}

export function saveTrackedRatesAuditRollbackSecure(
  value: readonly TrackedRate[],
): Promise<void> {
  return saveTrackedRatesToStorage(value, TRACKED_RATE_AUDIT_ROLLBACK_STORAGE_KEY);
}

export function clearTrackedRatesAuditRollbackSecure(): Promise<void> {
  return clearTrackedRatesStorage(TRACKED_RATE_AUDIT_ROLLBACK_STORAGE_KEY);
}
