import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { SavedRateRef } from './savedRates';
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
  if (Array.isArray(raw)) {
    for (const value of raw) {
      if (!value || typeof value !== 'object') continue;
      const item = value as Partial<TrackedRate>;
      if (typeof item.id !== 'string' || !item.id) continue;
      previous.set(item.id, item);
    }
  }
  return savedRates.map((ref) => {
    const item = previous.get(ref.id);
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
    .map(({ id, relevantDate, relevantDateKind }) => ({ id, relevantDate, relevantDateKind }));
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

async function loadTrackedRatesFromStorage(
  savedRates: readonly SavedRateRef[],
  storageKey: SecureStoreKey,
): Promise<TrackedRatesSecureLoadResult> {
  const empty = () => normalizeTrackedRates(undefined, savedRates);
  if (Platform.OS === 'web') {
    return {
      status: 'ready',
      trackedRates: normalizeTrackedRates(webMemory.get(storageKey), savedRates),
    };
  }
  let raw: string | null;
  try {
    raw = await SecureStore.getItemAsync(storageKey);
  } catch {
    return { status: 'unavailable', trackedRates: empty() };
  }
  const manifest = parseManifest(raw);
  if (!manifest) {
    try {
      // Version 1 stored the compact private-date array directly at the base key.
      return {
        status: 'ready',
        trackedRates: normalizeTrackedRates(raw ? JSON.parse(raw) : undefined, savedRates),
      };
    } catch {
      return { status: 'ready', trackedRates: empty() };
    }
  }
  const records: unknown[] = [];
  for (let index = 0; index < manifest.chunks; index += 1) {
    let chunk: string | null;
    try {
      chunk = await SecureStore.getItemAsync(chunkKey(storageKey, manifest.generation, index));
    } catch {
      return { status: 'unavailable', trackedRates: empty() };
    }
    if (!chunk) return { status: 'ready', trackedRates: empty() };
    try {
      const parsed = JSON.parse(chunk);
      if (!Array.isArray(parsed)) return { status: 'ready', trackedRates: empty() };
      records.push(...parsed);
    } catch {
      return { status: 'ready', trackedRates: empty() };
    }
  }
  return { status: 'ready', trackedRates: normalizeTrackedRates(records, savedRates) };
}

async function saveTrackedRatesToStorage(
  value: readonly TrackedRate[],
  storageKey: SecureStoreKey,
): Promise<void> {
  const copy = value.map((item) => ({ ...item }));
  if (Platform.OS === 'web') {
    webMemory.set(storageKey, copy);
    return;
  }
  const previousRaw = await SecureStore.getItemAsync(storageKey).catch(() => null);
  const previousManifest = parseManifest(previousRaw);
  const dates = privateDates(copy);
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
  if (manifest) {
    for (let index = 0; index < manifest.chunks; index += 1) {
      await SecureStore.deleteItemAsync(chunkKey(storageKey, manifest.generation, index));
    }
  }
  await SecureStore.deleteItemAsync(storageKey);
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
    .then((result) => result.trackedRates);
}

export function saveTrackedRatesAuditRollbackSecure(
  value: readonly TrackedRate[],
): Promise<void> {
  return saveTrackedRatesToStorage(value, TRACKED_RATE_AUDIT_ROLLBACK_STORAGE_KEY);
}

export function clearTrackedRatesAuditRollbackSecure(): Promise<void> {
  return clearTrackedRatesStorage(TRACKED_RATE_AUDIT_ROLLBACK_STORAGE_KEY);
}
