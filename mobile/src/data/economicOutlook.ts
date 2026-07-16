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

export interface EconomicIndicator {
  id: 'underlying_inflation' | 'unemployment' | 'wages' | 'inflation_expectations';
  label: string;
  shortLabel: string;
  publicationDate: string;
  points: EconomicPoint[];
  targetBand?: [number, number];
  signal: EconomicSignal;
}

export interface CashRateForecast {
  surveyDate: string;
  publicationDate: string;
  points: EconomicPoint[];
}

export interface EconomicOutlookPayload {
  schema_version: 1;
  fetchedAt: string;
  indicators: EconomicIndicator[];
  cashRateForecast: CashRateForecast | null;
}

const RBA_TABLE_BASE = 'https://www.rba.gov.au/statistics/tables/csv';
export const RBA_ECONOMIC_TABLE_URL = 'https://www.rba.gov.au/statistics/tables/';
const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

const URLS = {
  inflation: `${RBA_TABLE_BASE}/g1-data.csv`,
  expectations: `${RBA_TABLE_BASE}/g3-data.csv`,
  labour: `${RBA_TABLE_BASE}/h5-data.csv`,
  wages: `${RBA_TABLE_BASE}/h4-data.csv`,
  cashForecast: `${RBA_TABLE_BASE}/j1-cash-rate.csv`,
} as const;

interface ParsedSeries {
  publicationDate: string;
  points: EconomicPoint[];
}

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
  const numeric = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (numeric) return `${numeric[3]}-${numeric[2]}-${numeric[1]}`;

  const named = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(trimmed);
  if (!named) return '';
  const month = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  }[named[2].toLowerCase()];
  return month ? `${named[3]}-${month}-${named[1]}` : '';
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
  const points = rows.flatMap((row) => {
    const date = isoDate(row[0] ?? '');
    const value = finite(row[column] ?? '');
    return date && value != null ? [{ date, value }] : [];
  });
  if (!points.length) throw new Error(`RBA series ${seriesId} has no observations`);
  return { publicationDate: isoDate(publication), points };
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

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function pointDelta(points: EconomicPoint[], periodsBack: number): number | null {
  if (points.length <= periodsBack) return null;
  return round(points[points.length - 1].value - points[points.length - 1 - periodsBack].value);
}

export function economicSignal(
  id: EconomicIndicator['id'],
  points: EconomicPoint[],
): EconomicSignal {
  const latest = points[points.length - 1]?.value;
  if (latest == null) {
    return { direction: 'balanced', label: 'No current read', explanation: 'Awaiting a current observation.' };
  }
  if (id === 'underlying_inflation' || id === 'inflation_expectations') {
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
  cashForecast: string;
}, fetchedAt = new Date().toISOString()): EconomicOutlookPayload {
  const definitions: {
    id: EconomicIndicator['id'];
    label: string;
    shortLabel: string;
    parsed: ParsedSeries;
    limit: number;
    targetBand?: [number, number];
  }[] = [
    {
      id: 'underlying_inflation',
      label: 'Underlying inflation',
      shortLabel: 'Trimmed mean · year-ended',
      parsed: parseRbaSeriesCsv(input.inflation, 'GCPIOCPMTMYP'),
      limit: 20,
      targetBand: [2, 3],
    },
    {
      id: 'unemployment',
      label: 'Unemployment',
      shortLabel: 'Seasonally adjusted',
      parsed: parseRbaSeriesCsv(input.labour, 'GLFSURSA'),
      limit: 30,
    },
    {
      id: 'wages',
      label: 'Wage growth',
      shortLabel: 'WPI · year-ended',
      parsed: parseRbaSeriesCsv(input.wages, 'GWPIYP'),
      limit: 20,
    },
    {
      id: 'inflation_expectations',
      label: 'Inflation expectations',
      shortLabel: 'Economists · 1 year ahead',
      parsed: parseRbaSeriesCsv(input.expectations, 'GMAREXPY'),
      limit: 20,
      targetBand: [2, 3],
    },
  ];
  const indicators = definitions.map((definition) => {
    const points = definition.parsed.points.slice(-definition.limit);
    return {
      id: definition.id,
      label: definition.label,
      shortLabel: definition.shortLabel,
      publicationDate: definition.parsed.publicationDate,
      points,
      targetBand: definition.targetBand,
      signal: economicSignal(definition.id, points),
    };
  });
  return {
    schema_version: 1,
    fetchedAt,
    indicators,
    cashRateForecast: parseCashForecastCsv(input.cashForecast),
  };
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'text/csv' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`RBA table request failed (${response.status})`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

let inFlight: Promise<EconomicOutlookPayload> | null = null;

export async function loadEconomicOutlook(force = false): Promise<EconomicOutlookPayload> {
  if (inFlight && !force) return inFlight;
  const run = (async () => {
    const cached = await cache.readEconomicOutlook();
    const cacheAge = cached ? Date.now() - Date.parse(cached.fetchedAt) : Number.POSITIVE_INFINITY;
    if (!force && cached && Number.isFinite(cacheAge) && cacheAge < CACHE_MAX_AGE_MS) return cached;
    try {
      const [inflation, expectations, labour, wages, cashForecast] = await Promise.all([
        fetchText(URLS.inflation),
        fetchText(URLS.expectations),
        fetchText(URLS.labour),
        fetchText(URLS.wages),
        fetchText(URLS.cashForecast),
      ]);
      const fresh = buildEconomicOutlookFromCsv({ inflation, expectations, labour, wages, cashForecast });
      await cache.writeEconomicOutlook(fresh);
      return fresh;
    } catch (error) {
      if (cached) return cached;
      throw error;
    }
  })();
  const tracked = run.finally(() => {
    if (inFlight === tracked) inFlight = null;
  });
  inFlight = tracked;
  return tracked;
}
