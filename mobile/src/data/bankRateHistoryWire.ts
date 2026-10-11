import { SECTION_KEYS, type CorePayload, type SectionKey } from '../types';

/** [first date index, number of observed dates, matching advertised rates (%)]. */
export type BankRateSpan = [number, number, number[]];
export interface PackedBankRateHistory {
  schema_version: 1;
  run_dates: string[];
  row_tiers: Record<SectionKey, number[]>;
  sections: Record<SectionKey, BankRateSpan[][]>;
}

/** Bind IDs before quarantine can remove rows. Non-enumerable metadata preserves
 * exact catalogue row hashes used by executable contracts and saved receipts. */
export function attachBankRateHistoryTiers(core: CorePayload): CorePayload {
  const pack = core.bank_rate_history;
  if (pack?.schema_version !== 1 || !SECTION_KEYS.every(section => {
    const ids = pack.row_tiers?.[section], spans = pack.sections?.[section];
    return Array.isArray(ids) && Array.isArray(spans) && ids.length === core.sections[section].rates.length &&
      ids.every(id => Number.isInteger(id) && id >= 0 && id < spans.length);
  })) return core;
  if (SECTION_KEYS.every(section => core.sections[section].rates.every((row, index) => row.bank_rate_tier === pack.row_tiers[section][index] &&
    !Object.prototype.propertyIsEnumerable.call(row, 'bank_rate_tier')))) return core;
  return { ...core, sections: Object.fromEntries(SECTION_KEYS.map(section => [section, {
    ...core.sections[section], rates: core.sections[section].rates.map((row, index) => Object.defineProperty(
      { ...row }, 'bank_rate_tier', { value: pack.row_tiers[section][index], enumerable: false },
    )),
  }])) as CorePayload['sections'] };
}
