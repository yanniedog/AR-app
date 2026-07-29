import type {
  EconomicIndicator,
  EconomicIndicatorId,
  EconomicOutlookPayload,
  EconomicPoint,
  EconomicPressure,
} from './economicOutlook';
import type { RbaEntry } from '../types';

export type EconomicWindow = '1Y' | '3Y' | '5Y' | 'All';

export type MeetingLean = 'cut' | 'raise' | 'hold';
export type VsPrior = 'above' | 'below' | 'same';

export interface EconomicReleaseRow {
  id: EconomicIndicatorId;
  label: string;
  shortLabel: string;
  /** Human coverage label, e.g. "Jun 2026". */
  coverageLabel: string;
  observationDate: string;
  updateDate: string;
  latest: number;
  prior: number | null;
  delta: number | null;
  vsPrior: VsPrior | null;
  meetingLean: MeetingLean;
  leanLabel: string;
  shortExplanation: string;
  deepExplanation: string;
  signalDirection: EconomicPressure;
  frequency: 'monthly' | 'quarterly';
  sourceUrl?: string;
  sourceAgency?: 'rba' | 'abs';
  targetBand?: [number, number];
}

export interface MeetingBiasModel {
  lean: MeetingLean;
  leanLabel: string;
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
  summary: string;
  rows: EconomicReleaseRow[];
}

