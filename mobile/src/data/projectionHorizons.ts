import type { UiLabel } from '../lib/uiCopy';

/** Mortgage comparisons with no chosen timeframe use five years. */
export const DEFAULT_MORTGAGE_HORIZON_YEARS = '5';

/** Selectable projection timeframes, as years in the projection inputs. */
export const PROJECTION_HORIZONS = [
  { value: '0.25', label: '3M', months: 3 },
  { value: '1', label: '1Y', months: 12 },
  { value: '5', label: '5Y', months: 60 },
  { value: '10', label: '10Y', months: 120 },
  { value: '20', label: '20Y', months: 240 },
  { value: '30', label: '30Y', months: 360 },
  { value: '40', label: '40Y', months: 480 },
  { value: '50', label: '50Y', months: 600 },
] as const satisfies readonly { value: string; label: UiLabel; months: number }[];

export type ProjectionHorizon = typeof PROJECTION_HORIZONS[number]['value'];

/** The listed timeframe matching an entered horizon, or null for a custom one. */
export function projectionHorizonValue(horizonYears: string, fallbackYears: string): ProjectionHorizon | null {
  const months = Math.round(Number(horizonYears.trim() || fallbackYears) * 12);
  return PROJECTION_HORIZONS.find(option => option.months === months)?.value ?? null;
}

/** Term deposits run in whole terms: the renewals needed to cover a timeframe. */
export function termDepositRolloversFor(months: number, termMonths: number): number | null {
  if (!Number.isInteger(termMonths) || termMonths < 1) return null;
  return Math.max(0, Math.ceil(months / termMonths) - 1);
}
