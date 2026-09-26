import type { CorePayload } from '../types';
import { historicalBankRateSnapshots, prepareHistoricalBankRateCatalogue, type HistoricalCatalogueFilters, type PreparedHistoricalBankRateCatalogue } from './historicalBankRateCatalogue';
import { bankRateScope } from './bankRateOverview';
import { yieldToUi } from '../lib/yieldToUi';

const supplemental = new WeakMap<CorePayload, { prepared: PreparedHistoricalBankRateCatalogue; missing: readonly string[] }>();

export function availableHistoricalBankRateCatalogue(core: CorePayload): PreparedHistoricalBankRateCatalogue | null {
  return supplemental.get(core)?.prepared ?? prepareHistoricalBankRateCatalogue(core.bank_rate_history_catalogue);
}

export function installHistoricalBankRateCatalogue(core: CorePayload, value: unknown, missing: readonly string[] = []): boolean {
  const prepared = prepareHistoricalBankRateCatalogue(value);
  if (!prepared) return false;
  supplemental.set(core, { prepared, missing });
  return true;
}

export function clearHistoricalBankRateCatalogue(core: CorePayload): void {
  supplemental.delete(core);
}

export function missingHistoricalCatalogueDates(core: CorePayload): readonly string[] {
  const installed = supplemental.get(core);
  if (installed) return installed.missing;
  const embedded = prepareHistoricalBankRateCatalogue(core.bank_rate_history_catalogue);
  return embedded ? embedded.catalogue.run_dates.filter(day => day < core.run_date &&
    (!embedded.catalogue.sources[day] || embedded.catalogue.unavailable_dates[day])) : [];
}

/** Prepare the user's full historical filter result before exposing a new core.
 * Current rows remain gated normally when the panel builds today's snapshot. */
export async function warmHistoricalBankRateCatalogue(core: CorePayload, filters: HistoricalCatalogueFilters): Promise<void> {
  const prepared = availableHistoricalBankRateCatalogue(core);
  if (!prepared) return;
  await yieldToUi();
  historicalBankRateSnapshots(prepared, core, bankRateScope({ Mortgage: [], Savings: [], TD: [] }), filters);
}
