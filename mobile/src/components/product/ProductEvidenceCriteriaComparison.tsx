import type { RateRow } from '../../types';
import { ProductEvidenceCriteria } from './ProductEvidenceCriteria';

/** Existing verified comparison selections; no change to financial ranking. */
export function ProductEvidenceCriteriaComparison({ rows }: { rows: readonly RateRow[] }) {
  return <ProductEvidenceCriteria productKeys={rows.map(row => row.product_key)} />;
}
