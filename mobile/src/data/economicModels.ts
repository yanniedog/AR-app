import type {
  EconomicIndicator,
  EconomicOutlookPayload,
  EconomicPoint,
} from './economicOutlook';
import type { RbaEntry } from '../types';

export type EconomicWindow = '1Y' | '3Y' | '5Y' | 'All';

export interface IndicatorHistoryModel {
  id: EconomicIndicator['id'];
  label: string;
  shortLabel: string;
  points: EconomicPoint[];
  targetBand?: [number, number];
  latest: EconomicPoint;
  change: number | null;
  publicationDate: string;
  summary: string;
}

export interface EconomicComparisonModel {
  inflation: EconomicPoint[];
  expectations: EconomicPoint[];
  targetBand: [number, number];
  summary: string;
}

export interface EconomicMomentumRow {
  id: EconomicIndicator['id'];
  label: string;
  change: number;
  periods: number;
  periodLabel: string;
  policyPressure: 'higher' | 'lower' | 'balanced';
}

export interface EconomicMomentumModel {
  rows: EconomicMomentumRow[];
  maxAbsChange: number;
  summary: string;
}

export interface PolicyPathModel {
  actual: EconomicPoint[];
  forecast: EconomicPoint[];
  forecastStart: string | null;
  surveyDate: string | null;
  summary: string;
}

const WINDOW_YEARS: Record<Exclude<EconomicWindow, 'All'>, number> = {
  '1Y': 1,
  '3Y': 3,
  '5Y': 5,
};

const MOMENTUM_PERIODS: Record<EconomicIndicator['id'], number> = {
  underlying_inflation: 4,
  unemployment: 6,
  wages: 4,
  inflation_expectations: 4,
};

const MOMENTUM_LABELS: Record<EconomicIndicator['id'], string> = {
  underlying_inflation: 'Inflation',
  unemployment: 'Unemployment',
  wages: 'Wages',
  inflation_expectations: 'Expectations',
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function validDate(value: string): boolean {
  return Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

/** Sort, validate and deduplicate a sparse official series. Last duplicate wins. */
export function normalizeEconomicPoints(points: EconomicPoint[]): EconomicPoint[] {
  const byDate = new Map<string, number>();
  for (const point of points) {
    if (validDate(point.date) && Number.isFinite(point.value)) {
      byDate.set(point.date, point.value);
    }
  }
  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, value]) => ({ date, value }));
}

export function economicPointAtOrBefore(
  points: EconomicPoint[],
  date: string,
): EconomicPoint | null {
  let selected: EconomicPoint | null = null;
  for (const point of points) {
    if (point.date <= date && (!selected || point.date > selected.date)) selected = point;
  }
  return selected;
}

export function economicPointsInWindow(
  points: EconomicPoint[],
  window: EconomicWindow,
): EconomicPoint[] {
  const normalized = normalizeEconomicPoints(points);
  if (window === 'All' || normalized.length < 2) return normalized;
  const last = normalized.at(-1);
  if (!last) return [];
  const cutoff = new Date(`${last.date}T00:00:00Z`);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - WINDOW_YEARS[window]);
  const cutoffYmd = cutoff.toISOString().slice(0, 10);
  const firstInWindow = normalized.findIndex((point) => point.date >= cutoffYmd);
  // Keep one preceding observation so a sparse line does not appear to start
  // abruptly at the window boundary.
  return normalized.slice(Math.max(0, firstInWindow - 1));
}

function indicatorById(
  payload: EconomicOutlookPayload,
  id: EconomicIndicator['id'],
): EconomicIndicator | null {
  return payload.indicators.find((indicator) => indicator.id === id) ?? null;
}

