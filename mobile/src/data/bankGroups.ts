import type { CorePayload } from '../types';
import { SECTION_KEYS } from '../types';
import type { SavedRateRef } from './savedRates';

const BIG_FOUR = [
  /^(commbank|commonwealth bank( of australia)?)$/,
  /^westpac( banking corporation)?$/,
  /^(nab|national australia bank( limited)?)$/,
  /^(anz|australia and new zealand banking group( limited)?)$/,
];

/** Major-bank brands only; subsidiary and digital brands are separate providers. */
export function isBigFourProvider(provider: string): boolean {
  const name = provider.trim().toLowerCase().replace(/\s+/g, ' ');
  return BIG_FOUR.some((pattern) => pattern.test(name));
}

/** Providers of the user's saved products in the current publication. */
export function savedProviders(core: CorePayload | null | undefined, savedRates: readonly SavedRateRef[] | null | undefined): Set<string> {
  const providers = new Set<string>();
  if (!core?.sections || !savedRates?.length) return providers;
  const keys = new Set(savedRates.map((ref) => ref.productKey));
  for (const section of SECTION_KEYS) {
    for (const row of core.sections[section]?.rates ?? []) {
      if (keys.has(row.product_key)) providers.add(row.provider);
    }
  }
  return providers;
}

/** Saved providers first, then A–Z; an optional query narrows by name. */
export function orderProviders<T>(
  items: readonly T[],
  provider: (item: T) => string,
  saved: ReadonlySet<string>,
  query = '',
): T[] {
  const needle = query.trim().toLowerCase();
  const matches = needle ? items.filter((item) => provider(item).toLowerCase().includes(needle)) : items.slice();
  return matches.sort((a, b) => {
    const savedDelta = Number(saved.has(provider(b))) - Number(saved.has(provider(a)));
    return savedDelta || provider(a).localeCompare(provider(b));
  });
}
