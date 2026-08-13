import type { RateRow } from '../types';

const compare = (a: string, b: string) => a.localeCompare(b, 'en-AU', {
  sensitivity: 'base',
  numeric: true,
});

/** Distinct non-empty CDR providers in stable Australian alphabetical order. */
export function alphabeticalScenarioProviders(rows: RateRow[]): string[] {
  const canonical = new Map<string, string>();
  for (const row of rows) {
    const provider = row.provider.trim();
    if (provider && !canonical.has(provider.toLocaleLowerCase('en-AU'))) {
      canonical.set(provider.toLocaleLowerCase('en-AU'), provider);
    }
  }
  return [...canonical.values()].sort(compare);
}

/** Exact selectable tiers for a current-product match, sorted by product then rate index. */
export function currentProductOptions(rows: RateRow[], provider: string): RateRow[] {
  const seen = new Set<string>();
  return rows
    .filter((row) => row.provider === provider)
    .filter((row) => {
      const token = `${row.product_key}:${row.rate_index ?? ''}`;
      if (seen.has(token)) return false;
      seen.add(token);
      return true;
    })
    .sort((a, b) => compare(a.product_name, b.product_name) || (a.rate_index ?? 0) - (b.rate_index ?? 0));
}
