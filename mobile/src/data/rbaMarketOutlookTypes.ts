import type { CashRateForecast } from './economicOutlookTypes';

export interface RbaBondForwards {
  /** Trading date of the curve, distinct from the table's publication date. */
  observationDate: string;
  publicationDate: string;
  /** Government-bond forward rates, not OIS or meeting probabilities. */
  points: { date: string; value: number; horizonMonths: number }[];
}

export interface RbaMarketOutlook {
  schema_version: 1;
  fetchedAt: string;
  checkedAt: string;
  /** Refresh outcome only; the individual source dates determine freshness. */
  refreshStatus: 'current' | 'partial' | 'offline';
  bondForwards: RbaBondForwards | null;
  economists: CashRateForecast | null;
}
