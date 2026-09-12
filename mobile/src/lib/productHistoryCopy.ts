import { formatRate, toFraction } from '../data/format';
import type { RateRow } from '../types';

export const PRODUCT_HISTORY_TITLE = 'Product-wide history';
export const PRODUCT_HISTORY_SERIES_LABEL = 'Best advertised rate · all tiers';
export const PRODUCT_HISTORY_SCOPE = 'Includes conditional and restricted tiers. The best tier can change.';

/** Explain an existing product-wide point without changing its calculation. */
export function selectedTierHistoryContext(row: RateRow, productBest: number | null): string | null {
  const selected = toFraction(row.rate);
  if (selected == null || productBest == null || Math.abs(selected - productBest) <= 1e-9) return null;
  return `Selected tier ${formatRate(selected)} · product best ${formatRate(productBest)} today`;
}
