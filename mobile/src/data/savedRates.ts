import type { CorePayload, RateRow, SectionKey } from '../types';
import { toFraction } from './format';

export interface SavedRateRef {
  schemaVersion: 1;
  id: string;
  scope: 'rate' | 'product';
  productKey: string;
  rateIndex: number | null;
  savedAt: string;
  savedRate: number | null;
}

export interface ResolvedSavedRate {
  ref: SavedRateRef;
  row: RateRow;
  section: SectionKey;
}

export function unresolvedSavedRateRefs(
  refs: readonly SavedRateRef[],
  resolved: readonly ResolvedSavedRate[],
): SavedRateRef[] {
  const resolvedIds = new Set(resolved.map((item) => item.ref.id));
  return refs.filter((ref) => !resolvedIds.has(ref.id));
}

export function savedRateId(productKey: string, rateIndex: number | null, scope: SavedRateRef['scope']): string {
  return scope === 'rate' && rateIndex != null
    ? `rate:${productKey}:${rateIndex}`
    : `product:${productKey}`;
}

export function makeSavedRateRef(
  row: RateRow,
  scope: SavedRateRef['scope'] = 'rate',
  savedAt = new Date().toISOString(),
): SavedRateRef {
  if (scope === 'rate' && (row.exact_alert_eligible === false || !Number.isInteger(row.rate_index))) {
    throw new RangeError('An exact saved rate requires an integer rate_index');
  }
  const exact = scope === 'rate';
  const rateIndex = exact ? row.rate_index! : null;
  return {
    schemaVersion: 1,
    id: savedRateId(row.product_key, rateIndex, exact ? 'rate' : 'product'),
    scope: exact ? 'rate' : 'product',
    productKey: row.product_key,
    rateIndex,
    savedAt,
    savedRate: exact ? toFraction(row.rate) : null,
  };
}

export function makeLegacySavedRateRef(productKey: string, savedAt = new Date().toISOString()): SavedRateRef {
  return {
    schemaVersion: 1,
    id: savedRateId(productKey, null, 'product'),
    scope: 'product',
    productKey,
    rateIndex: null,
    savedAt,
    savedRate: null,
  };
}

export function normalizeSavedRates(raw: unknown, legacyFavorites: unknown = []): SavedRateRef[] {
  const out = new Map<string, SavedRateRef>();
  if (Array.isArray(raw)) {
    for (const value of raw) {
      if (!value || typeof value !== 'object') continue;
      const item = value as Partial<SavedRateRef>;
      if (typeof item.productKey !== 'string' || !item.productKey) continue;
      if (item.scope === 'rate' && !Number.isInteger(item.rateIndex)) continue;
      const scope = item.scope === 'rate' ? 'rate' : 'product';
      const rateIndex = scope === 'rate' ? Number(item.rateIndex) : null;
      const ref: SavedRateRef = {
        schemaVersion: 1,
        id: savedRateId(item.productKey, rateIndex, scope),
        scope,
        productKey: item.productKey,
        rateIndex,
        savedAt: typeof item.savedAt === 'string' && item.savedAt ? item.savedAt : new Date(0).toISOString(),
        savedRate:
          scope === 'rate' && typeof item.savedRate === 'number' && Number.isFinite(item.savedRate)
            ? item.savedRate
            : null,
      };
      out.set(ref.id, ref);
    }
  }
  if (Array.isArray(legacyFavorites)) {
    for (const key of legacyFavorites) {
      if (typeof key !== 'string' || !key) continue;
      const legacy = makeLegacySavedRateRef(key, new Date(0).toISOString());
      if (![...out.values()].some((ref) => ref.productKey === key)) out.set(legacy.id, legacy);
    }
  }
  return [...out.values()];
}

export function isSavedRate(
  refs: readonly SavedRateRef[],
  productKey: string,
  rateIndex: number | null,
): boolean {
  return refs.some(
    (ref) =>
      ref.productKey === productKey &&
      (ref.scope === 'product' || (ref.scope === 'rate' && rateIndex != null && ref.rateIndex === rateIndex)),
  );
}

export function toggleSavedRateRefs(
  refs: readonly SavedRateRef[],
  row: RateRow,
  scope: SavedRateRef['scope'] = 'rate',
): SavedRateRef[] {
  const next = makeSavedRateRef(row, scope);
  if (refs.some((ref) => ref.id === next.id)) {
    return refs.filter((ref) => ref.id !== next.id);
  }
  // A migrated product-scoped save is what makes every variant appear selected.
  // Tapping one of those selected stars must clear that all-variant save first,
  // rather than adding an exact save underneath an indefinitely selected star.
  if (scope === 'rate' && refs.some((ref) => ref.scope === 'product' && ref.productKey === row.product_key)) {
    return refs.filter((ref) => !(ref.scope === 'product' && ref.productKey === row.product_key));
  }
  if (scope === 'product') {
    return [...refs.filter((ref) => ref.productKey !== row.product_key), next];
  }
  return [...refs, next];
}

export function resolveSavedRates(core: CorePayload, refs: readonly SavedRateRef[]): ResolvedSavedRate[] {
  const resolved: ResolvedSavedRate[] = [];
  for (const ref of refs) {
    let fallback: ResolvedSavedRate | null = null;
    for (const [section, data] of Object.entries(core.sections) as [SectionKey, CorePayload['sections'][SectionKey]][]) {
      for (const row of data?.rates ?? []) {
        if (row.product_key !== ref.productKey) continue;
        const candidate = { ref, row, section };
        if (
          ref.scope === 'rate' &&
          row.exact_alert_eligible !== false &&
          row.rate_index === ref.rateIndex
        ) {
          resolved.push(candidate);
          fallback = null;
          break;
        }
        if (ref.scope === 'product') fallback ??= candidate;
      }
      if (resolved.at(-1)?.ref.id === ref.id) break;
    }
    if (fallback) resolved.push(fallback);
  }
  return resolved;
}
