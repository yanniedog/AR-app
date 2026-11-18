import type { CorePayload, RateRow, SectionKey } from '../types';
import { bankRateScope, rateTierSignature } from './bankRateOverview';
import { packedBankRateSnapshots } from './bankRateHistory';
import { toFraction } from './format';

/** A row binding is an exact tier. Product-best history cannot identify it. */
export function providerTierSeries(core: CorePayload, row: RateRow, section: SectionKey): Record<string, number | null> {
  if (!core.sections[section].rates.includes(row)) return {};
  const rows = { Mortgage: [], Savings: [], TD: [] } as Record<SectionKey, RateRow[]>;
  rows[section] = [row];
  const snapshots = packedBankRateSnapshots(core, bankRateScope(rows));
  const values: Record<string, number | null> = {};
  for (const [date, snapshot] of Object.entries(snapshots)) {
    const summary = snapshot[section]?.[row.provider];
    // A descriptor may bind multiple original rates. Do not invent which one
    // belongs to this row when an older observation is ambiguous.
    values[date] = summary && summary.min === summary.max ? summary.min / 100 : null;
  }
  values[core.run_date] = toFraction(row.rate);
  return values;
}

export function providerRowIdentity(section: SectionKey, row: RateRow): string {
  return JSON.stringify([section, row.product_key, row.rate_index ?? null,
    row.public_programme_id ?? null, row.public_offer_id ?? null,
    row.rate_index == null ? [rateTierSignature(row), row.rate] : null]);
}
