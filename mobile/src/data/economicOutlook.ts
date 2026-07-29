import { cache } from './cache';

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
const MONTHLY_STALE_MS = 45 * 24 * 60 * 60 * 1000;
const QUARTERLY_STALE_MS = 120 * 24 * 60 * 60 * 1000;

const URLS = {
  inflation: `${RBA_TABLE_BASE}/g1-data.csv`,
  expectations: `${RBA_TABLE_BASE}/g3-data.csv`,
  labour: `${RBA_TABLE_BASE}/h5-data.csv`,
  wages: `${RBA_TABLE_BASE}/h4-data.csv`,
  cashForecast: `${RBA_TABLE_BASE}/j1-cash-rate.csv`,
  cashRate: `${RBA_TABLE_BASE}/f1-data.csv`,
} as const;

interface ParsedSeries {
  publicationDate: string;
  points: EconomicPoint[];
  sourceAgency?: 'rba' | 'abs';
}

type RequiredSourceKey = 'inflation' | 'expectations' | 'labour' | 'wages';

const SOURCE_KEYS: readonly RequiredSourceKey[] = [
  'inflation',
  'expectations',
  'labour',
  'wages',
];

interface IndicatorDefinition {
  source: RequiredSourceKey;
  id: EconomicIndicatorId;
  label: string;
  shortLabel: string;
  seriesId: string;
  frequency: EconomicIndicator['frequency'];
  targetBand?: [number, number];
}

/**
 * Official RBA series shown in Outlook. Extra labour / inflation series reuse the
 * same four CSV tables — one network fetch per table, then multiple series parses.
 * Full published history is retained so 1Y / 3Y / 5Y / All chart windows have data.
 */
const INDICATOR_DEFINITIONS: IndicatorDefinition[] = [
  {
    source: 'inflation',
    id: 'underlying_inflation',
    label: 'Underlying inflation',
    shortLabel: 'Trimmed mean · year-ended',
    seriesId: 'GCPIOCPMTMYP',
    frequency: 'quarterly',
    targetBand: [2, 3],
  },
  {
    source: 'inflation',
    id: 'headline_inflation',
    label: 'Headline CPI',
    shortLabel: 'All groups · year-ended',
    seriesId: 'GCPIAGYP',
    frequency: 'quarterly',
    targetBand: [2, 3],
  },
  {
    source: 'labour',
    id: 'unemployment',
    label: 'Unemployment',
    shortLabel: 'Seasonally adjusted',
    seriesId: 'GLFSURSA',
    frequency: 'monthly',
  },
  {
    source: 'labour',
    id: 'participation',
    label: 'Participation',
    shortLabel: 'Labour force participation',
    seriesId: 'GLFSPRSA',
    frequency: 'monthly',
  },
  {
    source: 'labour',
    id: 'employment_growth',
    label: 'Employment growth',
    shortLabel: 'Year-ended · seasonally adjusted',
    seriesId: 'GLFSEPTSYP',
    frequency: 'monthly',
  },
  {
    source: 'wages',
    id: 'wages',
    label: 'Wage growth',
    shortLabel: 'WPI · year-ended',
    seriesId: 'GWPIYP',
    frequency: 'quarterly',
  },
  {
    source: 'expectations',
    id: 'inflation_expectations',
    label: 'Market expectations',
    shortLabel: 'Economists · 1 year ahead',
    seriesId: 'GMAREXPY',
    frequency: 'quarterly',
    targetBand: [2, 3],
  },
  {
    source: 'expectations',
    id: 'consumer_inflation_expectations',
    label: 'Consumer expectations',
    shortLabel: 'Households · 1 year ahead',
    seriesId: 'GCONEXP',
    frequency: 'quarterly',
  },
];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(field.trim());
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(field.trim());
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field.trim());
    if (row.some((cell) => cell !== '')) rows.push(row);
  }
  return rows;
}

function isoDate(value: string): string {
  const trimmed = value.trim();
  const numeric = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (numeric) {
    return `${numeric[3]}-${numeric[2].padStart(2, '0')}-${numeric[1].padStart(2, '0')}`;
  }

  const named = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(trimmed);
  if (!named) return '';
  const month = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  }[named[2].toLowerCase()];
  return month ? `${named[3]}-${month}-${named[1].padStart(2, '0')}` : '';
}

