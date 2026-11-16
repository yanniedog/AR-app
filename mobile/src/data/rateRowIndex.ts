import type { RateRow } from '../types';

// Adapted from yanniedog/AR-app#413, reviewed head
// 6018ae6c9ae30a28d62778a9bf9c7a217943c530 (Jay Kay).
type RowField = 'product_key' | 'provider';

// Installed payload row arrays are immutable. Route transitions repeatedly look
// up a few products/lenders in the same edition; index each dimension only when
// used, and let replaced arrays (including same-day corrections) be collected.
const indexes = new WeakMap<RateRow[], Partial<Record<RowField, Map<string, RateRow[]>>>>();

function indexedRows(rows: RateRow[], field: RowField, value: string): RateRow[] | undefined {
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
  return index.get(value);
}

function matchingRows(rows: RateRow[], field: RowField, value: string): RateRow[] {
  // Preserve the old filter contract: consumers own the result array, while
  // row identities and original tier order stay exactly as published.
  return indexedRows(rows, field, value)?.slice() ?? [];
}

const NO_ROWS: RateRow[] = [];

/**
 * One array identity per installed edition and lender, for read-only use.
 * `rowsForProvider` returns a fresh copy on every call, so results cached by
 * input identity (the ranked lender product list) were recomputed on every
 * lender open. Callers must not mutate the returned array.
 */
export function stableRowsForProvider(rows: RateRow[], provider: string): RateRow[] {
  return indexedRows(rows, 'provider', provider) ?? NO_ROWS;
}

/** Raw source rows; apply the current eligibility gate at the consumer. */
export function rowsForProductKey(rows: RateRow[], productKey: string): RateRow[] {
  return matchingRows(rows, 'product_key', productKey);
}

/** Raw source rows; apply visibility/ranking after selecting the lender. */
export function rowsForProvider(rows: RateRow[], provider: string): RateRow[] {
  return matchingRows(rows, 'provider', provider);
}
