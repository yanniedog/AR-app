import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { SavedRateRef } from './savedRates';

export const TRACKED_RATE_SCHEMA_VERSION = 1 as const;
const SECURE_STORAGE_KEY = 'ar-rates.tracked-rate-metadata.v1';
let webMemory: TrackedRate[] = [];

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
  return savedRates.map((ref) => makeTrackedRate(ref, previous.get(ref.id)));
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

/** User-entered dates never enter general AsyncStorage. */
export async function loadTrackedRatesSecure(
  savedRates: readonly SavedRateRef[],
): Promise<TrackedRate[]> {
  if (Platform.OS === 'web') return normalizeTrackedRates(webMemory, savedRates);
  const raw = await SecureStore.getItemAsync(SECURE_STORAGE_KEY);
  return normalizeTrackedRates(raw ? JSON.parse(raw) : undefined, savedRates);
}

export async function saveTrackedRatesSecure(value: readonly TrackedRate[]): Promise<void> {
  const copy = value.map((item) => ({ ...item }));
  if (Platform.OS === 'web') {
    webMemory = copy;
    return;
  }
  // Product identity and observed advertised rates are public catalogue data.
  // Only user-entered dates need the encrypted record, keeping SecureStore
  // small even for a long watchlist.
  const privateDates = copy
    .filter((item) => item.relevantDate && item.relevantDateKind)
    .map(({ id, relevantDate, relevantDateKind }) => ({ id, relevantDate, relevantDateKind }));
  await SecureStore.setItemAsync(SECURE_STORAGE_KEY, JSON.stringify(privateDates), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}