function finite(value: string): number | null {
  if (!value) return null;
  const n = Number(value.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function rowByLabel(rows: string[][], label: string): string[] | undefined {
  return rows.find((row) => row[0]?.replace(/^\uFEFF/, '').trim() === label);
}

export function parseRbaSeriesCsv(text: string, seriesId: string): ParsedSeries {
  const rows = parseCsv(text);
  const ids = rowByLabel(rows, 'Series ID');
  if (!ids) throw new Error('RBA table is missing its Series ID row');
  const column = ids.indexOf(seriesId);
  if (column < 1) throw new Error(`RBA series ${seriesId} is unavailable`);
  const publication = rowByLabel(rows, 'Publication date')?.[column] ?? '';
  const parsedPoints = rows.flatMap((row) => {
    const date = isoDate(row[0] ?? '');
    const value = finite(row[column] ?? '');
    return date && value != null ? [{ date, value }] : [];
  });
  const points = [...new Map(parsedPoints.map((point) => [point.date, point])).values()]
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!points.length) throw new Error(`RBA series ${seriesId} has no observations`);
  return { publicationDate: isoDate(publication), points, sourceAgency: 'rba' };
}

/** Last calendar day of an ABS TIME_PERIOD (`YYYY-MM` or `YYYY-Qn`). */
export function absPeriodToIsoDate(period: string): string {
  const month = /^(\d{4})-(\d{2})$/.exec(period.trim());
  if (month) {
    const year = Number(month[1]);
    const monthIndex = Number(month[2]);
    if (monthIndex < 1 || monthIndex > 12) return '';
    const day = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
    return `${month[1]}-${month[2]}-${String(day).padStart(2, '0')}`;
  }
  const quarter = /^(\d{4})-Q([1-4])$/.exec(period.trim());
  if (quarter) {
    const endMonth = Number(quarter[2]) * 3;
    const day = new Date(Date.UTC(Number(quarter[1]), endMonth, 0)).getUTCDate();
    return `${quarter[1]}-${String(endMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return '';
}

function httpDateToIso(value: string | null | undefined): string {
  if (!value) return '';
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return '';
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Parse ABS Data API CPI CSV (MEASURE=3 year-ended %). Columns include
 * TIME_PERIOD / OBS_VALUE (order-tolerant via header names).
 */
export function parseAbsCpiCsv(
  text: string,
  publicationDate = '',
): ParsedSeries {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('ABS CPI table is empty');
  const header = rows[0].map((cell) => cell.replace(/^\uFEFF/, '').trim().toUpperCase());
  const timeIdx = header.indexOf('TIME_PERIOD');
  const valueIdx = header.indexOf('OBS_VALUE');
  if (timeIdx < 0 || valueIdx < 0) {
    throw new Error('ABS CPI table is missing TIME_PERIOD or OBS_VALUE');
  }
  const parsedPoints = rows.slice(1).flatMap((row) => {
    const date = absPeriodToIsoDate(row[timeIdx] ?? '');
    const value = finite(row[valueIdx] ?? '');
    return date && value != null ? [{ date, value }] : [];
  });
  const points = [...new Map(parsedPoints.map((point) => [point.date, point])).values()]
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!points.length) throw new Error('ABS CPI series has no observations');
  return {
    publicationDate: publicationDate || points.at(-1)!.date,
    points,
    sourceAgency: 'abs',
  };
}

/** Prefer the series whose latest observation is newer; ties keep the primary (ABS) read. */
export function preferNewerSeries(
  primary: ParsedSeries | null,
  fallback: ParsedSeries,
): ParsedSeries {
  if (!primary?.points.length) return fallback;
  const primaryLatest = primary.points.at(-1)?.date ?? '';
  const fallbackLatest = fallback.points.at(-1)?.date ?? '';
  return primaryLatest >= fallbackLatest ? primary : fallback;
}

export function parseCashForecastCsv(text: string): CashRateForecast | null {
  const rows = parseCsv(text);
  const ids = rowByLabel(rows, 'Series ID');
  if (!ids) return null;
  const targetColumn = ids.indexOf('JCRTQF');
  const medianColumn = ids.indexOf('JCRFMED');
  if (targetColumn < 1 || medianColumn < 1) return null;
  const observations = rows.flatMap((row) => {
    const surveyDate = isoDate(row[0] ?? '');
    const targetDate = isoDate(row[targetColumn] ?? '');
    const value = finite(row[medianColumn] ?? '');
    return surveyDate && targetDate && value != null
      ? [{ surveyDate, targetDate, value }]
      : [];
  });
  if (!observations.length) return null;
  const surveyDate = observations.reduce(
    (latest, item) => (item.surveyDate > latest ? item.surveyDate : latest),
    observations[0].surveyDate,
  );
  const points = observations
    .filter((item) => item.surveyDate === surveyDate)
    .map((item) => ({ date: item.targetDate, value: item.value }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    surveyDate,
    publicationDate: isoDate(rowByLabel(rows, 'Publication date')?.[medianColumn] ?? ''),
    points,
  };
}

/**
 * Compress daily cash-rate target observations to decision steps (value changes).
 * Keeps charts readable for 1Y–All while preserving the full F1 history span.
 * Defensively sorts by date so equal values are consecutive.
 */
export function cashRateTargetSteps(points: EconomicPoint[]): EconomicPoint[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const steps: EconomicPoint[] = [];
  for (const point of sorted) {
    const last = steps.at(-1);
    if (!last || last.value !== point.value) steps.push(point);
  }
  return steps;
}

export function parseCashRateTargetCsv(text: string): EconomicPoint[] {
  return cashRateTargetSteps(parseRbaSeriesCsv(text, 'FIRMMCRTD').points);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function pointDelta(points: EconomicPoint[], periodsBack: number): number | null {
  if (points.length <= periodsBack) return null;
  return round(points[points.length - 1].value - points[points.length - 1 - periodsBack].value);
}

function indicatorIsStale(
  publicationDate: string,
  frequency: EconomicIndicator['frequency'],
  nowMs = Date.now(),
): boolean {
  const publishedMs = Date.parse(`${publicationDate}T00:00:00Z`);
  if (!Number.isFinite(publishedMs)) return true;
  const limit = frequency === 'monthly' ? MONTHLY_STALE_MS : QUARTERLY_STALE_MS;
  return nowMs - publishedMs > limit;
}

export function economicSignal(
  id: EconomicIndicatorId,
  points: EconomicPoint[],
): EconomicSignal {
  const latest = points[points.length - 1]?.value;
  if (latest == null) {
    return { direction: 'balanced', label: 'No current read', explanation: 'Awaiting a current observation.' };
  }
  if (
    id === 'underlying_inflation' ||
    id === 'headline_inflation' ||
    id === 'inflation_expectations'
  ) {
    if (latest > 3) {
      return {
        direction: 'higher',
        label: 'Above 2–3% band',
        explanation: 'Persistent inflation pressure can make cuts harder and increases the case for tighter policy.',
      };
    }
    if (latest < 2) {
      return {
        direction: 'lower',
        label: 'Below 2–3% band',
        explanation: 'Sub-target inflation pressure can increase room for easier policy if other data agree.',
      };
    }
    return {
      direction: 'balanced',
      label: 'Inside 2–3% band',
      explanation: 'Being inside the band reduces this signal, but persistence and the direction of travel still matter.',
    };
  }
  if (id === 'consumer_inflation_expectations') {
    const delta = pointDelta(points, 4);
    if (latest >= 5 || (delta != null && delta >= 0.5)) {
      return {
        direction: 'higher',
        label: latest >= 5 ? 'Elevated household read' : `Up ${delta!.toFixed(1)} pp in a year`,
        explanation: 'High or rising consumer inflation expectations can entrench price-setting behaviour.',
      };
    }
    if (delta != null && delta <= -0.5) {
      return {
        direction: 'lower',
        label: `Down ${Math.abs(delta).toFixed(1)} pp in a year`,
        explanation: 'Cooling household inflation expectations can ease the persistence of price pressure.',
      };
    }
    return {
      direction: 'balanced',
      label: 'Households broadly steady',
      explanation: 'Consumer expectations are noisy; the RBA weighs them alongside market and business surveys.',
    };
  }
  if (id === 'unemployment') {
    const delta = pointDelta(points, 6);
    if (delta != null && delta >= 0.2) {
      return {
        direction: 'lower',
        label: `Up ${delta.toFixed(1)} pp in 6m`,
        explanation: 'A loosening labour market can reduce wage and demand pressure, adding to the case for easier policy.',
      };
    }
    if (delta != null && delta <= -0.2) {
      return {
        direction: 'higher',
        label: `Down ${Math.abs(delta).toFixed(1)} pp in 6m`,
        explanation: 'A tightening labour market can add wage and demand pressure, increasing the case for tighter policy.',
      };
    }
    return {
      direction: 'balanced',
      label: 'Broadly steady in 6m',
      explanation: 'The unemployment rate alone is neutral; the RBA assesses a wider suite of labour-market measures.',
    };
  }
  if (id === 'participation') {
    const delta = pointDelta(points, 6);
    if (delta != null && delta >= 0.3) {
      return {
        direction: 'higher',
        label: `Up ${delta.toFixed(1)} pp in 6m`,
        explanation: 'Rising participation can expand labour supply, but strong engagement often accompanies firm demand.',
      };
    }
    if (delta != null && delta <= -0.3) {
      return {
        direction: 'lower',
        label: `Down ${Math.abs(delta).toFixed(1)} pp in 6m`,
        explanation: 'Falling participation can signal softer labour-market attachment alongside weaker demand.',
      };
    }
    return {
      direction: 'balanced',
      label: 'Participation steady',
      explanation: 'Participation is a context series for the unemployment rate rather than a standalone policy trigger.',
    };
  }
  if (id === 'employment_growth') {
    const delta = pointDelta(points, 6);
    if (latest >= 2.5 && (delta == null || delta >= -0.3)) {
      return {
        direction: 'higher',
        label: 'Firm jobs growth',
        explanation: 'Strong year-ended employment growth supports demand and can keep labour-market pressure elevated.',
      };
    }
    if (latest <= 0.5 || (delta != null && delta <= -1)) {
      return {
        direction: 'lower',
        label: latest <= 0.5 ? 'Soft jobs growth' : 'Jobs growth slowing',
        explanation: 'Weak or slowing employment growth can ease capacity pressure and wage bargaining strength.',
      };
    }
    return {
      direction: 'balanced',
      label: 'Jobs growth moderate',
      explanation: 'Moderate employment growth is consistent with a labour market that is neither overheating nor collapsing.',
    };
  }
  const annualDelta = pointDelta(points, 4);
  if (latest > 3.5 && (annualDelta == null || annualDelta >= -0.1)) {
    return {
      direction: 'higher',
      label: 'Firm wage growth',
      explanation: 'Firm wage growth can sustain services inflation when productivity growth does not offset it.',
    };
  }
  if (latest < 3 || (annualDelta != null && annualDelta <= -0.3)) {
    return {
      direction: 'lower',
      label: 'Wage pressure easing',
      explanation: 'Cooling wage growth can reduce domestic inflation pressure, adding to the case for easier policy.',
    };
  }
  return {
    direction: 'balanced',
    label: 'Wage pressure mixed',
    explanation: 'Wage growth is neither an obvious tightening nor easing signal without productivity context.',
  };
}

export function buildEconomicOutlookFromCsv(input: {
  inflation: string;
  expectations: string;
  labour: string;
  wages: string;
  cashForecast?: string | null;
  cashRate?: string | null;
  /** Optional ABS headline CPI CSV; preferred when newer than RBA G1. */
  absHeadline?: string | null;
  absHeadlinePublicationDate?: string;
}, fetchedAt = new Date().toISOString()): EconomicOutlookPayload {
  // Soft-skip series missing from a table so unit fixtures can ship one column.
  const indicators = INDICATOR_DEFINITIONS.flatMap((definition) => {
    try {
      let parsed = parseRbaSeriesCsv(input[definition.source], definition.seriesId);
      let sourceUrl: string = URLS[definition.source];
      let frequency = definition.frequency;
      let shortLabel = definition.shortLabel;
      if (definition.id === 'headline_inflation' && input.absHeadline) {
        try {
          const abs = parseAbsCpiCsv(
            input.absHeadline,
            input.absHeadlinePublicationDate ?? '',
          );
          parsed = preferNewerSeries(abs, parsed);
          if (parsed.sourceAgency === 'abs') {
            sourceUrl = ABS_CPI_RELEASE_URL;
            frequency = 'monthly';
            shortLabel = 'All groups · year-ended · monthly';
          }
        } catch {
          // Keep RBA headline when ABS parse fails.
        }
      }
      return [buildIndicator(definition, parsed, fetchedAt, {
        sourceUrl,
        frequency,
        shortLabel,
      })];
    } catch {
      return [];
    }
  });
  let cashRateHistory: EconomicPoint[] | undefined;
  if (input.cashRate) {
    try {
      cashRateHistory = parseCashRateTargetCsv(input.cashRate);
    } catch {
      cashRateHistory = undefined;
    }
  }
  return {
    schema_version: 2,
    fetchedAt,
    checkedAt: fetchedAt,
    refreshStatus: 'current',
    indicators,
    cashRateForecast: input.cashForecast ? parseCashForecastCsv(input.cashForecast) : null,
    cashRateHistory,
  };
}

function buildIndicator(
  definition: IndicatorDefinition,
  parsed: ParsedSeries,
  checkedAt: string,
  overrides?: {
    sourceUrl?: string;
    frequency?: EconomicIndicator['frequency'];
    shortLabel?: string;
  },
): EconomicIndicator {
  const points = parsed.points;
  const frequency = overrides?.frequency ?? definition.frequency;
  const observationDate = points.at(-1)?.date;
  return {
    id: definition.id,
    label: definition.label,
    shortLabel: overrides?.shortLabel ?? definition.shortLabel,
    publicationDate: parsed.publicationDate,
    observationDate,
    points,
    targetBand: definition.targetBand,
    signal: economicSignal(definition.id, points),
    sourceUrl: overrides?.sourceUrl ?? URLS[definition.source],
    checkedAt,
    frequency,
    status: indicatorIsStale(parsed.publicationDate, frequency) ? 'stale' : 'current',
    sourceAgency: parsed.sourceAgency ?? 'rba',
  };
}

function normalizeCachedOutlook(
  cached: EconomicOutlookPayload | null,
): EconomicOutlookPayload | null {
  if (!cached?.indicators?.length) return null;
  const checkedAt = cached.checkedAt || cached.fetchedAt;
  const indicators = cached.indicators.map((indicator) => {
    const definition = INDICATOR_DEFINITIONS.find((item) => item.id === indicator.id);
    const frequency = indicator.frequency ?? definition?.frequency ?? 'quarterly';
    return {
      ...indicator,
      observationDate: indicator.observationDate ?? indicator.points.at(-1)?.date,
      sourceUrl: indicator.sourceUrl || (definition ? URLS[definition.source] : RBA_ECONOMIC_TABLE_URL),
      checkedAt: indicator.checkedAt || checkedAt,
      frequency,
      status: indicatorIsStale(indicator.publicationDate, frequency) ? 'stale' as const : 'current' as const,
      sourceAgency: indicator.sourceAgency ?? 'rba',
    };
  });
  return {
    ...cached,
    schema_version: 2,
    checkedAt,
    refreshStatus: cached.refreshStatus ?? 'current',
    indicators,
  };
}

function newestIndicator(
  fresh: EconomicIndicator,
  cached: EconomicIndicator | undefined,
): EconomicIndicator {
  if (!cached) return fresh;
  const freshDate = fresh.points.at(-1)?.date ?? '';
  const cachedDate = cached.points.at(-1)?.date ?? '';
  if (freshDate > cachedDate) return fresh;
  if (freshDate < cachedDate) return cached;
  // Same observation: keep the fresher publication / ABS-backed read when available.
  if (
    (fresh.sourceAgency === 'abs' && cached.sourceAgency !== 'abs')
    || fresh.publicationDate >= cached.publicationDate
  ) {
    return fresh;
  }
  return cached;
}

interface FetchedCsv {
  text: string;
  lastModified: string | null;
}

async function fetchCsv(url: string, timeoutMs = 15_000): Promise<FetchedCsv> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'text/csv' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Official data request failed (${response.status})`);
    const text = await response.text();
    const lastModified = response.headers?.get?.('last-modified')
      ?? response.headers?.get?.('Last-Modified')
      ?? null;
    return { text, lastModified };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url: string, timeoutMs = 15_000): Promise<string> {
  return (await fetchCsv(url, timeoutMs)).text;
}

let inFlight: {
  promise: Promise<EconomicOutlookPayload>;
  force: boolean;
} | null = null;
let requestSequence = 0;
let latestSuccessful: {
  sequence: number;
  payload: EconomicOutlookPayload;
} | null = null;
let commitQueue: Promise<void> = Promise.resolve();

async function commitEconomicResult(
  sequence: number,
  payload: EconomicOutlookPayload,
  persist: boolean,
): Promise<EconomicOutlookPayload> {
  let accepted = payload;
  const commit = commitQueue.then(async () => {
    if (latestSuccessful && latestSuccessful.sequence > sequence) {
      accepted = latestSuccessful.payload;
      return;
    }
    if (persist) await cache.writeEconomicOutlook(payload);
    latestSuccessful = { sequence, payload };
  });
  commitQueue = commit.catch(() => undefined);
  await commit;
  return accepted;
}

export async function loadEconomicOutlook(force = false): Promise<EconomicOutlookPayload> {
  if (inFlight && (!force || inFlight.force)) return inFlight.promise;
  const sequence = ++requestSequence;
  const run = (async () => {
    const cached = normalizeCachedOutlook(await cache.readEconomicOutlook());
    const cacheAge = cached
      ? Date.now() - Date.parse(cached.checkedAt ?? cached.fetchedAt)
      : Number.POSITIVE_INFINITY;
    if (
      !force &&
      cached?.refreshStatus === 'current' &&
      Number.isFinite(cacheAge) &&
      cacheAge < ECONOMIC_RECHECK_MS
    ) {
      return commitEconomicResult(sequence, cached, false);
    }

    const checkedAt = new Date().toISOString();
    const [sourceEntries, forecastSettled, cashRateSettled, absHeadlineSettled] = await Promise.all([
      Promise.all(
        SOURCE_KEYS.map(async (source) => {
          try {
            return { source, text: await fetchText(URLS[source]), error: null as string | null };
          } catch (error) {
            return {
              source,
              text: null as string | null,
              error: String((error as Error)?.message ?? error),
            };
          }
        }),
      ),
      (async () => {
        try {
          return {
            forecast: parseCashForecastCsv(await fetchText(URLS.cashForecast, 5_000)),
            error: null as string | null,
          };
        } catch (error) {
          return {
            forecast: null as CashRateForecast | null,
            error: `Cash-rate forecast: ${String((error as Error)?.message ?? error)}`,
          };
        }
      })(),
      (async () => {
        try {
          return {
            history: parseCashRateTargetCsv(await fetchText(URLS.cashRate)),
            error: null as string | null,
          };
        } catch (error) {
          return {
            history: null as EconomicPoint[] | null,
            error: `Cash-rate history: ${String((error as Error)?.message ?? error)}`,
          };
        }
      })(),
      (async () => {
        try {
          const fetched = await fetchCsv(ABS_HEADLINE_CPI_URL);
          const publicationDate = httpDateToIso(fetched.lastModified)
            || checkedAt.slice(0, 10);
          return {
            series: parseAbsCpiCsv(fetched.text, publicationDate),
            error: null as string | null,
          };
        } catch (error) {
          return {
            series: null as ParsedSeries | null,
            error: `ABS headline CPI: ${String((error as Error)?.message ?? error)}`,
          };
        }
      })(),
    ]);
    const textBySource = new Map(
      sourceEntries
        .filter((entry): entry is { source: RequiredSourceKey; text: string; error: null } => !!entry.text)
        .map((entry) => [entry.source, entry.text] as const),
    );
    const sourceErrorByKey = new Map(
      sourceEntries
        .filter((entry) => entry.error)
        .map((entry) => [entry.source, entry.error!] as const),
    );

    const indicatorEntries = INDICATOR_DEFINITIONS.map((definition) => {
      const text = textBySource.get(definition.source);
      if (!text) {
        return {
          definition,
          indicator: null as EconomicIndicator | null,
          error: `${definition.label}: ${sourceErrorByKey.get(definition.source) ?? 'unavailable'}`,
        };
      }
      try {
        let parsed = parseRbaSeriesCsv(text, definition.seriesId);
        let sourceUrl: string = URLS[definition.source];
        let frequency = definition.frequency;
        let shortLabel = definition.shortLabel;
        if (definition.id === 'headline_inflation' && absHeadlineSettled.series) {
          parsed = preferNewerSeries(absHeadlineSettled.series, parsed);
          if (parsed.sourceAgency === 'abs') {
            sourceUrl = ABS_CPI_RELEASE_URL;
            frequency = 'monthly';
            shortLabel = 'All groups · year-ended · monthly';
          }
        }
        return {
          definition,
          indicator: buildIndicator(definition, parsed, checkedAt, {
            sourceUrl,
            frequency,
            shortLabel,
          }),
          error: null as string | null,
        };
      } catch (error) {
        return {
          definition,
          indicator: null,
          error: `${definition.label}: ${String((error as Error)?.message ?? error)}`,
        };
      }
    });

    const forecastEntry = forecastSettled;
    const cashRateEntry = cashRateSettled;

    const errors = indicatorEntries.flatMap((entry) => (entry.error ? [entry.error] : []));
    if (forecastEntry.error) errors.push(forecastEntry.error);
    if (cashRateEntry.error) errors.push(cashRateEntry.error);
    if (absHeadlineSettled.error) errors.push(absHeadlineSettled.error);
    const refreshedCount = indicatorEntries.filter((entry) => entry.indicator).length;

    if (refreshedCount === 0) {
      if (force || !cached) {
        throw new Error(errors.join(' · ') || 'Official economic data could not be refreshed');
      }
      return commitEconomicResult(sequence, {
        ...cached,
        checkedAt,
        refreshStatus: 'offline' as const,
        refreshErrors: errors,
      }, false);
    }

    const cachedById = new Map(cached?.indicators.map((indicator) => [indicator.id, indicator]));
    const regressedIds = new Set<EconomicIndicatorId>();
    for (const entry of indicatorEntries) {
      if (!entry.indicator) continue;
      const previous = cachedById.get(entry.definition.id);
      const freshDate = entry.indicator.points.at(-1)?.date ?? '';
      const previousDate = previous?.points.at(-1)?.date ?? '';
      if (previous && freshDate < previousDate) {
        regressedIds.add(entry.definition.id);
        errors.push(`${entry.definition.label}: older official response ignored`);
      }
    }
    const indicators = indicatorEntries.flatMap((entry) => {
      const previous = cachedById.get(entry.definition.id);
      if (!entry.indicator) return previous ? [previous] : [];
      if (regressedIds.has(entry.definition.id) && previous) return [previous];
      return [newestIndicator(entry.indicator, previous)];
    });
    const acceptedCount = refreshedCount - regressedIds.size;
    const cashRateHistory = cashRateEntry.history?.length
      ? cashRateEntry.history
      : cached?.cashRateHistory;
    const refreshStatus = acceptedCount === INDICATOR_DEFINITIONS.length
      && !forecastEntry.error
      && !cashRateEntry.error
      ? 'current'
      : 'partial';
    const fresh: EconomicOutlookPayload = {
      schema_version: 2,
      fetchedAt: checkedAt,
      checkedAt,
      refreshStatus,
      refreshErrors: errors.length ? errors : undefined,
      indicators,
      cashRateForecast: forecastEntry.forecast ?? cached?.cashRateForecast ?? null,
      cashRateHistory,
    };
    return commitEconomicResult(sequence, fresh, true);
  })();
  const tracked = run.finally(() => {
    if (inFlight?.promise === tracked) inFlight = null;
  });
  inFlight = { promise: tracked, force };
  return tracked;
}