export interface IndicatorHistoryModel {
  id: EconomicIndicatorId;
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
  id: EconomicIndicatorId;
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

const MOMENTUM_PERIODS: Record<EconomicIndicatorId, number> = {
  underlying_inflation: 4,
  headline_inflation: 4,
  unemployment: 6,
  participation: 6,
  employment_growth: 6,
  wages: 4,
  inflation_expectations: 4,
  consumer_inflation_expectations: 4,
};

const MOMENTUM_LABELS: Record<EconomicIndicatorId, string> = {
  underlying_inflation: 'Underlying',
  headline_inflation: 'Headline CPI',
  unemployment: 'Unemployment',
  participation: 'Participation',
  employment_growth: 'Jobs growth',
  wages: 'Wages',
  inflation_expectations: 'Market exp.',
  consumer_inflation_expectations: 'Consumer exp.',
};

/** Rising values that generally ease rate pressure (labour slack). */
const LOWER_WHEN_RISING: ReadonlySet<EconomicIndicatorId> = new Set([
  'unemployment',
]);

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
  id: EconomicIndicatorId,
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
  id: EconomicIndicatorId,
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
  id: EconomicIndicatorId,
  change: number,
): EconomicMomentumRow['policyPressure'] {
  if (Math.abs(change) < 0.05) return 'balanced';
  // Rising unemployment generally reduces rate pressure; for other series a rise
  // generally adds pressure. Directional context only — not a probability.
  const higherPressure = LOWER_WHEN_RISING.has(id) ? change < 0 : change > 0;
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
    const monthly = indicator.frequency === 'monthly' || periods >= 6;
    return [{
      id: indicator.id,
      label: MOMENTUM_LABELS[indicator.id],
      change,
      periods,
      periodLabel: monthly
        ? `last ${periods} monthly observations`
        : `last ${periods} observations`,
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
  // Prefer long official F1 cash-rate steps so 1Y/3Y/5Y/All all have history;
  // merge core.rba so a newer app ledger step is not dropped if F1 lags a day.
  // core.rba wins on duplicate dates (appended last; normalize keeps last value).
  const fromOfficial = payload.cashRateHistory ?? [];
  const fromCore = rba.map((entry) => ({ date: entry.date, value: entry.rate }));
  const actual = economicPointsInWindow(
    normalizeEconomicPoints([...fromOfficial, ...fromCore]),
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

const VS_PRIOR_EPSILON = 0.05;

const MEETING_WEIGHTS: Record<EconomicIndicatorId, number> = {
  underlying_inflation: 3,
  headline_inflation: 2,
  unemployment: 2,
  wages: 2,
  employment_growth: 1,
  participation: 1,
  inflation_expectations: 1,
  consumer_inflation_expectations: 0.5,
};

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** Coverage label for the period a reading applies to (e.g. "Jun 2026"). */
export function coverageLabelForDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const month = MONTH_SHORT[Number(match[2]) - 1];
  return month ? `${month} ${match[1]}` : isoDate;
}

function leanLabel(lean: MeetingLean): string {
  if (lean === 'cut') return 'Cut lean';
  if (lean === 'raise') return 'Raise lean';
  return 'Hold lean';
}

/**
 * Map rate-pressure + travel into a next-meeting lean. Falling-but-still-hot
 * inflation leans hold/cut rather than a hard raise; this is interpretation only.
 */
export function meetingLeanForIndicator(
  indicator: EconomicIndicator,
): { lean: MeetingLean; explanation: string } {
  const points = normalizeEconomicPoints(indicator.points);
  const latest = points.at(-1);
  const prior = points.length > 1 ? points[points.length - 2] : null;
  const delta = latest && prior ? round2(latest.value - prior.value) : null;
  const falling = delta != null && delta <= -VS_PRIOR_EPSILON;
  const rising = delta != null && delta >= VS_PRIOR_EPSILON;
  const direction = indicator.signal.direction;

  if (direction === 'higher') {
    if (falling) {
      return {
        lean: 'hold',
        explanation:
          `${indicator.signal.explanation} The latest reading is still elevated, but it eased versus the prior observation, which softens the case for a hike at the next meeting.`,
      };
    }
    return {
      lean: 'raise',
      explanation:
        `${indicator.signal.explanation} On its own this reading leans against easier policy and can support a higher cash-rate path if other data agree.`,
    };
  }
  if (direction === 'lower') {
    if (rising) {
      return {
        lean: 'hold',
        explanation:
          `${indicator.signal.explanation} The easing signal is tempered because the latest observation moved higher versus the prior reading.`,
      };
    }
    return {
      lean: 'cut',
      explanation:
        `${indicator.signal.explanation} Softer pressure here adds to the case for easier policy at the next meeting if the broader suite agrees.`,
    };
  }
  if (falling) {
    return {
      lean: 'cut',
      explanation:
        `${indicator.signal.explanation} Direction of travel is softer versus the prior observation, which modestly supports a cut lean.`,
    };
  }
  if (rising) {
    return {
      lean: 'raise',
      explanation:
        `${indicator.signal.explanation} Direction of travel is firmer versus the prior observation, which modestly supports a raise lean.`,
    };
  }
  return {
    lean: 'hold',
    explanation:
      `${indicator.signal.explanation} Little change versus the prior reading leaves this series closer to a hold lean for the next meeting.`,
  };
}

export function economicReleaseRow(indicator: EconomicIndicator): EconomicReleaseRow | null {
  const points = normalizeEconomicPoints(indicator.points);
  const latestPoint = points.at(-1);
  if (!latestPoint) return null;
  const priorPoint = points.length > 1 ? points[points.length - 2] : null;
  const delta = priorPoint ? round2(latestPoint.value - priorPoint.value) : null;
  let vsPrior: VsPrior | null = null;
  if (delta != null) {
    if (Math.abs(delta) < VS_PRIOR_EPSILON) vsPrior = 'same';
    else vsPrior = delta > 0 ? 'above' : 'below';
  }
  const { lean, explanation } = meetingLeanForIndicator(indicator);
  const observationDate = indicator.observationDate ?? latestPoint.date;
  const vsText = vsPrior == null || delta == null
    ? 'no prior observation to compare'
    : vsPrior === 'same'
      ? `about the same as the prior reading (${priorPoint!.value.toFixed(1)}%)`
      : `${vsPrior} the prior reading of ${priorPoint!.value.toFixed(1)}% (${signed(delta)} pp)`;
  return {
    id: indicator.id,
    label: indicator.label,
    shortLabel: indicator.shortLabel,
    coverageLabel: coverageLabelForDate(observationDate),
    observationDate,
    updateDate: indicator.publicationDate,
    latest: latestPoint.value,
    prior: priorPoint?.value ?? null,
    delta,
    vsPrior,
    meetingLean: lean,
    leanLabel: leanLabel(lean),
    shortExplanation: indicator.signal.label,
    deepExplanation:
      `${indicator.label} is ${latestPoint.value.toFixed(1)}% for ${coverageLabelForDate(observationDate)} `
      + `(updated ${coverageLabelForDate(indicator.publicationDate)}). It is ${vsText}. ${explanation} `
      + 'This is an app interpretation of official series, not a forecast.',
    signalDirection: indicator.signal.direction,
    frequency: indicator.frequency ?? 'quarterly',
    sourceUrl: indicator.sourceUrl,
    sourceAgency: indicator.sourceAgency,
    targetBand: indicator.targetBand,
  };
}

export function economicReleasesModel(
  payload: EconomicOutlookPayload,
): EconomicReleaseRow[] {
  return payload.indicators
    .flatMap((indicator) => {
      const row = economicReleaseRow(indicator);
      return row ? [row] : [];
    })
    .sort((left, right) => {
      const update = right.updateDate.localeCompare(left.updateDate);
      if (update) return update;
      return right.observationDate.localeCompare(left.observationDate);
    });
}

function scoreLean(lean: MeetingLean): number {
  if (lean === 'raise') return 1;
  if (lean === 'cut') return -1;
  return 0;
}

export function meetingBiasModel(
  payload: EconomicOutlookPayload,
): MeetingBiasModel | null {
  const rows = economicReleasesModel(payload);
  if (!rows.length) return null;

  let weighted = 0;
  let weightSum = 0;
  for (const row of rows) {
    const weight = MEETING_WEIGHTS[row.id] ?? 1;
    weighted += scoreLean(row.meetingLean) * weight;
    weightSum += weight;
  }
  const average = weightSum > 0 ? weighted / weightSum : 0;
  const lean: MeetingLean = average >= 0.25 ? 'raise' : average <= -0.25 ? 'cut' : 'hold';
  const magnitude = Math.abs(average);
  const confidence: MeetingBiasModel['confidence'] =
    magnitude >= 0.55 ? 'high' : magnitude >= 0.3 ? 'medium' : 'low';

  const drivers = rows
    .filter((row) => row.meetingLean === lean)
    .slice(0, 3)
    .map((row) => row.label);
  const driverText = drivers.length
    ? `Led by ${drivers.join(', ')}.`
    : 'Signals are mixed across the suite.';
  const rationale =
    lean === 'hold'
      ? `Weighted official readings are close to balanced for the next meeting. ${driverText}`
      : lean === 'cut'
        ? `Weighted official readings lean toward easier policy at the next meeting. ${driverText}`
        : `Weighted official readings lean toward tighter policy at the next meeting. ${driverText}`;

  return {
    lean,
    leanLabel: leanLabel(lean),
    confidence,
    rationale:
      `${rationale} This is an app interpretation of official ABS/RBA series — not a market probability or RBA forecast.`,
    summary:
      `Next-meeting lean: ${leanLabel(lean).toLowerCase()} (${confidence} confidence). ${rationale}`,
    rows,
  };
}
