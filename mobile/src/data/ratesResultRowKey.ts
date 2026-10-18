import type { RateRow } from '../types';

type ResultIdentity = Pick<RateRow, 'product_key' | 'public_offer_id' | 'rate_index'> | { key: string };

/** Keep opaque identifiers and semantic/legacy/catalogue namespaces distinct. */
export function ratesResultRowKey(row: ResultIdentity, absoluteIndex: number): string {
  return 'product_key' in row
    ? JSON.stringify(['rate', row.product_key, row.public_offer_id == null ? 'index' : 'offer',
      row.public_offer_id ?? row.rate_index ?? absoluteIndex])
    : JSON.stringify(['unlisted', row.key]);
}
