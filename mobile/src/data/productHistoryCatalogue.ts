import { SECTION_KEYS } from '../types';
import { yieldToUi } from '../lib/yieldToUi';
import type { DatesIndex } from './datesIndex';
import type { PreparedHistoricalBankRateCatalogue } from './historicalBankRateCatalogue';
import { isExplicitTermDepositProduct } from './sectionIntegrity';

/** Project the existing product-best ledger from a validated full-tier catalogue.
 * This does not replace the separate, evidence-aware filtered bank graph engine.
 * Only exact selected public editions can receive public revision identities;
 * raw producer observations retain their own provenance and are not relabelled. */
export async function productRatesFromHistoricalCatalogue(
  prepared: PreparedHistoricalBankRateCatalogue,
  index: DatesIndex,
  requestedDates: readonly string[],
  isCurrent: () => boolean = () => true,
  yieldWork: () => Promise<void> = () => yieldToUi(0),
): Promise<Map<string, Map<string, number>>> {
  const catalogue = prepared.catalogue;
  const requested = new Set(requestedDates), selected = new Set(index.dates);
  const result = new Map<string, Map<string, number>>();
  const byPosition = catalogue.run_dates.map(day => {
    const source = catalogue.sources[day], head = index.revision_heads?.[day];
    if (!requested.has(day) || !selected.has(day) || catalogue.unavailable_dates[day] ||
        source?.kind !== 'published_core' || !head || source.manifest_sha256 !== head.manifest_sha256) return null;
    const rates = new Map<string, number>();
    result.set(day, rates);
    return rates;
  });
  if (!result.size) return result;
  await yieldWork();
  if (!isCurrent()) throw new Error('Product history catalogue projection superseded');
  let count = 0, started = Date.now();
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
  return result;
}
