import type { CorePayload } from '../types';
import { cachedPreparedHistoricalBankRateCatalogue, historicalBankRateSnapshotsAsync, prepareHistoricalBankRateCatalogue, prepareHistoricalBankRateCatalogueAsync, type HistoricalCatalogueFilters, type PreparedHistoricalBankRateCatalogue } from './historicalBankRateCatalogue';
import { bankRateScope } from './bankRateOverview';
import { yieldToUi } from '../lib/yieldToUi';

const supplemental = new WeakMap<CorePayload, { prepared: PreparedHistoricalBankRateCatalogue; missing: readonly string[] }>();
const owners = new WeakMap<CorePayload, CorePayload>();

export function historicalCatalogueOwner(core: CorePayload): CorePayload {
  return owners.get(core) ?? core;
}

/** RBA reconciliation replaces only policy fields. Preserve prepared and
 * in-flight bank history for that explicit, otherwise identical core wrapper. */
export function inheritHistoricalBankRateCatalogue(core: CorePayload, replacement: CorePayload): void {
  if (replacement.run_date !== core.run_date || replacement.sections !== core.sections ||
    replacement.bank_rate_history !== core.bank_rate_history ||
    replacement.bank_rate_history_catalogue !== core.bank_rate_history_catalogue) return;
  owners.set(replacement, historicalCatalogueOwner(core));
}

export function availableHistoricalBankRateCatalogue(core: CorePayload): PreparedHistoricalBankRateCatalogue | null {
  return supplemental.get(historicalCatalogueOwner(core))?.prepared ?? prepareHistoricalBankRateCatalogue(core.bank_rate_history_catalogue);
}

export function cachedHistoricalBankRateCatalogue(core: CorePayload): PreparedHistoricalBankRateCatalogue | null {
  return supplemental.get(historicalCatalogueOwner(core))?.prepared ?? cachedPreparedHistoricalBankRateCatalogue(core.bank_rate_history_catalogue);
}

export async function prepareAvailableHistoricalBankRateCatalogue(core: CorePayload): Promise<PreparedHistoricalBankRateCatalogue | null> {
  return supplemental.get(historicalCatalogueOwner(core))?.prepared ?? await prepareHistoricalBankRateCatalogueAsync(core.bank_rate_history_catalogue, () => yieldToUi(0));
}

export function installHistoricalBankRateCatalogue(core: CorePayload, value: unknown, missing: readonly string[] = []): boolean {
  const prepared = prepareHistoricalBankRateCatalogue(value);
  if (!prepared) return false;
  supplemental.set(historicalCatalogueOwner(core), { prepared, missing });
  return true;
}

export function clearHistoricalBankRateCatalogue(core: CorePayload): void {
  supplemental.delete(historicalCatalogueOwner(core));
}

export function missingHistoricalCatalogueDates(core: CorePayload): readonly string[] {
  const installed = supplemental.get(historicalCatalogueOwner(core));
  if (installed) return installed.missing;
  const embedded = prepareHistoricalBankRateCatalogue(core.bank_rate_history_catalogue);
  return embedded ? embedded.catalogue.run_dates.filter(day => day < core.run_date &&
    (!embedded.catalogue.sources[day] || embedded.catalogue.unavailable_dates[day])) : [];
}

/** Prepare the user's full historical filter result after the current rates paint.
 * Current rows remain gated normally when the panel builds today's snapshot. */
export async function warmHistoricalBankRateCatalogue(core: CorePayload, filters: HistoricalCatalogueFilters): Promise<void> {
  const prepared = await prepareAvailableHistoricalBankRateCatalogue(core);
  if (!prepared) return;
  await historicalBankRateSnapshotsAsync(prepared, core, bankRateScope({ Mortgage: [], Savings: [], TD: [] }), filters, () => yieldToUi(0));
}
