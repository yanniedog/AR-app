import { formatRate, toFraction } from '../data/format';
import type { RateRow } from '../types';
import { uiJoin, type UiText } from './uiCopy';

export const PRODUCT_HISTORY_TITLE = 'Published product history';
export const PRODUCT_HISTORY_SERIES_LABEL = uiJoin('Leading advertised', ' · ', 'All tiers');
export const PRODUCT_HISTORY_SCOPE = uiJoin('All tiers', ' · ', 'Restricted', ' · ', 'Conditions required');

/** Explain an existing product-wide point without changing its calculation. */
export function selectedTierHistoryContext(row: RateRow, productBest: number | null): UiText | null {
  const selected = toFraction(row.rate);
  if (selected == null || productBest == null || Math.abs(selected - productBest) <= 1e-9) return null;
  return uiJoin('Selected rate', ' ', formatRate(selected), ' · ', 'Leading advertised', ' ', formatRate(productBest));
}