function changeAcross(points: EconomicPoint[], periods: number): number | null {
  if (points.length <= periods) return null;
  return round2(points.at(-1)!.value - points[points.length - 1 - periods].value);
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

export function indicatorHistoryModel(
  payload: EconomicOutlookPayload,
  id: EconomicIndicator['id'],
  window: EconomicWindow = '5Y',
): IndicatorHistoryModel | null {
  const indicator = indicatorById(payload, id);
  if (!indicator) return null;
  const points = economicPointsInWindow(indicator.points, window);
  const latest = points.at(-1);
  if (!latest) return null;
  const change = points.length > 1
    ? round2(latest.value - points[points.length - 2].value)
    : null;
  const changeText = change == null
    ? 'no prior observation in this view'
    : `${signed(change)} percentage points from the prior observation`;
  return {
    id,
    label: indicator.label,
    shortLabel: indicator.shortLabel,
    points,
    targetBand: indicator.targetBand,
    latest,
    change,
    publicationDate: indicator.publicationDate,
    summary: `${indicator.label}, latest ${latest.value.toFixed(2)} percent on ${latest.date}, ${changeText}.`,
  };
}

export function inflationExpectationsModel(
  payload: EconomicOutlookPayload,
  window: EconomicWindow = '5Y',
): EconomicComparisonModel | null {
  const inflation = indicatorById(payload, 'underlying_inflation');
  const expectations = indicatorById(payload, 'inflation_expectations');
  if (!inflation || !expectations) return null;
  const inflationPoints = economicPointsInWindow(inflation.points, window);
  const expectationPoints = economicPointsInWindow(expectations.points, window);
  const latestInflation = inflationPoints.at(-1);
  const latestExpectations = expectationPoints.at(-1);
  if (!latestInflation || !latestExpectations) return null;
  return {
    inflation: inflationPoints,
    expectations: expectationPoints,
    targetBand: [2, 3],
    summary: `Underlying inflation ${latestInflation.value.toFixed(2)} percent on ${latestInflation.date}; one-year inflation expectations ${latestExpectations.value.toFixed(2)} percent on ${latestExpectations.date}; RBA reference band 2 to 3 percent.`,
  };
}

function momentumPressure(
  id: EconomicIndicator['id'],
  change: number,
): EconomicMomentumRow['policyPressure'] {
  if (Math.abs(change) < 0.05) return 'balanced';
  // Rising unemployment generally reduces rate pressure; for the other three
  // series a rise generally adds pressure. This is directional context, not a
  // probability or policy forecast.
  const higherPressure = id === 'unemployment' ? change < 0 : change > 0;
  return higherPressure ? 'higher' : 'lower';
}

export function economicMomentumModel(
  payload: EconomicOutlookPayload,
): EconomicMomentumModel | null {
  const rows = payload.indicators.flatMap((indicator): EconomicMomentumRow[] => {
    const points = normalizeEconomicPoints(indicator.points);
    const periods = MOMENTUM_PERIODS[indicator.id];
    const change = changeAcross(points, periods);
    if (change == null) return [];
    return [{
      id: indicator.id,
      label: MOMENTUM_LABELS[indicator.id],
      change,
      periods,
      periodLabel: indicator.id === 'unemployment'
        ? 'last 6 monthly observations'
        : 'last 4 observations',
      policyPressure: momentumPressure(indicator.id, change),
    }];
  });
  if (!rows.length) return null;
  const maxAbsChange = Math.max(0.1, ...rows.map((row) => Math.abs(row.change)));
  const summary = rows
    .map((row) => `${row.label} ${signed(row.change)} percentage points across its ${row.periodLabel}`)
    .join('; ');
  return { rows, maxAbsChange, summary: `Economic momentum: ${summary}.` };
}

export function policyPathModel(
  payload: EconomicOutlookPayload,
  rba: RbaEntry[],
  window: EconomicWindow = '5Y',
): PolicyPathModel | null {
  const actual = economicPointsInWindow(
    rba.map((entry) => ({ date: entry.date, value: entry.rate })),
    window,
  );
  const latestActual = actual.at(-1);
  const rawForecast = normalizeEconomicPoints(payload.cashRateForecast?.points ?? []);
  const futureForecast = latestActual
    ? rawForecast.filter((point) => point.date > latestActual.date)
    : rawForecast;
  const forecast = latestActual && futureForecast.length
    ? [latestActual, ...futureForecast]
    : futureForecast;
  if (!actual.length && !forecast.length) return null;
  const forecastEnd = forecast.at(-1);
  const actualText = latestActual
    ? `cash rate ${latestActual.value.toFixed(2)} percent on ${latestActual.date}`
    : 'no current cash-rate observation';
  const forecastText = forecastEnd && futureForecast.length
    ? `economists' median path reaches ${forecastEnd.value.toFixed(2)} percent by ${forecastEnd.date}`
    : 'no future survey path is available';
  return {
    actual,
    forecast,
    forecastStart: futureForecast[0]?.date ?? null,
    surveyDate: payload.cashRateForecast?.surveyDate ?? null,
    summary: `Policy path: actual ${actualText}; ${forecastText}.`,
  };
}
