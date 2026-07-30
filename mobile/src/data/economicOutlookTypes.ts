export type EconomicPressure = 'higher' | 'lower' | 'balanced';

export interface EconomicPoint {
  date: string;
  value: number;
}

export interface EconomicSignal {
  direction: EconomicPressure;
  label: string;
  explanation: string;
}

export type EconomicIndicatorId =
  | 'underlying_inflation'
  | 'headline_inflation'
  | 'unemployment'
  | 'participation'
  | 'employment_growth'
  | 'wages'
  | 'inflation_expectations'
  | 'consumer_inflation_expectations';

export interface EconomicIndicator {
  id: EconomicIndicatorId;
  label: string;
  shortLabel: string;
  /** Official release / update date (ISO YYYY-MM-DD). */
  publicationDate: string;
  /** Latest observation period covered by the reading (ISO YYYY-MM-DD). */
  observationDate?: string;
  points: EconomicPoint[];
  targetBand?: [number, number];
  signal: EconomicSignal;
  sourceUrl?: string;
  checkedAt?: string;
  frequency?: 'monthly' | 'quarterly';
  status?: 'current' | 'stale';
  /** Which agency supplied the latest observation when dual-sourced. */
  sourceAgency?: 'rba' | 'abs';
}

export interface CashRateForecast {
  surveyDate: string;
  publicationDate: string;
  points: EconomicPoint[];
}

export interface EconomicOutlookPayload {
  schema_version: 1 | 2;
  fetchedAt: string;
  checkedAt?: string;
  refreshStatus?: 'current' | 'partial' | 'offline';
  refreshErrors?: string[];
  indicators: EconomicIndicator[];
  cashRateForecast: CashRateForecast | null;
  /** Official cash-rate target steps (F1), used for Policy path 1Y/3Y/5Y/All. */
  cashRateHistory?: EconomicPoint[];
}

const RBA_TABLE_BASE = 'https://www.rba.gov.au/statistics/tables/csv';
export const RBA_ECONOMIC_TABLE_URL = 'https://www.rba.gov.au/statistics/tables/';
/** ABS CPI Data API — year-ended % change, all groups, Australia, monthly. */
const ABS_DATA_API_BASE = 'https://data.api.abs.gov.au/rest/data/ABS,CPI,2.0.0';
/** Headline CPI year-ended (MEASURE=3, INDEX=10001, original, Australia, monthly). */
export const ABS_HEADLINE_CPI_URL =
  `${ABS_DATA_API_BASE}/3.10001.10.50.M?startPeriod=2015-01&format=csv`;
export const ABS_CPI_RELEASE_URL =
  'https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release';
/** Active sessions re-check often enough to pick up an official release promptly. */
export const ECONOMIC_RECHECK_MS = 15 * 60 * 1000;

export const ECONOMIC_URLS = {
  inflation: `${RBA_TABLE_BASE}/g1-data.csv`,
  expectations: `${RBA_TABLE_BASE}/g3-data.csv`,
  labour: `${RBA_TABLE_BASE}/h5-data.csv`,
  wages: `${RBA_TABLE_BASE}/h4-data.csv`,
  cashForecast: `${RBA_TABLE_BASE}/j1-cash-rate.csv`,
  cashRate: `${RBA_TABLE_BASE}/f1-data.csv`,
} as const;

export type RequiredSourceKey = 'inflation' | 'expectations' | 'labour' | 'wages';

export const ECONOMIC_SOURCE_KEYS: readonly RequiredSourceKey[] = [
  'inflation',
  'expectations',
  'labour',
  'wages',
];

export interface ParsedSeries {
  publicationDate: string;
  points: EconomicPoint[];
  sourceAgency?: 'rba' | 'abs';
}
