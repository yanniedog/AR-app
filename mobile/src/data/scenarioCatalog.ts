import { mandatoryEligibleRows } from './eligibilityGate';
import type { RateRow } from '../types';
import type { PublicProduct } from './publicRateModel';
import type { SectionKey } from '../types';

const compare = (a: string, b: string) => a.localeCompare(b, 'en-AU', {
  sensitivity: 'base',
  numeric: true,
});

/** Distinct non-empty CDR providers in stable Australian alphabetical order. */
export function alphabeticalScenarioProviders(rows: RateRow[], products: readonly PublicProduct[] = [], providerNames: readonly string[] = []): string[] {
  const canonical = new Map<string, string>();
  for (const row of mandatoryEligibleRows(rows)) {
    const provider = row.provider.trim();
    if (provider && !canonical.has(provider.toLocaleLowerCase('en-AU'))) {
      canonical.set(provider.toLocaleLowerCase('en-AU'), provider);
    }
  }
  for (const product of products) {
    const provider = product.providerName.trim();
    const token = provider.toLocaleLowerCase('en-AU');
    if (provider && !canonical.has(token)) canonical.set(token, provider);
  }
  for (const name of providerNames) {
    const provider = name.trim(), token = provider.toLocaleLowerCase('en-AU');
    if (provider && !canonical.has(token)) canonical.set(token, provider);
  }
  return [...canonical.values()].sort(compare);
}

export interface CurrentProductOption {
  productKey: string;
  name: string;
  aliases: string[];
  status: PublicProduct['status'];
  product?: PublicProduct;
  row?: RateRow;
  offerId?: string;
  programmeId?: string;
}

/** Discovery identity survives missing pricing. No synthetic zero-rate row is created. */
export function currentProductDiscovery(
  rows: RateRow[], products: readonly PublicProduct[], provider: string, section?: SectionKey,
): CurrentProductOption[] {
  const providerKey = provider.trim().toLocaleLowerCase('en-AU');
  const publicProducts = products.filter(product => product.providerName.trim().toLocaleLowerCase('en-AU') === providerKey
    && (!section || product.section === section));
  const byKey = new Map(publicProducts.map(product => [product.productKey, product]));
  const options: CurrentProductOption[] = currentProductOptions(rows, provider).map(row => {
    const product = byKey.get(row.product_key);
    return {
      productKey: row.product_key, name: product?.name ?? row.product_name,
      aliases: product?.aliases.map(alias => alias.name) ?? [], status: product?.status ?? 'unknown', product, row,
      offerId: row.public_offer_id, programmeId: row.public_programme_id,
    };
  });
  const represented = new Set(options.map(option => option.productKey));
  for (const product of publicProducts) {
    if (!represented.has(product.productKey)) options.push({
      productKey: product.productKey, name: product.name, aliases: product.aliases.map(alias => alias.name),
      status: product.status, product,
    });
  }
  return options.sort((a, b) => compare(a.name, b.name) || compare(a.offerId ?? '', b.offerId ?? ''));
}

/** A saved semantic selection cannot silently fall back to a reordered source index. */
export function currentProductSelectionMatches(
  option: CurrentProductOption,
  selection: { productKey: string; rateIndex: number | null; offerId?: string; programmeId?: string },
): boolean {
  if (option.productKey !== selection.productKey) return false;
  if (selection.offerId) return option.offerId === selection.offerId;
  if (selection.programmeId) return option.programmeId === selection.programmeId;
  if (option.offerId || option.programmeId) return false;
  return (option.row?.rate_index ?? null) === selection.rateIndex;
}

/** Exact selectable tiers for a current-product match, sorted by product then rate index. */
export function currentProductOptions(rows: RateRow[], provider: string): RateRow[] {
  const seen = new Set<string>();
  const providerKey = provider.trim().toLocaleLowerCase('en-AU');
  return mandatoryEligibleRows(rows)
    .filter((row) => row.provider.trim().toLocaleLowerCase('en-AU') === providerKey)
    .filter((row) => {
      const token = `${row.product_key}:${row.rate_index ?? ''}`;
      if (seen.has(token)) return false;
      seen.add(token);
      return true;
    })
    .sort((a, b) => compare(a.product_name, b.product_name) || (a.rate_index ?? 0) - (b.rate_index ?? 0));
}
