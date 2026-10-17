const RBA_TABLE_BASE = 'https://www.rba.gov.au/statistics/tables/csv';

export const ECONOMIC_URLS = {
  inflation: `${RBA_TABLE_BASE}/g1-data.csv`,
  expectations: `${RBA_TABLE_BASE}/g3-data.csv`,
  labour: `${RBA_TABLE_BASE}/h5-data.csv`,
  wages: `${RBA_TABLE_BASE}/h4-data.csv`,
  cashForecast: `${RBA_TABLE_BASE}/j1-cash-rate.csv`,
  cashRate: `${RBA_TABLE_BASE}/f1-data.csv`,
} as const;

/** Fixed ABS CPI selection: year-ended, all groups, Australia, monthly. */
export const ABS_HEADLINE_CPI_URL =
  'https://data.api.abs.gov.au/rest/data/ABS,CPI,2.0.0/3.10001.10.50.M?startPeriod=2015-01&format=csv';
export const RBA_F17_FORWARD_URL = `${RBA_TABLE_BASE}/f17-forward-rates.csv`;
export const RBA_J1_FORECAST_URL = ECONOMIC_URLS.cashForecast;

/** Exact foreground data reads, separate from browser links and payload assets. */
export const OFFICIAL_PUBLIC_DATA_URLS: readonly string[] = Object.freeze([
  ...Object.values(ECONOMIC_URLS), RBA_F17_FORWARD_URL, ABS_HEADLINE_CPI_URL,
]);
