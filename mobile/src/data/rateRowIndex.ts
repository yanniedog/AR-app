import type { RateRow } from '../types';

type RowField = 'product_key' | 'provider';

// Installed payload row arrays are immutable. Route transitions repeatedly look
// up a few products/lenders in the same edition; index each dimension only when
// used, and let replaced arrays (including same-day corrections) be collected.
const indexes = new WeakMap<RateRow[], Partial<Record<RowField, Map<string, RateRow[]>>>>();

function matchingRows(rows: RateRow[], field: RowField, value: string): RateRow[] {
  let dimensions = indexes.get(rows);
  if (!dimensions) {
    dimensions = {};
    indexes.set(rows, dimensions);
  }
  let index = dimensions[field];
  if (!index) {
    index = new Map();
    for (const row of rows) {
      const key = row[field];
      const matches = index.get(key);
      if (matches) matches.push(row);
      else index.set(key, [row]);
    }
    dimensions[field] = index;
  }
  // Preserve the old filter contract: consumers own the result array, while
  // row identities and original tier order stay exactly as published.
  return index.get(value)?.slice() ?? [];
}

/** Raw source rows; apply the current eligibility gate at the consumer. */
export function rowsForProductKey(rows: RateRow[], productKey: string): RateRow[] {
  return matchingRows(rows, 'product_key', productKey);
}

/** Raw source rows; apply visibility/ranking after selecting the lender. */
export function rowsForProvider(rows: RateRow[], provider: string): RateRow[] {
  return matchingRows(rows, 'provider', provider);
}
