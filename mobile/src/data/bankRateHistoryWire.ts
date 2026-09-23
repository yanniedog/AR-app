import { SECTION_KEYS, type CorePayload, type SectionKey } from '../types';

/** [first date index, number of observed dates, matching advertised rates (%)]. */
export type BankRateSpan = [number, number, number[]];
export interface PackedBankRateHistory {
  schema_version: 1;
  run_dates: string[];
  row_tiers: Record<SectionKey, number[]>;
  sections: Record<SectionKey, BankRateSpan[][]>;
}

/** Bind IDs before quarantine can remove rows. The wire catalogue stays unchanged
 * for older clients; its verified text/bytes, including this map, are cached. */
export function attachBankRateHistoryTiers(core: CorePayload): CorePayload {
  const pack = core.bank_rate_history;
  if (pack?.schema_version !== 1 || !SECTION_KEYS.every(section => {
    const ids = pack.row_tiers?.[section], spans = pack.sections?.[section];
    return Array.isArray(ids) && Array.isArray(spans) && ids.length === core.sections[section].rates.length &&
      ids.every(id => Number.isInteger(id) && id >= 0 && id < spans.length);
  })) return core;
  if (SECTION_KEYS.every(section => core.sections[section].rates.every((row, index) => row.bank_rate_tier === pack.row_tiers[section][index]))) return core;
  return { ...core, sections: Object.fromEntries(SECTION_KEYS.map(section => [section, {
    ...core.sections[section], rates: core.sections[section].rates.map((row, index) => ({ ...row, bank_rate_tier: pack.row_tiers[section][index] })),
  }])) as CorePayload['sections'] };
}
