import type { RateRow } from '../types';
import { CURRENT_V1_APP_HEALTH_SOURCE_CONTRACT } from '../lib/appHealth/sourceContract';

export type RateFreshness = 'current' | 'overdue' | 'stale' | 'unknown';
export interface SuccessfulVerification {
  kind: 'successful-product-verification' | 'successful-bank-verification';
  provider: string;
  productKey?: string;
  verifiedAt: string;
}
export const DAILY_VERIFICATION_CADENCE_MS = 24 * 60 * 60 * 1000;

/** A successful source receipt, never last_updated, publication or app-refresh time. */
export function rateFreshness(row: Pick<RateRow, 'provider' | 'product_key'>,
  receipt: SuccessfulVerification | null, nowMs: number): RateFreshness {
  if (!receipt || receipt.provider !== row.provider || !Number.isFinite(nowMs)
    || !['successful-product-verification', 'successful-bank-verification'].includes(receipt.kind)
    || (receipt.kind === 'successful-product-verification' && receipt.productKey !== row.product_key)
    || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(receipt.verifiedAt)) return 'unknown';
  const verified = Date.parse(receipt.verifiedAt);
  const [year, month, day] = receipt.verifiedAt.slice(0, 10).split('-').map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return 'unknown';
  if (!Number.isFinite(verified) || verified > nowMs) return 'unknown';
  const due = verified + DAILY_VERIFICATION_CADENCE_MS;
  const stale = due + CURRENT_V1_APP_HEALTH_SOURCE_CONTRACT.freshnessGraceMs;
  return nowMs <= due ? 'current' : nowMs <= stale ? 'overdue' : 'stale';
}

/** The shipping v1 row/coverage contract supplies no scoped verification receipt.
 * Its last_updated and observation/package dates cannot establish bank freshness.
 * Keep this adapter closed until a reviewed source contract supplies that evidence. */
export function rowVerificationReceipt(_row: RateRow): SuccessfulVerification | null { return null; }
