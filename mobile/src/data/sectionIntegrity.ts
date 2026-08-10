import type { CorePayload, RateRow, Ribbon, RibbonProvider, RibbonStats } from '../types';

/**
 * Some data holders publish products explicitly named "Term Deposit" under the
 * broad TRANS_AND_SAVINGS_ACCOUNTS CDR category. The producer currently carries
 * that category through to the Savings section. Keep this rule deliberately
 * narrow: product names must begin with the product identity, so references to a
 * term deposit (for example, a loan "secured by a Term Deposit") and specialist
 * Farm Management Deposits are not reclassified.
 */
export function isExplicitTermDepositProduct(row: Pick<RateRow, 'product_name'>): boolean {
  const name = String(row.product_name || '')
    .trim()
    .replace(/\s+/g, ' ');
  return /^(?:fixed )?term deposit(?:\b|$)/i.test(name);
}

function stats(values: number[]): RibbonStats {
  if (!values.length) return { min: null, max: null, mean: null, median: null };
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = sorted.length >> 1;
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    median: sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2,
  };
}

function finiteRate(row: RateRow): number | null {
  const value = Number(row.rate);
  return Number.isFinite(value) ? value : null;
}

/** Rebuild the complete producer-shaped ribbon after quarantining rows. */
export function rebuildSectionRibbon(rows: readonly RateRow[]): Ribbon {
  const providerRows = new Map<string, RateRow[]>();
  const products = new Set<string>();
  const rates: number[] = [];

  for (const row of rows) {
    const rate = finiteRate(row);
    if (rate === null) continue;
    products.add(row.product_key);
    rates.push(rate);
    const provider = String(row.provider || 'Unknown');
    const grouped = providerRows.get(provider);
    if (grouped) grouped.push(row);
    else providerRows.set(provider, [row]);
  }

  const providers: RibbonProvider[] = [...providerRows.entries()]
    .map(([provider, grouped]) => ({
      provider,
      rates: grouped.length,
      products: new Set(grouped.map((row) => row.product_key)).size,
      ...stats(grouped.map(finiteRate).filter((value): value is number => value !== null)),
    }))
    .sort((left, right) => left.provider.localeCompare(right.provider));

  return {
    counts: {
      rates: rates.length,
      products: products.size,
      providers: providerRows.size,
    },
    range: stats(rates),
    providers,
  };
}

/**
 * Quarantine explicit term-deposit identities from Savings at the shared core
 * trust boundary. We intentionally do not move them into TD: their producer
 * taxonomy and term facets are also Savings-shaped, so presenting them as a
 * trustworthy TD record would invent data. A corrected producer payload can add
 * them back to TD later without any client migration.
 *
 * Returns the original object when no correction is needed. This keeps the hot
 * path cheap and makes repeated normalization idempotent by reference.
 */
export function normalizeCoreSectionIntegrity(core: CorePayload): CorePayload {
  const savings = core?.sections?.Savings;
  if (!savings || !Array.isArray(savings.rates)) return core;

  const rates = savings.rates.filter((row) => !isExplicitTermDepositProduct(row));
  if (rates.length === savings.rates.length) return core;

  return {
    ...core,
    sections: {
      ...core.sections,
      Savings: {
        ...savings,
        rates,
        ribbon: rebuildSectionRibbon(rates),
      },
    },
  };
}
