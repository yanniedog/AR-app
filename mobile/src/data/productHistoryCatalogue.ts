import { SECTION_KEYS } from '../types';
import type { DatesIndex } from './datesIndex';
import { historicalCatalogueSelection, isPreparedHistoricalBankRateCatalogue, preparedReadySources, type PreparedHistoricalBankRateCatalogue } from './historicalBankRateCatalogue';
import { isExplicitTermDepositProduct } from './sectionIntegrity';
import { historicalSourceIdentity } from './historyIdentity';

/** Producer observations retain their own identity; never relabel them as a
 * public core edition just because their calendar date is the same. */
export function readyProductHistoryIdentity(prepared: PreparedHistoricalBankRateCatalogue | null | undefined,
  index: DatesIndex | undefined, day: string): string | undefined {
  if (!prepared) return undefined;
  const selection = historicalCatalogueSelection(prepared);
  if (selection && !selection.dates.has(day)) return readyProductHistoryIdentity(selection.fallback, index, day);
  const inputs = preparedReadySources(prepared);
  const input = inputs?.find(item => item.acceptedDates.includes(day));
  const trustedLegacy = !inputs && isPreparedHistoricalBankRateCatalogue(prepared);
  const source = input?.ready.sources[day] ?? (trustedLegacy && !prepared.catalogue.unavailable_dates[day]
    ? prepared.catalogue.sources[day] : undefined);
  if (!source) return undefined;
  if (source.kind === 'published_core') return index?.revision_heads?.[day]?.manifest_sha256 === source.manifest_sha256
    ? historicalSourceIdentity(index, day) : undefined;
  return input ? `prepared:${input.ready.compiler_sha256}:${source.banks_sha256}` : `catalogue:${source.banks_sha256}`;
}

export function productCatalogueDates(prepared: PreparedHistoricalBankRateCatalogue): string[] {
  const fallback = historicalCatalogueSelection(prepared)?.fallback;
  return [...new Set([...prepared.catalogue.run_dates, ...(fallback ? productCatalogueDates(fallback) : [])])].sort();
}

/** Project the existing product-best ledger from a validated full-tier catalogue.
 * This does not replace the separate, evidence-aware filtered bank graph engine.
 * Only exact selected public editions can receive public revision identities;
 * raw producer observations retain their own provenance and are not relabelled. */
export async function productRatesFromHistoricalCatalogue(
  prepared: PreparedHistoricalBankRateCatalogue,
  index: DatesIndex | null,
  requestedDates: readonly string[],
  isCurrent: () => boolean = () => true,
  yieldWork: () => Promise<void> = () => {
    // Lazy for Node tooling, literal require for Metro and the repository's Jest runtime.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('../lib/yieldToUi') as typeof import('../lib/yieldToUi')).yieldToUi(0);
  },
): Promise<Map<string, Map<string, number>>> {
  const catalogue = prepared.catalogue;
  const requested = new Set(requestedDates), selected = new Set(index?.dates ?? []);
  const readySources = preparedReadySources(prepared);
  const selection = historicalCatalogueSelection(prepared);
  const fallbackRates = selection?.fallback ? await productRatesFromHistoricalCatalogue(selection.fallback, index,
    requestedDates.filter(day => !selection.dates.has(day)), isCurrent, yieldWork) : new Map<string, Map<string, number>>();
  const trustedLegacy = !readySources && isPreparedHistoricalBankRateCatalogue(prepared);
  const result = new Map<string, Map<string, number>>();
  const byPosition = catalogue.run_dates.map(day => {
    const source = catalogue.sources[day], head = index?.revision_heads?.[day];
    if (!requested.has(day) || !source || catalogue.unavailable_dates[day] || (selection && !selection.dates.has(day))) return null;
    if (source.kind === 'published_core' ? !selected.has(day) || !head || source.manifest_sha256 !== head.manifest_sha256 : !readySources && !trustedLegacy) return null;
    const rates = new Map<string, number>();
    result.set(day, rates);
    return rates;
  });
  if (!result.size) return fallbackRates;
  await yieldWork();
  if (!isCurrent()) throw new Error('Product history catalogue projection superseded');
  let count = 0, started = Date.now();
  if (readySources) {
    for (const { ready, acceptedDates } of readySources) {
      const accepted = new Set(acceptedDates);
      const positions = ready.run_dates.map(day => accepted.has(day) ? result.get(day) : undefined);
      for (const section of SECTION_KEYS) for (const [key, spans] of ready.products[section]) {
        for (const [start, length, best] of spans) for (let position = start; position < start + length; position++) {
          const rates = positions[position];
          if (rates) {
            const previous = rates.get(key), value = best / 100;
            rates.set(key, previous === undefined ? value : section === 'Mortgage' ? Math.min(previous, value) : Math.max(previous, value));
          }
          if (++count % 64 === 0 && Date.now() - started >= 8) {
            await yieldWork();
            if (!isCurrent()) throw new Error('Product history catalogue projection superseded');
            started = Date.now();
          }
        }
      }
    }
    if (!isCurrent()) throw new Error('Product history catalogue projection superseded');
    return result;
  }
  for (const section of SECTION_KEYS) for (const tier of catalogue.sections[section]) {
    if (++count % 64 === 0 && Date.now() - started >= 8) {
      await yieldWork();
      if (!isCurrent()) throw new Error('Product history catalogue projection superseded');
      started = Date.now();
    }
    // Match downloadCore normalization exactly, without exposing a quarantined
    // Savings row or applying today's profile to historical product-best values.
    if (section === 'Savings' && isExplicitTermDepositProduct(tier.row)) continue;
    for (const [start, length, values] of tier.spans) {
      // Schema 2 stores sorted percentage points, including values below 1%.
      const value = (section === 'Mortgage' ? values[0] : values[values.length - 1]) / 100;
      for (let position = start; position < start + length; position++) {
        const rates = byPosition[position];
        if (rates) {
          const previous = rates.get(tier.row.product_key);
          rates.set(tier.row.product_key, previous === undefined ? value :
            section === 'Mortgage' ? Math.min(previous, value) : Math.max(previous, value));
        }
        if (++count % 64 === 0 && Date.now() - started >= 8) {
          await yieldWork();
          if (!isCurrent()) throw new Error('Product history catalogue projection superseded');
          started = Date.now();
        }
      }
    }
  }
  if (!isCurrent()) throw new Error('Product history catalogue projection superseded');
  return new Map([...fallbackRates, ...result]);
}
